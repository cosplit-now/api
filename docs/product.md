# Cosplit Product Requirements Document

## Overview

Cosplit is a tool that helps users split receipt expenses. It uses OCR to recognize receipt images, automatically parses items and prices, and allows users to add participants for expense allocation.

---

## User Flow

### 0. Sign In

Users must sign in before accessing any protected feature. Cosplit uses Google OAuth.

#### Web

1. User clicks "Sign in with Google".
2. Browser is redirected to `GET /auth/google` → Google consent screen.
3. After granting access, Google redirects back and the server redirects the browser to `<FRONTEND_URL>?code=<exchange_code>`.
4. Frontend reads `code` from the URL, calls `POST /auth/exchange { code }`, and receives a token pair.
5. Store `access_token` and `refresh_token` in persistent local storage (e.g. `localStorage`).

See also: [Auth API](api.md#auth)

#### Mobile (iOS / Android)

1. Invoke the native Google Sign-In SDK to obtain a Google `id_token`.
2. Call `POST /auth/google/token { id_token }` → receive a token pair.
3. Store tokens securely (e.g. iOS Keychain / Android Keystore).

#### Token Management

All API requests must include the access token:

```
Authorization: Bearer <access_token>
```

| Scenario                             | Action                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| API returns `401`                    | Use `refresh_token` to call `POST /auth/refresh` → store new token pair, retry original request |
| Refresh token also expired / invalid | Clear tokens, redirect user to sign-in                                                          |
| User taps "Sign Out"                 | Call `DELETE /auth/session { refresh_token }`, then clear all stored tokens                     |

**Token rotation:** every call to `POST /auth/refresh` issues a new `refresh_token` and immediately revokes the old one. Always persist the latest refresh token.

---

### 1. Create Receipt

1. User clicks "Add Receipt"
2. Selects/takes a receipt photo
3. System [gets presigned URL](api.md#post-v1uploadspresigned-url), uploads image to R2/S3
4. After the upload succeeds, call [POST /v1/attachments](api.md#post-v1attachments) to create an attachment record
5. When creating the receipt, pass `attachmentIds` so the attachments are bound to the receipt
6. System automatically triggers OCR

See also: [Upload API](api.md#upload)

**Note:** Attachments that are not referenced by a receipt remain unbound; backend should periodically clean them up or offer a delete endpoint (TBD).

### 2. OCR Processing

OCR runs asynchronously. Frontend should poll until OCR completes (success or failure).

| ocrStatus    | UI                          | Action                                                 |
| ------------ | --------------------------- | ------------------------------------------------------ |
| `pending`    | Show "Queued" or spinner    | Wait, poll status                                      |
| `processing` | Show progress indicator     | Wait, poll status                                      |
| `completed`  | Show receipt items          | Proceed to verify                                      |
| `failed`     | Show error + "Retry" button | User can [re-trigger OCR](api.md#post-v1receiptsidocr) |

See also: [OCR API](api.md#ocr)

### 3. Verify Receipt Info (after OCR)

User reviews and edits OCR results via [PATCH /v1/items/:id](api.md#patch-v1itemsid).

**Editable fields:**

- Store name, address
- Receipt date
- Item details:
  - Name, quantity, unit price, total price
  - Discount, description, category
  - Tax exempt status (taxExempt)
  - Sort order (sortOrder)

**Notes:**

- Amounts are calculated from items automatically; users don't directly edit receipt's totalAmount
- If amount is incorrect, edit the corresponding item instead

### 4. Add Participants

1. Click "Add Participant"
2. User can either:
   - **Select existing**: Choose from historical participants list
   - **Create new**: Enter a new name
3. Participant appears in list

See also: [Participant API](api.md#participant)

### 5. Allocate

Assign participants to each item:

**Allocation types:**

- `equal` - Split equally
- `shares` - Split by shares (e.g., Alice 2, Bob 1)
- `custom` - Custom fixed amount per participant

**Steps:**

1. Select an item and choose participants + allocation rules.
2. When done with this item, save once via [PUT /v1/items/:id/allocations](api.md#put-v1itemsidallocations) to replace all allocations for the item (preferred to reduce requests).

See also: [Allocation API](api.md#allocation)

**Calculation:**

- Frontend only sends allocation rules
- Backend calculates each person's share automatically
- View summary anytime to confirm

**After adding allocation:**

- Frontend should update summary immediately
- Implement optimistic update: show calculated result locally, then refresh with actual backend data
- Frontend needs to replicate calculation logic for instant feedback

### 6. View Summary

Call [GET /v1/receipts/:id/summary](api.md#get-v1receiptsidsummary) to get allocation summary.

View summary including:

- Allocation details for each item
- Amount each person owes
- Totals

### 7. Delete Receipt (Optional)

User can delete a receipt and all related data (items, participants, allocations, attachments).

See also: [DELETE /v1/receipts/:id](api.md#delete-v1receiptsid)

---

## State Transitions

### ocrStatus State Machine

```
pending → processing → completed
                    → failed

OCR can be re-triggered on failed (POST /receipts/:id/ocr)
```

---

## MVP Scope

### Included

- Image upload
- OCR recognition (basic)
- Item editing
- Participant management
- Expense allocation
- Summary display

### Not Included

- Complex OCR scenarios
- Multi-language/multi-currency
- Expense history tracking
- Sharing/collaboration

---

## Future Iterations

- Settlement guidance (calculate transfers based on isPayer)
- Manual review for low-confidence OCR
- Bulk import/export
- Group ledgers
- Recurring bills
