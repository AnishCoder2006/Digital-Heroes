# Digital Heroes — Backend API Specification (Semester 5)

This document describes the audit, ledger verification, and searchable encrypted donation APIs built for **Digital Heroes** (Semester 5 Backend).

All monetary values at the API boundary are formatted in **whole paise** (e.g. ₹49.90 = `4990` paise) to prevent floating-point precision issues across clients. All endpoints return errors in a uniform JSON format: `{"error": "string"}`.

---

## 1. Authentication & Role Model

| Role | Access Level | Description |
|---|---|---|
| `public` | Unauthenticated | Anyone (visitors, donors, researchers). Can audit charity totals and verify the ledger chain. |
| `subscriber` | Authenticated | Signed-in player. Can view personal contributions and Stableford scores. |
| `auditor` | Privileged | Authorized compliance auditor. Can search donor records via blinded keyword tokens. |
| `admin` | Privileged | Platform administrator. Can execute draws, manage charities, and search donor records. |

Guards:
* Server Actions/Components: `requireRole(allowedRoles)` redirects to `/login` if unauthenticated and `/dashboard` if unauthorized.
* Route Handlers: `authorizeApiRole(allowedRoles)` returns `401 {"error": "Please log in first."}` or `403 {"error": "Forbidden: insufficient permissions."}`.

---

## 2. API Endpoints

### 2.1 Public Charity Audit
* **Path:** `GET /api/audit/charities`
* **Access:** Anyone (Public)
* **Purpose:** Allows anyone to verify that the total funds recorded in the append-only ledger match the contribution records for each charity.

#### Example Response (`200 OK`)
```json
{
  "charities": [
    {
      "id": "7bfa1689-f542-4b2a-bf34-a7de5094cf54",
      "name": "Bright Slates Foundation",
      "ledgerTotal": 14970,
      "contributionTotal": 14970,
      "status": "ok"
    },
    {
      "id": "e2920251-1cb1-40ef-8bb4-da486749e7b2",
      "name": "Green Roots Trust",
      "ledgerTotal": 9980,
      "contributionTotal": 9980,
      "status": "ok"
    }
  ]
}
```
*If a database entry is tampered with or amounts diverge, `"status"` reports `"mismatch"`.*

---

### 2.2 Public Ledger Chain Verification
* **Path:** `GET /api/audit/verify`
* **Access:** Anyone (Public)
* **Purpose:** Walks the entire SHA-256 hash chain in `ledger_entries` from genesis (`prev_hash` = 64 zeros) to the tip, recomputing every canonical entry hash to confirm zero tampering and sequence continuity.

#### Example Response — Valid Chain (`200 OK`)
```json
{
  "ok": true,
  "entriesVerified": 24,
  "latestEntryHash": "c4d59f31abf59c87422f1c3a6476106607e155bc81db1eeaaae8730b205315ff"
}
```

#### Example Response — Tampered Chain (`200 OK`)
```json
{
  "ok": false,
  "brokenSequence": 5,
  "reason": "entry_hash_tampered",
  "latestEntryHash": "c4d59f31abf59c87422f1c3a6476106607e155bc81db1eeaaae8730b205315ff"
}
```

---

### 2.3 User Personal Contributions
* **Path:** `GET /api/me/contributions`
* **Access:** Signed-in `subscriber`
* **Purpose:** Returns the calling subscriber's own contributions linked to the tamper-evident ledger.

#### Example Response (`200 OK`)
```json
{
  "contributions": [
    {
      "id": "6735bead-3ff5-408a-b8cb-46487e35b7e9",
      "charity": "Bright Slates Foundation",
      "amount": 4990,
      "date": "2026-11-24T12:00:00.000Z",
      "entryHash": "5a42db4d445353d2bfd12f3ce48eb9ecde8ad96ad0153be0a41d7d6f51fefee8",
      "sequenceNumber": 1
    }
  ]
}
```

---

### 2.4 Searchable Encrypted Donations Lookup
* **Path:** `GET /api/admin/donations/search?q=<keyword>`
* **Access:** `admin` or `auditor`
* **Purpose:** Allows authorized compliance officers to search encrypted donor records by keyword (donor name, email address, domain).
* **Privacy & Security:**
  * Raw keywords are **never** stored in Postgres.
  * Keywords are converted server-side into HMAC-SHA256 blind tokens using an index key derived from `ENC_MASTER_KEY` via HKDF.
  * Matching contribution records store donor identity in `donation_records_enc` encrypted under AES-256-GCM.
  * If ciphertext is modified in the database, AES-GCM authentication fails, and the endpoint returns `[Decryption Failed - Tampered]` without leaking raw data or crashing.

#### Example Request
```http
GET /api/admin/donations/search?q=priya
Cookie: sb-...
```

#### Example Response (`200 OK`)
```json
{
  "query": "priya",
  "count": 1,
  "results": [
    {
      "contributionId": "6735bead-3ff5-408a-b8cb-46487e35b7e9",
      "donorName": "Priya Sharma",
      "donorEmail": "priya@example.com",
      "charity": "Bright Slates Foundation",
      "amount": 4990,
      "date": "2026-11-24T12:00:00.000Z"
    }
  ]
}
```

#### Unauthorized Caller (`403 Forbidden`)
```json
{
  "error": "Forbidden: insufficient permissions."
}
```

---

## 3. Cryptographic Design & Base Paper Alignment

This implementation is aligned with the architecture of:
> **He, Feng, Fang, Liu, and Su**, *"A Secure and Efficient Charitable Donation System Based on Ethereum Blockchain and Searchable Encryption"*, **IEEE Transactions on Consumer Electronics**, vol. 70, no. 1, pp. 263-276, 2024.

* **Semester 5 (Current):**
  * PostgreSQL append-only hash-linked ledger (`ledger_entries`) with row-level transaction locks and immutability triggers rejecting `UPDATE`/`DELETE`.
  * User pseudonymization: `user_id_hash` stored as `HMAC-SHA256(LEDGER_SALT, user_id)`.
  * Searchable encryption: Deterministic HMAC keyword index (`donation_search_index`) combined with AES-256-GCM authenticated donor record encryption (`donation_records_enc`).
* **Semester 6 (Next):**
  * Periodic anchor checkpoints of the ledger tip (`latestEntryHash`) committed to an Ethereum testnet smart contract.
  * Transition to asymmetric pairing-based Public Key Encryption with Keyword Search (PEKS) with verifiable lucky draws.
