# BankFlow — Transaction-Safe Digital Banking Demo

A portfolio project demonstrating backend engineering concepts used in financial applications:
- JWT authentication and password hashing
- PostgreSQL relational data modelling
- Double-entry ledger
- Atomic transfers using database transactions
- Idempotency keys to prevent duplicate transfers
- Input validation and centralised error handling
- API tests and a React frontend

> Educational portfolio application only. It does not connect to real banks, move real money, or implement production-grade banking security/compliance. Use fictional accounts and data.

## Architecture

- `client/`: React + Vite frontend
- `server/`: Node.js + Express REST API
- `database/`: PostgreSQL schema and seed data
- `docker-compose.yml`: local PostgreSQL instance

## Requirements

- Node.js 20+
- Docker Desktop (recommended) or PostgreSQL 15+
- npm

## 1. Start PostgreSQL

From the project root:

```bash
docker compose up -d
```

The database is exposed locally on port `5433` to avoid colliding with an existing PostgreSQL installation.

## 2. Configure and start the backend

```bash
cd server
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Backend: `https://bankflow-l6jc.onrender.com`

The database setup script creates the tables and a demo user:
- Email: `demo@bankflow.local`
- Password: `BankFlow123!`

The seed account starts with a fictional balance of ₹25,000.00.

## 3. Start the frontend

Open another terminal:

```bash
cd client
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## 4. Run tests

With PostgreSQL running and the backend `.env` configured:

```bash
cd server
npm test
```

The integration tests use the configured database. Run them against a disposable local database, not a database containing important data.

## Main API routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/accounts/me` | Current account |
| GET | `/api/transactions` | Ledger-backed transaction history |
| POST | `/api/transfers` | Transfer funds (requires `Idempotency-Key`) |
| GET | `/api/health` | Health check |

### Transfer request

`POST /api/transfers`

Header:
```text
Authorization: Bearer <token>
Idempotency-Key: <unique-client-generated-key>
```

Body:
```json
{
  "toAccountNumber": "BF00000002",
  "amount": 250,
  "description": "Rent share"
}
```

Amounts are accepted in rupees with up to two decimal places. Internally, values are stored as integer paise to avoid floating-point arithmetic.

## Engineering notes

### Double-entry ledger
Every successful transfer creates two ledger entries in one database transaction:
- Debit from the sender
- Credit to the recipient

The account balance is updated in the same transaction. If any step fails, PostgreSQL rolls back the entire operation.

### Concurrency and consistency
The transfer implementation locks the sender and recipient account rows in a deterministic order using `SELECT ... FOR UPDATE`. It then checks the available balance and performs the debit, credit and ledger inserts atomically.

### Idempotency
Each transfer request must include an `Idempotency-Key`. The key is stored with the completed transfer. Repeating the same key returns the original result instead of moving money again. Reusing the key with a different request body returns a conflict.

### Important limitations
This is a learning project, not production banking software. A production system would need, among other things:
- Stronger identity verification, MFA and device/risk controls
- Secrets management, key rotation, audit monitoring and alerting
- Rate limiting, fraud detection and transaction limits
- Reconciliation, dispute handling and operational controls
- Regulatory, privacy, security and compliance reviews
- Robust idempotency lifecycle and distributed-system design

## Suggested customisation before publishing

1. Change the branding, typography and dashboard layout.
2. Add a transaction detail view and downloadable statement.
3. Add unit tests for validation and ledger invariants.
4. Add CI with GitHub Actions.
5. Record a short demo showing a successful transfer, insufficient funds and duplicate request handling.

## Suggested resume description (only after implementation and verification)

**BankFlow — Transaction-Safe Digital Banking Platform**  
React, Node.js, Express, PostgreSQL, JWT

- Built a full-stack banking simulation with authenticated accounts, REST APIs and transaction history.
- Implemented atomic fund transfers using PostgreSQL transactions and row-level locking, maintaining consistent balances and double-entry ledger records.
- Added idempotency-key handling to prevent duplicate transfers on request retries, with API validation and integration tests.
