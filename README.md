# Payments Tracker — Backend

Node.js + Express + Supabase REST API

---

## STEP 1 — Create a Supabase Project & Get Keys

### 1.1 Sign up / Log in
- Go to https://supabase.com
- Click "Start your project" → Sign in with GitHub or email

### 1.2 Create a new project
- Click "New project"
- Fill in:
  - Project name: `payments-tracker`
  - Database password: (save this somewhere safe)
  - Region: choose closest to you (e.g. South Asia for India)
- Click "Create new project"
- Wait ~2 minutes for it to provision

### 1.3 Get your API keys (THIS IS WHERE YOU GET THE KEYS)
- In your project dashboard, click the ⚙️ Settings icon (left sidebar)
- Click "API" under Configuration
- You will see:

```
Project URL
  → https://abcdefghijk.supabase.co
  → This is your SUPABASE_URL

Project API Keys
  → anon / public    → This is your SUPABASE_ANON_KEY
  → service_role     → This is your SUPABASE_SERVICE_ROLE_KEY
                       (click the eye icon to reveal it)
```

⚠️  IMPORTANT:
  - anon key = safe for frontend (limited access, respects RLS)
  - service_role key = NEVER expose to frontend, backend only
  - service_role key bypasses all RLS policies

---

## STEP 2 — Run the Database Schema

### 2.1 Open SQL Editor
- In Supabase dashboard, click "SQL Editor" in the left sidebar
- Click "New query"

### 2.2 Run the schema
- Open the file `schema.sql` from this project
- Paste the ENTIRE contents into the SQL Editor
- Click "Run" (green button)
- You should see: "Success. No rows returned"

### 2.3 Verify tables were created
- Click "Table Editor" in the left sidebar
- You should see 3 tables:
  - `users`
  - `purchase_orders`
  - `payments`

---

## STEP 3 — Configure the Backend

### 3.1 Copy env file
```bash
cp .env.example .env
```

### 3.2 Edit .env with your actual values
```
PORT=5000
SUPABASE_URL=https://your-actual-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
FRONTEND_URL=http://localhost:5173
```

---

## STEP 4 — Install & Run

```bash
# Install dependencies
npm install

# Run in development mode (auto-restarts on changes)
npm run dev

# Run in production mode
npm start
```

You should see:
```
  ✅  Payments Tracker API running
  🚀  http://localhost:5000
  🏥  http://localhost:5000/health
```

Test it:
```bash
curl http://localhost:5000/health
# Should return: {"status":"ok","service":"payments-tracker-api",...}
```

---

## STEP 5 — Create Test Users

Use the API to register an admin and an accountant:

```bash
# Register Admin
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123","name":"Admin User","role":"admin"}'

# Register Accountant
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"accountant@test.com","password":"acc123","name":"Accountant User","role":"accountant"}'
```

---

## DATABASE TABLES

### Table: users
| Column     | Type        | Description                         |
|------------|-------------|-------------------------------------|
| id         | UUID (PK)   | Matches Supabase auth.users id      |
| email      | TEXT        | Unique email address                |
| name       | TEXT        | Display name                        |
| role       | TEXT        | 'admin' or 'accountant'             |
| created_at | TIMESTAMPTZ | Auto-set on insert                  |

### Table: purchase_orders
| Column        | Type         | Description                          |
|---------------|--------------|--------------------------------------|
| id            | UUID (PK)    | Auto-generated                       |
| po_number     | TEXT         | Unique e.g. PO-2024-001              |
| vendor_name   | TEXT         | Vendor/supplier name                 |
| total_amount  | NUMERIC(14,2)| Max budget for this PO               |
| payment_terms | TEXT         | e.g. "Net 30, 50% advance"           |
| created_by    | UUID (FK)    | References users.id                  |
| created_at    | TIMESTAMPTZ  | Auto-set on insert                   |

### Table: payments
| Column          | Type         | Description                        |
|-----------------|--------------|-------------------------------------|
| id              | UUID (PK)    | Auto-generated                      |
| po_id           | UUID (FK)    | References purchase_orders.id       |
| type            | TEXT         | 'Advance', 'Final', or 'Partial'    |
| amount          | NUMERIC(14,2)| Payment amount                      |
| due_date        | DATE         | Payment due date (YYYY-MM-DD)       |
| status          | TEXT         | 'Pending' → 'Approved' → 'Paid'     |
| utr             | TEXT         | Bank transaction ref (set when Paid)|
| vendor_notified | BOOLEAN      | Whether vendor was informed         |
| approved_by     | UUID (FK)    | Admin who approved (references users)|
| approved_at     | TIMESTAMPTZ  | When approval happened              |
| paid_at         | TIMESTAMPTZ  | When payment was marked Paid        |
| created_by      | UUID (FK)    | Who created this payment            |
| created_at      | TIMESTAMPTZ  | Auto-set on insert                  |

---

## API ENDPOINTS REFERENCE

### Auth
| Method | URL                    | Description              | Auth needed |
|--------|------------------------|--------------------------|-------------|
| POST   | /api/auth/register     | Create user with role    | No          |
| POST   | /api/auth/login        | Get JWT token            | No          |
| GET    | /api/auth/me           | Get current user profile | Yes         |

### Purchase Orders
| Method | URL                         | Description           | Role        |
|--------|-----------------------------|-----------------------|-------------|
| GET    | /api/purchase-orders        | List all POs          | Any         |
| POST   | /api/purchase-orders        | Create PO             | Any         |
| GET    | /api/purchase-orders/:id    | Get PO + payments     | Any         |
| PUT    | /api/purchase-orders/:id    | Update PO             | Any         |
| DELETE | /api/purchase-orders/:id    | Delete PO             | Admin only  |

### Payments
| Method | URL                            | Description                  | Role             |
|--------|--------------------------------|------------------------------|------------------|
| GET    | /api/payments                  | List all (filterable)        | Any              |
| POST   | /api/payments                  | Create payment               | Any              |
| GET    | /api/payments/:id              | Get single payment           | Any              |
| PATCH  | /api/payments/:id/approve      | Pending → Approved           | Admin only       |
| PATCH  | /api/payments/:id/pay          | Approved → Paid (needs UTR)  | Accountant/Admin |
| PATCH  | /api/payments/:id/notify       | Mark vendor notified         | Accountant/Admin |
| DELETE | /api/payments/:id              | Delete (Pending only)        | Admin only       |

### Upload
| Method | URL                          | Description              | Role |
|--------|------------------------------|--------------------------|------|
| GET    | /api/upload/template         | Download sample CSV      | Any  |
| POST   | /api/upload/bulk-payments    | Upload CSV/Excel         | Any  |

### Query Parameters for GET /api/payments
- `?status=Pending`    filter by status
- `?status=Approved`
- `?status=Paid`
- `?po_id=uuid`        filter by PO
- `?type=Advance`      filter by type
- `?overdue=true`      only overdue payments

---

## BULK UPLOAD CSV FORMAT

Required columns (case-sensitive):
```
po_number,type,amount,due_date
PO-2024-001,Advance,50000,2024-03-01
PO-2024-001,Final,100000,2024-05-01
```

- `po_number` — must match an existing PO in the database
- `type`      — must be exactly: Advance, Final, or Partial
- `amount`    — number, no commas or currency symbols
- `due_date`  — YYYY-MM-DD format

See `sample_payments.csv` for a working example.

---

## PROJECT STRUCTURE

```
src/
├── config/
│   └── supabase.js          # Supabase client setup (admin + user)
├── middleware/
│   ├── auth.js              # JWT verification + role guard
│   └── errorHandler.js      # Global error handler
├── routes/
│   ├── auth.js              # Login, register, me
│   ├── purchaseOrders.js    # PO CRUD
│   ├── payments.js          # Payment lifecycle
│   └── upload.js            # Bulk CSV/Excel import
└── index.js                 # Express app entry point
```
