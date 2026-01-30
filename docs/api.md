# Cosplit API Documentation

## Overview

API versioning: `/v1`

All monetary values are transmitted as **string** type to avoid floating-point precision issues.

Routes follow Ruby on Rails Shallow Resources convention:
- Nested routes for collection operations (list, create)
- Flat routes for member operations (get, update, delete)

---

## Receipt

### GET /v1/receipts

Get list of receipts for current user.

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number, default 1 |
| pageSize | integer | No | Page size, default 20 |
| ocrStatus | string | No | Filter by status: pending/processing/completed/failed |

**Response 200**

```json
{
  "data": [
    {
      "id": "rec_abc123",
      "storeName": "Costco",
      "totalAmount": "156.78",
      "ocrStatus": "completed",
      "attachmentUrl": "https://cosplit-r2.xxx.com/receipts/abc/image1.jpg",
      "createdAt": "2024-01-28T10:00:00Z"
    }
  ],
  "meta": { "total": 10, "page": 1, "pageSize": 20 }
}
```

---

### GET /v1/receipts/:id

Get receipt detail.

**Response 200**

```json
{
  "id": "rec_abc123",
  "userId": "user_xxx",
  "storeName": "Costco",
  "storeAddress": "123 Main St",
  "receiptDate": "2024-01-28T10:00:00Z",
  "subtotal": "150.00",
  "discount": "0",
  "taxAmount": "6.78",
  "totalAmount": "156.78",
  "ocrStatus": "completed",
  "ocrResult": { ... },
  "attachments": [
    {
      "id": "att_001",
      "key": "receipts/abc/image1.jpg",
      "bucket": "cosplit-receipts",
      "url": "https://cosplit-r2.xxx.com/receipts/abc/image1.jpg",
      "contentType": "image/jpeg",
      "sizeBytes": 1234567,
      "originalName": "IMG_1234.jpg",
      "sortOrder": 0
    }
  ],
  "items": [
    {
      "id": "item_001",
      "name": "iPhone 15",
      "quantity": 1,
      "unitPrice": "999.99",
      "totalPrice": "999.99",
      "discount": "0",
      "description": "256GB",
      "category": "Electronics",
      "taxExempt": false,
      "sortOrder": 0
    }
  ],
  "participants": [
    {
      "id": "part_001",
      "name": "Alice",
      "createdAt": "2024-01-28T10:00:00Z"
    }
  ],
  "allocations": [
    {
      "id": "alloc_001",
      "participantId": "part_001",
      "receiptItemId": "item_001",
      "type": "equal",
      "value": "0",
      "createdAt": "2024-01-28T10:00:00Z"
    }
  ],
  "createdAt": "2024-01-28T10:00:00Z",
  "updatedAt": "2024-01-28T10:30:00Z"
}
```

---

### POST /v1/receipts

Create receipt (called after image upload and attachment creation).

**Request Body**

```json
{
  "attachmentIds": ["att_xxx"]
}
```

**Response 201** - Returns full ReceiptDetail

**Validation**

- 400 if attachmentIds empty or contain duplicates
- 404 if any attachment not found or not owned by current user
- 422 if an attachment is already used or expired

---

### PATCH /v1/receipts/:id

Update receipt.

**Request Body** (all fields optional)

```json
{
  "storeName": "Costco",
  "storeAddress": "123 Main St, San Jose, CA 95112",
  "receiptDate": "2024-01-28T10:00:00Z"
}
```

**Response 200** - Returns updated ReceiptDetail

---

### POST /v1/receipts/:id/ocr

Trigger OCR re-processing. Used when OCR failed.

**Response 200**

```json
{
  "ocrStatus": "processing"
}
```

---

### DELETE /v1/receipts/:id

Delete receipt.

**Response 204**

---

## Item

### GET /v1/receipts/:receiptId/items

Get list of items for a receipt.

**Response 200**

```json
[
  {
    "id": "item_xxx",
    "name": "iPhone 15",
    "quantity": 1,
    "unitPrice": "999.99",
    "totalPrice": "999.99",
    "discount": "0",
    "description": "256GB",
    "category": "Electronics",
    "taxExempt": false,
    "sortOrder": 0
  }
]
```

---

### POST /v1/receipts/:receiptId/items

Create item for a receipt.

**Request Body**

```json
{
  "name": "iPhone 15",
  "quantity": 1,
  "unitPrice": "999.99",
  "totalPrice": "999.99",
  "discount": "0",
  "description": "256GB",
  "category": "Electronics",
  "taxExempt": false,
  "sortOrder": 0
}
```

**Response 201** - Returns created Item

---

### PATCH /v1/items/:id

Update item (for user verification after OCR).

**Request Body**

```json
{
  "name": "iPhone 15 Pro",
  "quantity": 2,
  "unitPrice": "1099.99",
  "totalPrice": "2199.98",
  "discount": "100.00",
  "description": "512GB",
  "taxExempt": false,
  "sortOrder": 1
}
```

**Response 200** - Returns updated Item

---

### DELETE /v1/items/:id

Delete item.

**Response 204**

---

## Participant

### GET /v1/participants

Get current user's historical participants (all receipts).

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number, default 1 |
| pageSize | integer | No | Page size, default 20 |
| search | string | No | Fuzzy match on participant name |

**Response 200**

```json
{
  "data": [
    {
      "id": "part_xxx",
      "name": "Alice",
      "createdAt": "2024-01-28T10:00:00Z"
    }
  ],
  "meta": { "total": 2, "page": 1, "pageSize": 20 }
}
```

---

### GET /v1/receipts/:receiptId/participants

Get list of participants.

**Response 200**

```json
[
  {
    "id": "part_xxx",
    "name": "Alice",
    "createdAt": "2024-01-28T10:00:00Z"
  },
  {
    "id": "part_yyy",
    "name": "Bob",
    "createdAt": "2024-01-28T10:00:00Z"
  }
]
```

---

### POST /v1/receipts/:receiptId/participants

Add participant to a receipt. Supports two modes:

- **Create new**: provide `name`
- **Attach existing**: provide `participantId` from `GET /v1/participants`

Exactly one of `name` or `participantId` must be present.

**Request Body**

```json
{
  "name": "Charlie"
}
```

or

```json
{
  "participantId": "part_xxx"
}
```

**Response 201**

```json
{
  "id": "part_zzz",
  "name": "Charlie",
  "createdAt": "2024-01-28T10:00:00Z"
}
```

**Validation**

- 400 if both `name` and `participantId` are missing or both provided
- 404 if `participantId` does not exist or does not belong to current user

---

### PATCH /v1/participants/:id

Update participant.

**Request Body**

```json
{
  "name": "Charles"
}
```

**Response 200** - Returns updated Participant

---

### DELETE /v1/participants/:id

Delete participant.

**Response 204**

---

## Allocation

### GET /v1/receipts/:receiptId/allocations

Get list of allocations.

**Response 200**

```json
[
  {
    "id": "alloc_xxx",
    "participantId": "part_xxx",
    "receiptItemId": "item_xxx",
    "type": "equal",
    "value": "0",
    "amount": "499.99",
    "createdAt": "2024-01-28T10:00:00Z"
  }
]
```

---

### POST /v1/receipts/:receiptId/allocations

Add allocation.

**Request Body**

```json
{
  "participantId": "part_xxx",
  "receiptItemId": "item_xxx",
  "type": "equal",
  "value": "0"
}
```

`type` values: `equal` | `shares` | `custom`

**Response 201** - Returns created Allocation

---

### DELETE /v1/allocations/:id

Delete allocation.

**Response 204**

---

## Attachment

### POST /v1/attachments

Create an attachment record after uploading a file to object storage.

**Request Body**

```json
{
  "key": "receipts/abc/image1.jpg",
  "bucket": "cosplit-receipts",
  "contentType": "image/jpeg",
  "sizeBytes": 1234567,
  "originalName": "IMG_1234.jpg",
  "sortOrder": 0,
  "notes": "optional"
}
```

**Response 201**

```json
{
  "id": "att_xxx",
  "key": "receipts/abc/image1.jpg",
  "bucket": "cosplit-receipts",
  "contentType": "image/jpeg",
  "sizeBytes": 1234567,
  "originalName": "IMG_1234.jpg",
  "sortOrder": 0,
  "notes": null,
  "expiresAt": "2024-01-28T11:00:00Z",
  "createdAt": "2024-01-28T10:00:00Z"
}
```

**Validation**

- 400 if key/bucket missing
- 403 if creating for another user
- `sortOrder` and `notes` are optional; `sortOrder` defaults to 0, `notes` defaults to null

### DELETE /v1/attachments/:id

Delete an attachment (only allowed before it is bound to any receipt).

**Response 204**

**Errors**
- 404 if attachment not found
- 422 if attachment is already in use

---

## Upload

### POST /v1/uploads/presigned-url

Get presigned URL for R2 upload.

**Request Body**

```json
{
  "filename": "IMG_1234.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 1234567
}
```

**Response 200**

```json
{
  "uploadUrl": "https://cosplit-r2.xxx.com/...",
  "key": "receipts/abc/image1.jpg",
  "bucket": "cosplit-receipts",
  "expiresAt": "2024-01-28T11:00:00Z"
}
```

Use `key`/`bucket` (and the original upload metadata) when calling [POST /v1/attachments](#post-v1attachments) after the upload succeeds.

---

## Attachment Flow (client-facing)

1. Call `POST /v1/uploads/presigned-url` to get `uploadUrl + key + bucket`.
2. PUT the file to `uploadUrl` directly (R2/S3).
3. Call `POST /v1/attachments` with the same `key/bucket` plus file metadata (`contentType`, `sizeBytes`, `originalName`, optional `sortOrder/notes`) to create an attachment record.
4. Call `POST /v1/receipts` with `attachmentIds` to bind attachments to the receipt.

Rules:
- Only attachments owned by the current user can be referenced.
- `attachmentIds` must be unique per request.
- Attachments already used by another receipt will be rejected (422).

Server responsibilities (not exposed to client fields):
- Internally tracks attachment lifecycle (e.g., pending/attached/expired).
- May auto-clean unattached uploads; clients should create receipts soon after upload.

---

## Summary

Get allocation summary with calculated amounts per participant.

### GET /v1/receipts/:id/summary

Get allocation summary.

**Response 200**

```json
{
  "items": [
    {
      "itemId": "item_xxx",
      "name": "iPhone 15",
      "totalPrice": "999.99",
      "allocations": [
        {
          "participantId": "part_xxx",
          "participantName": "Alice",
          "amount": "333.33"
        },
        {
          "participantId": "part_yyy",
          "participantName": "Bob",
          "amount": "333.33"
        },
        {
          "participantId": "part_zzz",
          "participantName": "Charlie",
          "amount": "333.33"
        }
      ]
    }
  ],
  "participants": [
    {
      "id": "part_xxx",
      "name": "Alice",
      "totalAmount": "333.33"
    },
    {
      "id": "part_yyy",
      "name": "Bob",
      "totalAmount": "333.33"
    },
    {
      "id": "part_zzz",
      "name": "Charlie",
      "totalAmount": "333.33"
    }
  ],
  "totals": {
    "subtotal": "999.99",
    "tax": "0",
    "discount": "0",
    "total": "999.99"
  }
}
```

---

## Errors

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Error Name"
}
```

**Common Error Codes**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Validation failed (message is array) |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable Entity | Business logic error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Enums

### OcrStatus

- `pending`
- `processing`
- `completed`
- `failed`

### AllocationType

- `equal` - Split equally
- `shares` - Split by shares (e.g., Alice 2, Bob 1)
- `custom` - Custom fixed amount
