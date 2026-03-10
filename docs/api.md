# Cosplit API Documentation

## Overview

API versioning: `/v1`

All monetary values are transmitted as **string** type to avoid floating-point precision issues.

Routes follow Ruby on Rails Shallow Resources convention:

- Nested routes for collection operations (list, create)
- Flat routes for member operations (get, update, delete)

---

## Authentication

All protected endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

- **access_token** — short-lived JWT, expires in 1 hour.
- **refresh_token** — long-lived opaque token, expires in 30 days. Rotates on every refresh (old token is immediately revoked).
- Missing or expired access token returns `401 Unauthorized`.

---

## Auth

### GET /v1/auth/google

**Web flow — Step 1.** Redirects the browser to the Google OAuth consent screen. No request body required.

This endpoint is public (no `Authorization` header needed).

```
302 → https://accounts.google.com/o/oauth2/v2/auth?...
```

---

### GET /v1/auth/google/callback

**Web flow — Step 2.** Google redirects here after the user grants access. The server exchanges the Google auth code for a user profile, then issues a short-lived one-time exchange code and redirects the browser to the frontend.

This endpoint is public and handled automatically by Passport — clients should not call it directly.

```
302 → <FRONTEND_URL>?code=<exchange_code>
```

The `exchange_code` is single-use and expires after **5 minutes**.

---

### POST /v1/auth/exchange

**Web flow — Step 3.** The frontend calls this endpoint to exchange the one-time code (from the callback redirect) for a token pair.

This endpoint is public.

**Request Body**

```json
{
  "code": "a1b2c3d4e5f6..."
}
```

**Response 200**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "d4e5f6a1b2c3..."
}
```

**Errors**

| Status | Description                               |
| ------ | ----------------------------------------- |
| 401    | Code is invalid, already used, or expired |

---

### POST /v1/auth/google/token

**Mobile flow.** Mobile clients obtain a Google ID token via the native Google Sign-In SDK (iOS / Android) and pass it here to receive a token pair directly — no browser redirect required.

This endpoint is public.

**Request Body**

```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response 200** — same `TokenResponse` as `/v1/auth/exchange`

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "d4e5f6a1b2c3..."
}
```

**Errors**

| Status | Description                                              |
| ------ | -------------------------------------------------------- |
| 401    | `id_token` is invalid or could not be verified by Google |

---

### POST /v1/auth/refresh

Exchange a valid refresh token for a new token pair. The old refresh token is immediately revoked (token rotation).

This endpoint is public.

**Request Body**

```json
{
  "refresh_token": "d4e5f6a1b2c3..."
}
```

**Response 200** — new `TokenResponse`

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "f6a1b2c3d4e5..."
}
```

**Errors**

| Status | Description                                   |
| ------ | --------------------------------------------- |
| 401    | Refresh token is invalid, revoked, or expired |

---

### DELETE /v1/auth/session

Revoke the current refresh token (logout). The client should also discard both tokens from local storage.

This endpoint is public (no access token required — the refresh token itself identifies the session).

**Request Body**

```json
{
  "refresh_token": "d4e5f6a1b2c3..."
}
```

**Response 204** — no body

---

### GET /v1/auth/me

Return the currently authenticated user.

**Requires** `Authorization: Bearer <access_token>`.

**Response 200**

```json
{
  "id": "clxxx",
  "name": "Alice",
  "email": "alice@example.com",
  "emailVerified": true,
  "image": "https://lh3.googleusercontent.com/..."
}
```

**Errors**

| Status | Description                     |
| ------ | ------------------------------- |
| 401    | Missing or invalid access token |

---

## Receipt

### GET /v1/receipts

Get list of receipts for current user.

**Query Parameters**

| Parameter | Type    | Required | Description                                           |
| --------- | ------- | -------- | ----------------------------------------------------- |
| page      | integer | No       | Page number, default 1                                |
| pageSize  | integer | No       | Page size, default 20                                 |
| ocrStatus | string  | No       | Filter by status: pending/processing/completed/failed |

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
  "discount": "0.00",
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
      "discount": "0.00",
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
      "amount": "499.99",
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
    "discount": "0.00",
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
  "discount": "0.00",
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

| Parameter | Type    | Required | Description                     |
| --------- | ------- | -------- | ------------------------------- |
| page      | integer | No       | Page number, default 1          |
| pageSize  | integer | No       | Page size, default 20           |
| search    | string  | No       | Fuzzy match on participant name |

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

### PUT /v1/items/:id/allocations

Replace all allocations for a specific item in one request. Idempotent: repeated calls with the same body yield the same result.

**Request Body**

```json
{
  "allocations": [
    { "participantId": "part_xxx", "type": "equal", "value": "0" },
    { "participantId": "part_yyy", "type": "shares", "value": "2" },
    { "participantId": "part_zzz", "type": "custom", "value": "12.34" }
  ]
}
```

Rules:

- `allocations` may be empty to clear all allocations for the item.
- Each participantId appears at most once.
- `type` values: `equal` | `shares` | `custom`
- `value` format (all strings to avoid float issues):
  - `equal`: `"0"` (ignored by backend; may be omitted)
  - `shares`: positive decimal string for share weight (e.g., `"2"` vs `"1"`)
  - `custom`: decimal string for fixed amount for this participant on that item

Responses:

- 200 with the final allocations list (and calculated amounts if available).
- 400 for payload validation errors; 404 if item not found or not owned by current user; 422 for business validation (e.g., zero total shares, custom sums exceed item total).

Concurrency (optional):

- Accept `If-Unmodified-Since` or `If-Match` headers to avoid overwriting concurrent edits; if the precondition fails, return 412.

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

`expiresAt` is the server cleanup time for unattached uploads (currently ~1 hour after creation).

**Validation**

- 400 if key/bucket/contentType/sizeBytes/originalName missing
- 403 if key is not scoped to current user (must start with `receipts/{userId}/`)
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

`expiresAt` is when the presigned upload URL expires (currently ~1 hour).

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
    "tax": "0.00",
    "discount": "0.00",
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

| Status | Error                 | Description                          |
| ------ | --------------------- | ------------------------------------ |
| 400    | Bad Request           | Validation failed (message is array) |
| 401    | Unauthorized          | Missing or invalid token             |
| 403    | Forbidden             | Access denied                        |
| 404    | Not Found             | Resource not found                   |
| 409    | Conflict              | Duplicate resource                   |
| 422    | Unprocessable Entity  | Business logic error                 |
| 429    | Too Many Requests     | Rate limit exceeded                  |
| 500    | Internal Server Error | Server error                         |

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
