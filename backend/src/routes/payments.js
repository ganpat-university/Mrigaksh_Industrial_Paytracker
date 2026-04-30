// src/routes/payments.js
// GET    /api/payments                  - list all payments (filterable)
// POST   /api/payments                  - create payment under a PO
// GET    /api/payments/:id              - get single payment
// PATCH  /api/payments/:id/approve      - ADMIN: Pending → Approved
// PATCH  /api/payments/:id/pay          - ACCOUNTANT: Approved → Paid (requires UTR)
// PATCH  /api/payments/:id/notify       - ACCOUNTANT: mark vendor as notified
// DELETE /api/payments/:id              - ADMIN: delete only Pending payments

import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, requireRole, blockVendor } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(blockVendor); // Vendors cannot access any internal payment data

// helper: compute overdue flag
const withOverdue = (payment) => {
  const today = new Date().toISOString().split('T')[0];
  return { ...payment, is_overdue: payment.due_date < today && payment.status !== 'Paid' };
};

// ─── GET ALL PAYMENTS ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, po_id, type, overdue } = req.query;

    // ── Pagination params ──
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const from  = (page - 1) * limit;
    const to    = from + limit - 1;

    let query = supabaseAdmin
      .from('payments')
      .select(`
        id, type, amount, due_date, status,
        utr, vendor_notified,
        approved_at, paid_at, created_at,
        po_id,
        purchase_orders ( id, po_number, vendor_name, total_amount, payment_terms )
      `, { count: 'exact' })        // ← tells Supabase to return total count
      .order('due_date', { ascending: true })
      .range(from, to);              // ← server-side slice

    if (status) query = query.eq('status', status);
    if (po_id)  query = query.eq('po_id', po_id);
    if (type)   query = query.eq('type', type);

    const { data, count, error } = await query;
    if (error) throw error;

    let result = data.map(withOverdue);

    // Filter overdue after fetch (can't do date comparison in Supabase filter easily)
    // Note: overdue filter fetches all then filters — use sparingly on large datasets
    if (overdue === 'true') {
      result = result.filter(p => p.is_overdue);
    }

    res.json({
      data:       result,
      total:      count,            // ← total records matching filters (before pagination)
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error('GET /payments:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE PAYMENT ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { po_id, type, amount, due_date } = req.body;

    // Basic validation
    const missing = [];
    if (!po_id)    missing.push('po_id');
    if (!type)     missing.push('type');
    if (!amount)   missing.push('amount');
    if (!due_date) missing.push('due_date');
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!['Advance', 'Final', 'Partial'].includes(type)) {
      return res.status(400).json({ error: 'type must be one of: Advance, Final, Partial' });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return res.status(400).json({ error: 'due_date must be in YYYY-MM-DD format' });
    }

    // ── Business Rule: total payments must not exceed PO amount ──
    const { data: po, error: poError } = await supabaseAdmin
      .from('purchase_orders')
      .select('id, total_amount, payments(amount)')
      .eq('id', po_id)
      .single();

    if (poError || !po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const alreadyAllocated = (po.payments || [])
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const newTotal = alreadyAllocated + parseFloat(amount);

    if (newTotal > parseFloat(po.total_amount)) {
      const remaining = parseFloat(po.total_amount) - alreadyAllocated;
      return res.status(400).json({
        error: `Payment of ${amount} exceeds PO total. Remaining budget: ${remaining.toFixed(2)}`
      });
    }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert({
        po_id,
        type,
        amount:    parseFloat(amount),
        due_date,
        status:    'Pending',
        created_by: req.user.id,
      })
      .select(`
        *,
        purchase_orders ( po_number, vendor_name )
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Payment created successfully', data });
  } catch (err) {
    console.error('POST /payments:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET SINGLE PAYMENT ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        purchase_orders ( id, po_number, vendor_name, total_amount )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ data: withOverdue(data) });
  } catch (err) {
    console.error('GET /payments/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── APPROVE PAYMENT (Admin only) ─────────────────────────────────────────────
// Rule: Pending → Approved
router.patch('/:id/approve', requireRole('admin'), async (req, res) => {
  try {
    // Fetch current status
    const { data: payment, error: fetchErr } = await supabaseAdmin
      .from('payments')
      .select('id, status, amount, po_id')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'Pending') {
      return res.status(400).json({
        error: `Cannot approve. Payment is currently "${payment.status}". Only Pending payments can be approved.`
      });
    }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({
        status:      'Approved',
        approved_by: req.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select(`*, purchase_orders(po_number, vendor_name)`)
      .single();

    if (error) throw error;

    res.json({ message: `Payment approved by ${req.user.name}`, data });
  } catch (err) {
    console.error('PATCH /payments/:id/approve:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── MARK AS PAID (Accountant/Admin) ─────────────────────────────────────────
// Rule: Approved → Paid   (UTR required, admin approval required first)
router.patch('/:id/pay', requireRole('accountant', 'admin'), async (req, res) => {
  try {
    const { utr } = req.body;

    if (!utr || utr.trim() === '') {
      return res.status(400).json({
        error: 'UTR (Unique Transaction Reference) number is required to mark a payment as Paid'
      });
    }

    const { data: payment, error: fetchErr } = await supabaseAdmin
      .from('payments')
      .select('id, status')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // ── Business Rule: cannot be Paid without Approval ──
    if (payment.status === 'Pending') {
      return res.status(400).json({
        error: 'Payment must be Approved by an admin before it can be marked as Paid'
      });
    }

    if (payment.status === 'Paid') {
      return res.status(400).json({ error: 'Payment is already marked as Paid' });
    }

    if (payment.status !== 'Approved') {
      return res.status(400).json({
        error: `Cannot mark as Paid. Current status: "${payment.status}"`
      });
    }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({
        status:  'Paid',
        utr:     utr.trim(),
        paid_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select(`*, purchase_orders(po_number, vendor_name)`)
      .single();

    if (error) throw error;

    res.json({ message: 'Payment marked as Paid', data });
  } catch (err) {
    console.error('PATCH /payments/:id/pay:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── MARK VENDOR NOTIFIED (Accountant/Admin) ──────────────────────────────────
router.patch('/:id/notify', requireRole('accountant', 'admin'), async (req, res) => {
  try {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, vendor_notified, status')
      .eq('id', req.params.id)
      .single();

    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (payment.vendor_notified) {
      return res.status(400).json({ error: 'Vendor has already been marked as notified' });
    }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({ vendor_notified: true })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Vendor marked as notified', data });
  } catch (err) {
    console.error('PATCH /payments/:id/notify:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE PAYMENT (Admin only) ──────────────────────────────────────────────
// Only Pending payments can be deleted
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, status')
      .eq('id', req.params.id)
      .single();

    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (payment.status !== 'Pending') {
      return res.status(400).json({
        error: `Cannot delete a payment with status "${payment.status}". Only Pending payments can be deleted.`
      });
    }

    const { error } = await supabaseAdmin
      .from('payments')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ message: 'Payment deleted successfully' });
  } catch (err) {
    console.error('DELETE /payments/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;