-- ============================================================
-- PAYMENTS TRACKER — Complete Supabase Schema
-- Run this entire file in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── TABLE 1: users ──────────────────────────────────────────
-- Mirrors auth.users but adds name + role
-- Auto-populated by trigger when user signs up

CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'user'
                          CHECK (role IN ('admin', 'accountant', 'user', 'vendor')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.users         IS 'App users with roles';
COMMENT ON COLUMN public.users.role    IS 'admin = can approve; accountant = can pay + notify';

-- ── TABLE 2: purchase_orders ─────────────────────────────────
-- Each PO has a budget cap; payments cannot exceed it

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number      TEXT           NOT NULL UNIQUE,
  vendor_name    TEXT           NOT NULL,
  total_amount   NUMERIC(14,2)  NOT NULL CHECK (total_amount > 0),
  payment_terms  TEXT           NOT NULL,    -- e.g. "Net 30", "50% Advance + 50% Final"
  created_by     UUID           REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.purchase_orders              IS 'Purchase orders from vendors';
COMMENT ON COLUMN public.purchase_orders.po_number   IS 'Unique PO identifier e.g. PO-2024-001';
COMMENT ON COLUMN public.purchase_orders.total_amount IS 'Max amount that can be allocated to payments';
COMMENT ON COLUMN public.purchase_orders.payment_terms IS 'Human-readable terms e.g. Net 30';

-- ── TABLE 3: payments ────────────────────────────────────────
-- Each payment belongs to one PO; lifecycle: Pending → Approved → Paid

CREATE TABLE IF NOT EXISTS public.payments (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationship
  po_id            UUID          NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,

  -- Payment details
  type             TEXT          NOT NULL CHECK (type IN ('Advance', 'Final', 'Partial')),
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  due_date         DATE          NOT NULL,

  -- Lifecycle
  status           TEXT          NOT NULL DEFAULT 'Pending'
                                 CHECK (status IN ('Pending', 'Approved', 'Paid')),

  -- Paid info
  utr              TEXT,          -- Unique Transaction Reference (bank ref number)
  vendor_notified  BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Audit: who approved / paid
  approved_by      UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  paid_at          TIMESTAMPTZ,

  -- Audit: who created
  created_by       UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.payments                IS 'Individual payments under purchase orders';
COMMENT ON COLUMN public.payments.type           IS 'Advance=first payment, Partial=milestone, Final=last payment';
COMMENT ON COLUMN public.payments.status         IS 'Pending→Approved (admin)→Paid (accountant)';
COMMENT ON COLUMN public.payments.utr            IS 'Bank transaction reference, required when marking Paid';
COMMENT ON COLUMN public.payments.vendor_notified IS 'Whether vendor has been informed of payment';

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_po_id     ON public.payments(po_id);
CREATE INDEX IF NOT EXISTS idx_payments_status    ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date  ON public.payments(due_date);
CREATE INDEX IF NOT EXISTS idx_po_po_number       ON public.purchase_orders(po_number);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read everything
CREATE POLICY "read_users"   ON public.users           FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_po"      ON public.purchase_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_payments" ON public.payments       FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can insert POs and payments (role checks done in backend)
CREATE POLICY "insert_po"      ON public.purchase_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "insert_payment" ON public.payments        FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Update / delete controlled by backend role middleware
CREATE POLICY "update_po"      ON public.purchase_orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "update_payment" ON public.payments        FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "delete_po"      ON public.purchase_orders FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "delete_payment" ON public.payments        FOR DELETE USING (auth.role() = 'authenticated');

-- Users can only update their own profile
CREATE POLICY "update_own_user" ON public.users FOR UPDATE USING (auth.uid() = id);

-- ── TRIGGER: auto-create user profile on signup ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name',  split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role',  'user')
  )
  ON CONFLICT (id) DO NOTHING;   -- safe to run multiple times
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── SAMPLE SEED DATA (optional, comment out in production) ───
-- Create two test POs so you can test payments immediately

INSERT INTO public.purchase_orders (po_number, vendor_name, total_amount, payment_terms)
VALUES
  ('PO-2024-001', 'Tata Consultancy Services',  500000.00, 'Net 30 — 30% Advance, 70% Final'),
  ('PO-2024-002', 'Infosys Limited',             250000.00, 'Net 15 — 50% Advance, 50% Final'),
  ('PO-2024-003', 'Wipro Technologies',          750000.00, 'Milestone — 25% each quarter')
ON CONFLICT (po_number) DO NOTHING;
