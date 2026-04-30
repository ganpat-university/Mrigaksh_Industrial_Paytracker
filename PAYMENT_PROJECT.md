# PayTrack — Payments Tracker System

> **Project Context Document**
> Last Updated: 2026-04-27
> Purpose: Complete project reference for AI-assisted development (Claude Opus / Copilot)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Tech Stack & Libraries](#3-tech-stack--libraries)
4. [Core Modules](#4-core-modules)
5. [Database Schema](#5-database-schema)
6. [Authentication & Role-Based Access Control](#6-authentication--role-based-access-control)
7. [Payment Lifecycle & Business Rules](#7-payment-lifecycle--business-rules)
8. [API Reference](#8-api-reference)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Bulk Upload Module](#10-bulk-upload-module)
11. [Vendor System](#11-vendor-system)
12. [Environment Variables & Configuration](#12-environment-variables--configuration)
13. [Project File Structure](#13-project-file-structure)
14. [Deployment](#14-deployment)
15. [Development Roadmap](#15-development-roadmap)
16. [Code Conventions & Rules for Claude Opus](#16-code-conventions--rules-for-claude-opus)

---

## 1. Project Overview

### What is PayTrack?

**PayTrack** is a full-stack **Payment Lifecycle Management System** designed to track payments against purchase orders (POs), enforce an approval workflow, and notify vendors when payments are processed. It implements role-based access control with four distinct user roles.

### Core Purpose

Manage the entire lifecycle of vendor payments — from purchase order creation, through multi-step approval (Admin → Accountant → Vendor notification), to audit-ready records with UTR (Unique Transaction Reference) tracking.

### Real-World Use Cases

| Use Case | Description |
|---|---|
| **Enterprise Accounts Payable** | Track all vendor payments against approved purchase orders with budget enforcement |
| **Payment Approval Workflows** | Admins approve payments, accountants execute them — separation of duties |
| **Vendor Self-Service Portal** | Vendors log in and see only payments that concern them — no access to internal financial data |
| **Budget Control** | Total payments against a PO can never exceed the PO's budgeted amount |
| **Audit Trail** | Every payment records who created it, who approved it, when it was paid, and the bank UTR reference |
| **Bulk Payment Import** | Upload CSV/Excel files to create hundreds of payments at once with per-row validation |
| **Overdue Tracking** | Payments past their due date are automatically flagged as overdue |

### Project Scope (This Implementation)

- **4-role RBAC system**: Admin, Accountant, User, Vendor
- **Purchase Order management**: CRUD with budget tracking
- **Payment lifecycle**: Pending → Approved (admin) → Paid (accountant with UTR) → Vendor Notified
- **Vendor isolation**: Vendors see ONLY their own paid+notified payments — no access to POs, payments list, or financial data
- **Bulk CSV/Excel upload**: Upload payments en masse with row-level validation and budget enforcement
- **Supabase** for auth (JWT) + PostgreSQL database with Row Level Security
- **Node.js / Express** backend REST API
- **React 19 / Vite 8** frontend SPA with role-based dashboard routing
- **Deployed**: Frontend on Vercel, Backend on Render/Railway

---

## 2. System Architecture

### End-to-End Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       PAYTRACK SYSTEM ARCHITECTURE                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐    HTTPS     ┌──────────────┐    Supabase     ┌────────┐  │
│   │  Frontend    │◄───────────►│  Backend     │◄──────────────►│  Supa  │  │
│   │  React 19    │             │  Express.js  │    JS Client    │  base  │  │
│   │  + Vite 8    │             │              │                 │        │  │
│   │              │             │  Routes:     │                 │ Auth   │  │
│   │  Pages:      │             │  • auth      │                 │ (JWT)  │  │
│   │  • Login     │             │  • POs       │                 │        │  │
│   │  • Register  │             │  • payments  │                 │ Postgre│  │
│   │  • Admin     │             │  • upload    │                 │ SQL DB │  │
│   │    Dashboard │             │  • vendor    │                 │        │  │
│   │  • Accountant│             │              │                 │ RLS    │  │
│   │    Dashboard │             │  Middleware:  │                 │ Enabled│  │
│   │  • User      │             │  • auth.js   │                 │        │  │
│   │    Dashboard │             │  • blockVendor│                │        │  │
│   │  • Vendor    │             │  • errorHandler│               │        │  │
│   │    Dashboard │             │              │                 │        │  │
│   │              │             │              │                 │        │  │
│   │  Vercel CDN  │             │  Render /    │                 │ Cloud  │  │
│   │              │             │  Railway     │                 │ Hosted │  │
│   └─────────────┘             └──────────────┘                 └────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Request Flow (Step-by-Step)

```
User clicks "Approve Payment" in Admin Dashboard
       │
       ▼
React calls api.approvePayment(id)
  → axios PATCH /api/payments/:id/approve
  → Authorization: Bearer <Supabase JWT>
       │
       ▼
Express middleware chain:
  1. authenticate()     → Supabase auth.getUser(token) → verify JWT
                        → Fetch user profile from public.users table
                        → Attach { id, name, email, role } to req.user
  2. blockVendor()      → If role === 'vendor' → 403 denied
  3. requireRole('admin') → If role !== 'admin' → 403 denied
       │
       ▼
Route handler:
  1. Fetch payment from Supabase → check status === 'Pending'
  2. Update status → 'Approved', set approved_by, approved_at
  3. Return updated payment with PO details
       │
       ▼
React updates UI → payment row turns from "Pending" to "Approved"
```

---

## 3. Tech Stack & Libraries

### Backend (Node.js 18+)

| Library | Version | Purpose |
|---|---|---|
| `express` | ^4.18.2 | Web framework for REST API |
| `@supabase/supabase-js` | ^2.39.0 | Supabase client (auth + DB queries) |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing |
| `dotenv` | ^16.3.1 | Load `.env` variables |
| `express-validator` | ^7.0.1 | Request validation (available but validation done manually) |
| `multer` | ^1.4.5-lts.1 | Multipart file upload handling (CSV/Excel) |
| `csv-parse` | ^5.5.3 | CSV file parsing (synchronous mode) |
| `xlsx` | ^0.18.5 | Excel file parsing (.xlsx, .xls) |
| `nodemon` | ^3.0.2 | Dev-only auto-restart on file changes |

### Frontend (React 19 + Vite 8)

| Library | Version | Purpose |
|---|---|---|
| `react` | ^19.2.4 | UI component library |
| `react-dom` | ^19.2.4 | DOM rendering |
| `react-router-dom` | ^7.13.1 | Client-side routing (Login, Register, Dashboard) |
| `axios` | ^1.13.6 | HTTP client with interceptors for JWT |
| `vite` | ^8.0.1 | Build tool & dev server |
| `@vitejs/plugin-react` | ^6.0.1 | React JSX + HMR support |
| `eslint` | ^9.39.4 | Code linting |

### Infrastructure & Services

| Service | Purpose |
|---|---|
| **Supabase** | Auth (JWT tokens), PostgreSQL database, Row Level Security |
| **Vercel** | Frontend static hosting with CDN |
| **Render / Railway** | Backend Node.js deployment |
| **GitHub** | Version control |

---

## 4. Core Modules

### 4.1 `backend/src/index.js` — Express Application Entry Point

**Responsibility:** Creates the Express app, configures middleware, and mounts all route blueprints.

- Configures CORS (localhost:5173, localhost:3000, FRONTEND_URL from .env)
- JSON body parser (10MB limit)
- Request logger (timestamp + method + path)
- Mounts 5 route groups at `/api/*`
- Health check at `/health`
- 404 handler + global error handler

### 4.2 `backend/src/config/supabase.js` — Supabase Client Setup

**Responsibility:** Exports two Supabase client instances.

| Client | Key Used | Purpose |
|---|---|---|
| `supabaseAdmin` | `SERVICE_ROLE_KEY` | Full DB access, bypasses RLS. Used for all backend operations. |
| `supabaseUser(token)` | `ANON_KEY` + user JWT | Respects RLS policies. Available for future use. |

### 4.3 `backend/src/middleware/auth.js` — Authentication & Authorization

**Responsibility:** JWT verification and role-based access control.

| Middleware | Purpose |
|---|---|
| `authenticate` | Verifies Supabase JWT via `auth.getUser(token)`, fetches user profile from `public.users`, attaches `req.user` |
| `requireRole(...roles)` | Checks `req.user.role` against allowed roles, returns 403 if unauthorized |
| `blockVendor` | Specifically blocks vendor role from accessing internal financial routes (POs, payments list) |

### 4.4 `backend/src/middleware/errorHandler.js` — Global Error Handler

**Responsibility:** Catches unhandled errors, provides structured JSON error responses.

- Handles Multer file size errors (`LIMIT_FILE_SIZE`)
- Handles Multer unexpected field errors
- Returns generic 500 for all other errors

### 4.5 `backend/src/routes/auth.js` — Authentication Routes

**Responsibility:** User registration, login, profile, and admin user management.

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/auth/register` | POST | Public | Create user with role (only `user` or `vendor` allowed via self-registration) |
| `/api/auth/login` | POST | Public | Sign in with email/password → returns JWT + user profile |
| `/api/auth/me` | GET | Authenticated | Get current user's profile (id, name, email, role) |
| `/api/auth/users` | GET | Admin only | Paginated list of all users |
| `/api/auth/role/:id` | PATCH | Admin only | Update a user's role (upserts into public.users) |

### 4.6 `backend/src/routes/purchaseOrders.js` — Purchase Order CRUD

**Responsibility:** Full CRUD for purchase orders with payment summary enrichment.

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/purchase-orders` | GET | Authenticated (non-vendor) | Paginated list with computed payment summary (allocated, paid, remaining, counts) |
| `/api/purchase-orders` | POST | Authenticated (non-vendor) | Create PO (validates unique po_number, positive amount) |
| `/api/purchase-orders/:id` | GET | Authenticated (non-vendor) | Single PO with all payments (each marked overdue if applicable) |
| `/api/purchase-orders/:id` | PUT | Authenticated (non-vendor) | Update PO (cannot reduce total below already-allocated amount) |
| `/api/purchase-orders/:id` | DELETE | Admin only | Delete PO (only if zero payments exist) |

**Key business logic:** Every GET enriches POs with computed fields:
- `payment_count` — total payments under this PO
- `allocated_amount` — sum of all payment amounts
- `paid_amount` — sum of only Paid payment amounts
- `remaining_amount` — PO total minus allocated
- `pending_count` / `approved_count` — status breakdowns

### 4.7 `backend/src/routes/payments.js` — Payment Lifecycle

**Responsibility:** Full payment lifecycle management with strict state machine rules.

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/payments` | GET | Authenticated (non-vendor) | Paginated list, filterable by status/po_id/type/overdue |
| `/api/payments` | POST | Authenticated (non-vendor) | Create payment (validates budget against PO total) |
| `/api/payments/:id` | GET | Authenticated (non-vendor) | Single payment detail |
| `/api/payments/:id/approve` | PATCH | Admin only | Pending → Approved (sets approved_by, approved_at) |
| `/api/payments/:id/pay` | PATCH | Accountant or Admin | Approved → Paid (requires UTR string, sets paid_at) |
| `/api/payments/:id/notify` | PATCH | Accountant or Admin | Mark vendor as notified (vendor_notified = true) |
| `/api/payments/:id` | DELETE | Admin only | Delete only Pending payments |

### 4.8 `backend/src/routes/upload.js` — Bulk Import

**Responsibility:** CSV/Excel file upload for bulk payment creation.

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/upload/template` | GET | Authenticated | Downloads sample CSV template |
| `/api/upload/bulk-payments` | POST | Authenticated | Upload CSV/Excel → validates each row → bulk inserts valid payments |

### 4.9 `backend/src/routes/vendor.js` — Vendor Portal

**Responsibility:** Vendor-only endpoints — completely isolated from internal financial data.

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/vendor/my-notifications` | GET | Vendor only | Paginated list of Paid + vendor_notified payments linked to the vendor by name |

### 4.10 `backend/scripts/seed_admin.js` — Admin Seeder

**Responsibility:** Creates the initial admin user in Supabase Auth + public.users.

- Default: `admin@payments.com` / `SecurePassword123!`
- Uses Supabase admin API (`auth.admin.createUser`)
- Upserts into `public.users` table

---

## 5. Database Schema

### Supabase PostgreSQL — 3 Tables

#### Table: `users`

```sql
CREATE TABLE public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'user'
                          CHECK (role IN ('admin', 'accountant', 'user', 'vendor')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Table: `purchase_orders`

```sql
CREATE TABLE public.purchase_orders (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number      TEXT           NOT NULL UNIQUE,
  vendor_name    TEXT           NOT NULL,
  total_amount   NUMERIC(14,2)  NOT NULL CHECK (total_amount > 0),
  payment_terms  TEXT           NOT NULL,
  created_by     UUID           REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
```

#### Table: `payments`

```sql
CREATE TABLE public.payments (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id            UUID          NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  type             TEXT          NOT NULL CHECK (type IN ('Advance', 'Final', 'Partial')),
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  due_date         DATE          NOT NULL,
  status           TEXT          NOT NULL DEFAULT 'Pending'
                                 CHECK (status IN ('Pending', 'Approved', 'Paid')),
  utr              TEXT,
  vendor_notified  BOOLEAN       NOT NULL DEFAULT FALSE,
  approved_by      UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  paid_at          TIMESTAMPTZ,
  created_by       UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

### Entity Relationship

```
┌──────────────────┐            ┌────────────────────┐            ┌──────────────┐
│     users        │            │  purchase_orders   │            │   payments   │
├──────────────────┤            ├────────────────────┤            ├──────────────┤
│ id (PK, UUID)    │◄───────────│ created_by (FK)    │            │ id (PK)      │
│ email            │            │ id (PK, UUID)      │◄───────────│ po_id (FK)   │
│ name             │            │ po_number (UNIQUE)  │            │ type         │
│ role             │◄───────────│ vendor_name        │            │ amount       │
│ created_at       │            │ total_amount       │            │ due_date     │
└──────────────────┘            │ payment_terms      │            │ status       │
                                │ created_at         │            │ utr          │
                                └────────────────────┘            │vendor_notified│
                                                                  │ approved_by  │
                                                                  │ approved_at  │
                                                                  │ created_by   │
                                                                  │ paid_at      │
                                                                  │ created_at   │
                                                                  └──────────────┘
```

### Indexes

```sql
CREATE INDEX idx_payments_po_id     ON payments(po_id);
CREATE INDEX idx_payments_status    ON payments(status);
CREATE INDEX idx_payments_due_date  ON payments(due_date);
CREATE INDEX idx_po_po_number       ON purchase_orders(po_number);
```

### Row Level Security (RLS)

All three tables have RLS enabled. Policies allow all authenticated users to SELECT, INSERT, UPDATE, and DELETE — the backend middleware handles fine-grained role checks. The RLS policies are a safety net:

```sql
-- All authenticated users can read
CREATE POLICY "read_users"    ON users            FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_po"       ON purchase_orders  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_payments" ON payments         FOR SELECT USING (auth.role() = 'authenticated');

-- Users can only update their own profile
CREATE POLICY "update_own_user" ON users FOR UPDATE USING (auth.uid() = id);
```

### Auto-User Trigger

A PostgreSQL trigger auto-creates a `public.users` row when a new user signs up via Supabase Auth:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## 6. Authentication & Role-Based Access Control

### Authentication Flow

```
1. POST /api/auth/register
   → supabaseAdmin.auth.admin.createUser({ email, password, user_metadata: { name, role } })
   → Upsert public.users profile
   → Return user info (no auto-login)

2. POST /api/auth/login
   → supabaseAdmin.auth.signInWithPassword({ email, password })
   → Return { token (Supabase JWT), refresh_token, user: { id, email, name, role } }

3. Frontend stores token in localStorage
   → axios interceptor adds Authorization: Bearer <token> to every request

4. Backend authenticate() middleware:
   → supabaseAdmin.auth.getUser(token) → verifies JWT
   → Fetches { id, name, email, role } from public.users
   → Attaches to req.user

5. On 401 response → axios interceptor clears localStorage → redirects to /login
```

### Role Hierarchy & Permissions

| Permission | Admin | Accountant | User | Vendor |
|---|:---:|:---:|:---:|:---:|
| View POs | ✅ | ✅ | ✅ | ❌ |
| Create POs | ✅ | ✅ | ✅ | ❌ |
| Update POs | ✅ | ✅ | ✅ | ❌ |
| Delete POs | ✅ | ❌ | ❌ | ❌ |
| View all payments | ✅ | ✅ | ✅ | ❌ |
| Create payments | ✅ | ✅ | ✅ | ❌ |
| **Approve** payments | ✅ | ❌ | ❌ | ❌ |
| **Mark Paid** (with UTR) | ✅ | ✅ | ❌ | ❌ |
| **Notify Vendor** | ✅ | ✅ | ❌ | ❌ |
| Delete payments | ✅ (Pending only) | ❌ | ❌ | ❌ |
| View all users | ✅ | ❌ | ❌ | ❌ |
| Change user roles | ✅ | ❌ | ❌ | ❌ |
| Upload CSV/Excel | ✅ | ✅ | ✅ | ❌ |
| View vendor notifications | ❌ | ❌ | ❌ | ✅ |

### Vendor Isolation — The `blockVendor` Middleware

Vendors are explicitly blocked from all internal routes:

```javascript
// Applied globally to /api/purchase-orders and /api/payments
router.use(blockVendor);

// blockVendor checks:
if (req.user.role === 'vendor') {
  return res.status(403).json({
    error: 'Access denied. Vendors cannot access internal payment data.'
  });
}
```

Vendors can ONLY access `/api/vendor/my-notifications`.

### Self-Registration Role Restriction

The register endpoint only allows `user` or `vendor` roles:

```javascript
if (!['user', 'vendor'].includes(role)) {
  return res.status(400).json({ error: 'role must be "user" or "vendor"' });
}
```

Admin and accountant roles can only be assigned by an existing admin via `PATCH /api/auth/role/:id`.

---

## 7. Payment Lifecycle & Business Rules

### State Machine

```
                              Admin approves
    ┌──────────┐    ─────────────────────────►    ┌──────────┐
    │ PENDING  │                                   │ APPROVED │
    └──────────┘    ◄─────────────── ✗ ────────── └──────────┘
         │                (cannot un-approve)            │
         │                                               │
         │ Admin can                        Accountant/Admin
         │ DELETE only                      marks PAID + UTR
         │ Pending payments                              │
         ▼                                               ▼
    ┌──────────┐                                  ┌──────────┐
    │ DELETED  │                                  │   PAID   │
    └──────────┘                                  └──────────┘
                                                       │
                                              Accountant/Admin
                                              marks vendor_notified
                                                       │
                                                       ▼
                                                ┌──────────────┐
                                                │ VENDOR       │
                                                │ NOTIFIED     │
                                                └──────────────┘
```

### Critical Business Rules

| Rule | Enforcement | Location |
|---|---|---|
| **Budget cap** | Sum of all payments under a PO cannot exceed PO `total_amount` | `POST /payments` + `POST /upload/bulk-payments` |
| **Approval required** | Cannot mark Paid without prior Approved status | `PATCH /payments/:id/pay` |
| **UTR required for Paid** | `utr` string must be non-empty when marking Paid | `PATCH /payments/:id/pay` |
| **Only Pending deletable** | Approved or Paid payments cannot be deleted | `DELETE /payments/:id` |
| **PO delete guard** | Cannot delete PO with existing payments | `DELETE /purchase-orders/:id` |
| **PO total floor** | Cannot reduce PO total_amount below already allocated sum | `PUT /purchase-orders/:id` |
| **Vendor name match** | Vendor notifications matched by `vendor_name` to user `name` (case-insensitive `ilike`) | `GET /vendor/my-notifications` |
| **Overdue computation** | `is_overdue = (due_date < today && status !== 'Paid')` — computed per response | `GET /payments`, `GET /purchase-orders/:id` |

---

## 8. API Reference

### Base URL

```
Local:      http://localhost:5000/api
Production: https://<render-or-railway-url>/api
Health:     GET /health → { "status": "ok", "service": "payments-tracker-api" }
```

### Authentication

#### POST `/api/auth/register`
```json
// Request
{ "email": "john@test.com", "password": "pass123", "name": "John Doe", "role": "user" }

// Response 201
{ "message": "User registered successfully", "user": { "id": "uuid", "email": "...", "name": "...", "role": "user" } }
```

#### POST `/api/auth/login`
```json
// Request
{ "email": "john@test.com", "password": "pass123" }

// Response 200
{
  "token": "eyJhbGci...",
  "refresh_token": "...",
  "user": { "id": "uuid", "email": "...", "name": "John Doe", "role": "user" }
}
```

#### GET `/api/auth/me`
```
Headers: Authorization: Bearer <JWT>
// Response 200
{ "user": { "id": "uuid", "name": "John", "email": "...", "role": "user" } }
```

#### GET `/api/auth/users` (Admin only)
```
Query: ?page=1&limit=10
// Response 200
{ "data": [...users], "total": 42, "page": 1, "limit": 10, "totalPages": 5 }
```

#### PATCH `/api/auth/role/:id` (Admin only)
```json
// Request
{ "role": "accountant" }
// Response 200
{ "message": "User role updated successfully", "user": { ... } }
```

### Purchase Orders

#### GET `/api/purchase-orders`
```
Query: ?page=1&limit=10
// Response 200 — each PO enriched with computed payment summary
{
  "data": [{
    "id": "uuid", "po_number": "PO-2024-001", "vendor_name": "TCS",
    "total_amount": 500000, "payment_terms": "Net 30",
    "payment_count": 3, "allocated_amount": 250000,
    "paid_amount": 100000, "remaining_amount": 250000,
    "pending_count": 1, "approved_count": 1
  }],
  "total": 15, "page": 1, "limit": 10, "totalPages": 2
}
```

#### POST `/api/purchase-orders`
```json
// Request
{ "po_number": "PO-2024-004", "vendor_name": "TCS", "total_amount": 500000, "payment_terms": "Net 30" }
// Response 201
{ "message": "Purchase order created", "data": { ... } }
```

### Payments

#### GET `/api/payments`
```
Query: ?status=Pending&po_id=uuid&type=Advance&overdue=true&page=1&limit=10
// Response 200
{ "data": [{ ...payment, "is_overdue": true, "purchase_orders": { "po_number": "..." } }],
  "total": 25, "page": 1, "limit": 10, "totalPages": 3 }
```

#### POST `/api/payments`
```json
// Request
{ "po_id": "uuid", "type": "Advance", "amount": 50000, "due_date": "2024-03-01" }
// Response 201
{ "message": "Payment created successfully", "data": { ... } }
// Error 400 (budget exceeded)
{ "error": "Payment of 50000 exceeds PO total. Remaining budget: 25000.00" }
```

#### PATCH `/api/payments/:id/approve` (Admin only)
```json
// Response 200
{ "message": "Payment approved by Admin User", "data": { "status": "Approved", ... } }
// Error 400
{ "error": "Cannot approve. Payment is currently \"Approved\". Only Pending payments can be approved." }
```

#### PATCH `/api/payments/:id/pay` (Accountant or Admin)
```json
// Request
{ "utr": "REF123456789" }
// Response 200
{ "message": "Payment marked as Paid", "data": { "status": "Paid", "utr": "REF123456789", ... } }
// Error 400 (not approved yet)
{ "error": "Payment must be Approved by an admin before it can be marked as Paid" }
```

#### PATCH `/api/payments/:id/notify` (Accountant or Admin)
```json
// Response 200
{ "message": "Vendor marked as notified", "data": { "vendor_notified": true, ... } }
```

### Vendor

#### GET `/api/vendor/my-notifications` (Vendor only)
```json
// Response 200
{
  "vendor": "TCS",
  "total_notifications": 5,
  "page": 1, "limit": 10, "totalPages": 1,
  "data": [{
    "payment_id": "uuid",
    "po_number": "PO-2024-001",
    "payment_type": "Advance",
    "amount_paid": 150000,
    "utr_reference": "REF123456789",
    "paid_at": "2024-03-15T10:30:00Z",
    "message": "You have been paid ₹1,50,000 via UTR: REF123456789"
  }]
}
```

### Upload

#### GET `/api/upload/template`
```
// Downloads: payments_template.csv
po_number,type,amount,due_date
PO-2024-001,Advance,50000,2024-03-01
```

#### POST `/api/upload/bulk-payments`
```
Content-Type: multipart/form-data, field name: "file"
Accepts: .csv, .xlsx, .xls (max 10MB)

// Response 200
{
  "message": "Processed 10 rows — 8 inserted, 2 skipped",
  "total": 10, "inserted": 8, "skipped": 2,
  "errors": [
    { "row": 3, "po_number": "PO-FAKE", "errors": ["PO \"PO-FAKE\" not found"] },
    { "row": 7, "po_number": "PO-2024-001", "errors": ["Amount 999999 exceeds PO remaining budget of 50000.00"] }
  ]
}
```

---

## 9. Frontend Architecture

### Tech: React 19 + Vite 8 + React Router 7

### Routing & Role-Based Dashboard

```javascript
// App.jsx — role-based rendering
function RoleRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;

  if (user.role === 'admin')      return <AdminDashboard />;
  if (user.role === 'accountant') return <AccountantDashboard />;
  if (user.role === 'vendor')     return <VendorDashboard />;
  return <UserDashboard />;
}

// Routes
<Route path="/login"    element={<LoginPage />} />
<Route path="/register" element={<RegisterPage />} />
<Route path="/*"        element={<RoleRouter />} />
```

### Auth Context (React Context API)

```javascript
// context/AuthContext.jsx
- On mount: checks localStorage for token → calls getMe() → sets user state
- loginUser(token, userData): saves to localStorage + state
- logout(): clears localStorage + state
- 401 interceptor: auto-clears and redirects to /login
```

### API Client (axios)

```javascript
// api.js — centralized API module
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

// Auto-attaches JWT to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Exports named functions for every endpoint:
// getPOs, createPO, updatePO, deletePO
// getPayments, createPayment, approvePayment, markPaid, notifyVendor, deletePayment
// login, register, getMe, getUsers, updateUserRole
// uploadBulkPayments, downloadTemplate
// getVendorNotifications
```

### Page Components

| Component | File | Role Access | Features |
|---|---|---|---|
| `LoginPage` | `pages/LoginPage.jsx` | Public | Email/password form, stores JWT |
| `RegisterPage` | `pages/RegisterPage.jsx` | Public | Name, email, password, role selector (user/vendor only) |
| `AdminDashboard` | `pages/AdminDashboard.jsx` (28KB) | Admin | PO management, all payments, approve/pay/notify/delete, user management, role changes, bulk upload, overdue alerts |
| `AccountantDashboard` | `pages/AccountantDashboard.jsx` (14KB) | Accountant | View POs, view payments, mark paid with UTR, notify vendor, bulk upload |
| `UserDashboard` | `pages/UserDashboard.jsx` (19KB) | User | View POs, create POs, view payments, create payments, bulk upload |
| `VendorDashboard` | `pages/VendorDashboard.jsx` (7KB) | Vendor | View ONLY paid+notified payments with UTR references |
| `Layout` | `components/Layout.jsx` | All | Sidebar navigation, user avatar, role badge, logout |

### Layout Component

Shared shell with:
- Sidebar with role-colored avatar (admin=indigo, accountant=cyan, user=violet, vendor=amber)
- Dynamic navigation items (passed as props)
- Topbar with page title + logout button
- Responsive with hamburger menu on mobile

### Design System

- Custom CSS variables in `index.css` (28KB — full theme)
- Dark mode color scheme
- Premium glassmorphism cards
- Color-coded status badges: Pending=amber, Approved=blue, Paid=green
- Overdue flag = red
- Responsive grid layout
- Google Fonts integration

---

## 10. Bulk Upload Module

### Supported Formats
- **CSV** (`.csv`) — parsed with `csv-parse` (synchronous mode)
- **Excel** (`.xlsx`, `.xls`) — parsed with `xlsx` library

### CSV Template Format
```csv
po_number,type,amount,due_date
PO-2024-001,Advance,50000,2024-03-01
PO-2024-001,Final,100000,2024-05-01
```

### Upload Processing Pipeline

```
1. Multer receives file (memory storage, max 10MB)
2. Parse file → array of row objects
3. Pre-load ALL POs with their current allocated totals into a map
4. For each row:
   a. Validate required fields (po_number, type, amount, due_date)
   b. Validate type is one of: Advance, Final, Partial
   c. Validate amount > 0
   d. Validate date format YYYY-MM-DD
   e. Lookup PO in map — check exists
   f. Check budget: po.allocated + amount <= po.total_amount
   g. Update local map's allocated total (for same-batch PO cumulation)
   h. Add to insert batch if all checks pass
5. Bulk INSERT all valid rows into payments table
6. Return detailed results with per-row errors
```

### Key Feature: Intra-Batch Budget Tracking

When uploading multiple rows for the same PO, the allocated total is updated in memory after each valid row — so rows later in the file correctly account for amounts added by earlier rows in the same upload.

---

## 11. Vendor System

### Design Philosophy

Vendors are treated as **external stakeholders** with minimal, read-only access:

1. **Complete isolation** from internal data — `blockVendor` middleware applied to PO and Payment routes
2. **Name-based matching** — vendor notifications looked up by matching `purchase_orders.vendor_name` against the vendor user's `name` (case-insensitive via `ilike`)
3. **Only see Paid + Notified** — vendors only see payments where `status = 'Paid'` AND `vendor_notified = true`
4. **Sanitized response** — internal fields (po_id, status, approved_by, etc.) are stripped; vendor sees only: payment_id, po_number, payment_type, amount_paid, utr_reference, paid_at, and a human-readable message with INR formatting

### Vendor Registration

Vendors self-register with `role: 'vendor'` at `/api/auth/register`. Their `name` must match the `vendor_name` on purchase orders for the notification lookup to work.

---

## 12. Environment Variables & Configuration

### Backend `.env`

```env
PORT=5000
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...                # Public key, safe for frontend
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...         # Secret! Backend only, bypasses RLS
FRONTEND_URL=https://your-app.vercel.app      # Added to CORS whitelist
```

### Frontend Environment

```env
# .env.production (or VITE_ prefix in any .env)
VITE_API_URL=https://your-backend.onrender.com/api
```

### Vite Proxy (Development)

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    }
  }
}
```

This allows the frontend to call `/api/*` in development without CORS issues — requests are proxied to the Express backend.

### Configuration Fallbacks

| Variable | Production | Local Fallback |
|---|---|---|
| `SUPABASE_URL` | Supabase Cloud URL | Required — no fallback |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase dashboard | Required — exits if missing |
| `VITE_API_URL` | Render/Railway URL | `/api` (uses Vite proxy) |
| `FRONTEND_URL` | Vercel URL | `http://localhost:5173` (hardcoded in CORS) |

---

## 13. Project File Structure

```
Payment_Proj/
│
├── .gitignore                            # Git ignore rules
├── README.md                             # Setup guide with full API reference
├── schema.sql                            # Complete Supabase schema (3 tables + RLS + trigger)
├── sample_payments.csv                   # Sample CSV for bulk upload testing
│
├── backend/                              # Node.js + Express REST API
│   ├── .env                              # Environment variables (Supabase keys) — NOT in git
│   ├── .gitignore
│   ├── package.json                      # Dependencies (express, supabase-js, multer, xlsx, csv-parse)
│   ├── package-lock.json
│   │
│   ├── scripts/
│   │   └── seed_admin.js                 # Creates initial admin user in Supabase
│   │
│   └── src/
│       ├── index.js                      # Express app entry point (CORS, routes, error handler)
│       │
│       ├── config/
│       │   └── supabase.js               # Supabase client setup (admin + user-scoped)
│       │
│       ├── middleware/
│       │   ├── auth.js                   # authenticate, requireRole, blockVendor
│       │   └── errorHandler.js           # Global error handler (Multer + generic)
│       │
│       └── routes/
│           ├── auth.js                   # Register, login, me, users list, role update
│           ├── purchaseOrders.js         # PO CRUD with payment summary enrichment
│           ├── payments.js               # Payment lifecycle (approve, pay, notify, delete)
│           ├── upload.js                 # CSV/Excel bulk import with row-level validation
│           └── vendor.js                 # Vendor-only notification endpoint
│
├── frontend/                             # React 19 SPA (Vite 8)
│   ├── .env.production                   # VITE_API_URL for production
│   ├── .gitignore
│   ├── index.html                        # HTML entry point
│   ├── package.json                      # Dependencies (react, react-router-dom, axios)
│   ├── package-lock.json
│   ├── vite.config.js                    # Vite config with API proxy
│   ├── vercel.json                       # Vercel SPA rewrite config
│   ├── eslint.config.js
│   │
│   ├── public/                           # Static assets
│   │
│   └── src/
│       ├── main.jsx                      # React entry point (ReactDOM.createRoot)
│       ├── App.jsx                       # BrowserRouter + role-based routing
│       ├── App.css                       # Component-level styles
│       ├── index.css                     # Global design system (28KB — full theme)
│       ├── api.js                        # Axios client + all API functions
│       │
│       ├── context/
│       │   └── AuthContext.jsx           # Auth state management (token, user, login, logout)
│       │
│       ├── components/
│       │   └── Layout.jsx                # Shared sidebar + topbar shell
│       │
│       ├── pages/
│       │   ├── LoginPage.jsx             # Login form
│       │   ├── RegisterPage.jsx          # Registration form (user/vendor only)
│       │   ├── AdminDashboard.jsx        # Full admin panel (POs, payments, users, upload)
│       │   ├── AccountantDashboard.jsx   # Accountant panel (mark paid, notify vendor)
│       │   ├── UserDashboard.jsx         # User panel (view POs, create payments, upload)
│       │   └── VendorDashboard.jsx       # Vendor portal (view notifications only)
│       │
│       └── assets/                       # Images, icons
│
└── PAYMENT_PROJECT.md                    # This file — project context document
```

---

## 14. Deployment

### Current Deployment Architecture

```
┌────────────────────┐     HTTPS      ┌────────────────────┐     Supabase     ┌────────────────────┐
│   Vercel (CDN)     │◄──────────────►│  Render / Railway  │◄───────────────►│   Supabase Cloud   │
│                    │                │                    │    REST API      │                    │
│   React Frontend   │                │   Express Backend  │    + Auth JWT    │   PostgreSQL DB    │
│   Static Build     │                │   Node.js 18       │                  │   + Auth Service   │
│   (Vite)           │                │                    │                  │   + RLS Policies   │
└────────────────────┘                └────────────────────┘                  └────────────────────┘
```

### Frontend (Vercel)

- `vercel.json` configured with SPA rewrite
- Build command: `npm run build` (Vite production build)
- Environment variable: `VITE_API_URL` set in Vercel dashboard

### Backend (Render / Railway)

- Start command: `npm start` → `node src/index.js`
- Environment variables set in platform dashboard
- Node.js 18+ runtime

---

## 15. Development Roadmap

### Phase 1: Core Backend ✅ COMPLETE
- [x] Express app with Supabase client setup
- [x] Authentication (register, login, JWT verification)
- [x] Role-based middleware (authenticate, requireRole, blockVendor)
- [x] Purchase Order CRUD with budget tracking
- [x] Payment lifecycle (create, approve, pay, notify, delete)

### Phase 2: Vendor System ✅ COMPLETE
- [x] Vendor registration (self-service, role='vendor')
- [x] Vendor isolation (blockVendor middleware)
- [x] Vendor notification endpoint (name-based matching)
- [x] Sanitized vendor-only response

### Phase 3: Bulk Import ✅ COMPLETE
- [x] CSV upload with row-level validation
- [x] Excel (.xlsx) upload support
- [x] Intra-batch budget tracking
- [x] Detailed error reporting per row
- [x] Sample template download

### Phase 4: Frontend Dashboards ✅ COMPLETE
- [x] Login / Register pages
- [x] Admin Dashboard (full PO/payment/user management)
- [x] Accountant Dashboard (pay + notify workflow)
- [x] User Dashboard (view + create)
- [x] Vendor Dashboard (notifications only)
- [x] Shared Layout with role-colored avatars
- [x] Responsive sidebar with mobile hamburger
- [x] Pagination on all list views

### Phase 5: Admin User Management ✅ COMPLETE
- [x] Admin can list all users (paginated)
- [x] Admin can change user roles
- [x] Admin can promote user to accountant or admin

### Phase 6: Future Enhancements 🔮 BACKLOG
- [ ] Email notifications (Resend / SendGrid) for vendor notify
- [ ] PDF invoice generation for paid payments
- [ ] Dashboard analytics charts (Chart.js / Recharts)
- [ ] Payment edit capability (before approval)
- [ ] Multi-currency support
- [ ] Audit log table (who did what, when)
- [ ] Rate limiting on API endpoints
- [ ] Automated Selenium E2E tests
- [ ] CI/CD pipeline with GitHub Actions

---

## 16. Code Conventions & Rules for Claude Opus

### JavaScript / Node.js Style Guide

```javascript
// 1. ES Modules (import/export) — the project uses "type": "module" in package.json
import { Router } from 'express';
export default router;

// 2. Async/await with try-catch for all Supabase operations
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('payments').select('*');
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    console.error('GET /payments:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Consistent error responses: { error: "message string" }
return res.status(400).json({ error: 'Missing required fields: po_number, amount' });

// 4. All routes log errors with route path prefix
console.error('PATCH /payments/:id/approve:', err);

// 5. Supabase query pattern: always destructure { data, error } and check error
const { data, error } = await supabaseAdmin.from('table').select('*');
if (error) throw error;

// 6. Use supabaseAdmin for ALL operations — RLS is a safety net, not primary auth
```

### React / Frontend Style Guide

```javascript
// 1. Functional components with hooks (no class components)
export default function AdminDashboard() {
  const [payments, setPayments] = useState([]);
}

// 2. Use the centralized api.js module — never call axios directly
import { getPayments, approvePayment } from '../api';

// 3. Use AuthContext for user state
const { user, loginUser, logout } = useAuth();

// 4. Use Layout component for all dashboard pages
return (
  <Layout title="Admin Dashboard" navItems={[...]}>
    {/* page content */}
  </Layout>
);

// 5. Error handling: catch and display via alert or inline state
try {
  await approvePayment(id);
} catch (err) {
  alert(err.response?.data?.error || 'Failed to approve');
}
```

### Pagination Convention

All list endpoints follow this pattern:

```javascript
// Backend: accepts ?page=1&limit=10
const page  = Math.max(1, parseInt(req.query.page)  || 1);
const limit = Math.min(100, parseInt(req.query.limit) || 10);
const from  = (page - 1) * limit;
const to    = from + limit - 1;

// Response structure:
{ data: [...], total: 42, page: 1, limit: 10, totalPages: 5 }
```

### Critical Rules Summary

| Rule | Description |
|---|---|
| **ES Modules only** | `import/export`, not `require/module.exports` |
| **Supabase Admin client** | Use `supabaseAdmin` for all server-side DB operations |
| **Consistent error format** | Always return `{ error: "message" }` on failure |
| **Pagination everywhere** | All list endpoints support `?page=N&limit=N` |
| **blockVendor on internal routes** | PO and Payment routes must always apply this middleware |
| **Budget validation** | Always check PO remaining budget before creating payments |
| **State machine enforcement** | Payment status transitions: Pending → Approved → Paid only |
| **Functional React components** | Hooks only, no class components |
| **Centralized API module** | All HTTP calls go through `src/api.js` |
| **Role-based routing** | `App.jsx` renders different dashboards based on `user.role` |
| **No secrets in code** | All Supabase keys in `.env`, loaded via `dotenv` |

---

## Quick Start Guide

### Local Development Setup

```bash
# 1. Clone repository
git clone <repo-url>

# 2. Backend setup
cd backend
npm install

# 3. Create .env file with your Supabase credentials
# (See section 12 for required variables)

# 4. Run the schema.sql in Supabase SQL Editor
# (Creates tables, indexes, RLS policies, trigger)

# 5. Seed admin user
node scripts/seed_admin.js

# 6. Start backend
npm run dev                    # nodemon on http://localhost:5000

# 7. Frontend setup (new terminal)
cd frontend
npm install
npm run dev                    # Vite on http://localhost:5173

# 8. Login with admin credentials
# Email: admin@payments.com
# Password: SecurePassword123!
```

---

> **This document is the single source of truth for the PayTrack project.** Any AI assistant (Claude Opus, Copilot, etc.) should read this file first before making any code changes. If something is not covered here, check the source code directly.
