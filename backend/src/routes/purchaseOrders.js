// src/routes/purchaseOrders.js
// GET    /api/purchase-orders          - list all POs with payment summary
// POST   /api/purchase-orders          - create a new PO
// GET    /api/purchase-orders/:id      - get single PO with all payments
// PUT    /api/purchase-orders/:id      - update PO
// DELETE /api/purchase-orders/:id      - delete PO (only if no payments)

import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, requireRole, blockVendor } from '../middleware/auth.js';

const router = Router();
router.use(authenticate); // all PO routes require login
router.use(blockVendor);  // Vendors cannot access purchase order data

// ─── GET ALL POs ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // ── Pagination params ──
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const from  = (page - 1) * limit;
    const to    = from + limit - 1;

    // First get total count of POs (without payments join for accuracy)
    const { count, error: countError } = await supabaseAdmin
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true }); // head:true = count only, no rows

    if (countError) throw countError;

    // Then get paginated page with full data
    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        vendor_name,
        total_amount,
        payment_terms,
        created_at,
        created_by,
        payments ( id, amount, status )
      `)
      .order('created_at', { ascending: false })
      .range(from, to);             // ← server-side slice

    if (error) throw error;

    // Enrich with computed payment summary
    const enriched = data.map(po => {
      const payments = po.payments || [];
      const allocated = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const paid      = payments.filter(p => p.status === 'Paid')
                                .reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const pending   = payments.filter(p => p.status === 'Pending').length;
      const approved  = payments.filter(p => p.status === 'Approved').length;

      return {
        ...po,
        payments: undefined,           // strip raw array
        payment_count:     payments.length,
        allocated_amount:  parseFloat(allocated.toFixed(2)),
        paid_amount:       parseFloat(paid.toFixed(2)),
        remaining_amount:  parseFloat((parseFloat(po.total_amount) - allocated).toFixed(2)),
        pending_count:     pending,
        approved_count:    approved,
      };
    });

    res.json({
      data:       enriched,
      total:      count,             // ← total PO count for frontend pagination
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error('GET /purchase-orders:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE PO ────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { po_number, vendor_name, total_amount, payment_terms } = req.body;

    // Validation
    const missing = [];
    if (!po_number)    missing.push('po_number');
    if (!vendor_name)  missing.push('vendor_name');
    if (!total_amount) missing.push('total_amount');
    if (!payment_terms) missing.push('payment_terms');
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    if (isNaN(total_amount) || parseFloat(total_amount) <= 0) {
      return res.status(400).json({ error: 'total_amount must be a positive number' });
    }

    // Check PO number uniqueness
    const { data: existing } = await supabaseAdmin
      .from('purchase_orders')
      .select('id')
      .eq('po_number', po_number)
      .single();

    if (existing) {
      return res.status(409).json({ error: `PO number "${po_number}" already exists` });
    }

    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .insert({
        po_number:     po_number.trim(),
        vendor_name:   vendor_name.trim(),
        total_amount:  parseFloat(total_amount),
        payment_terms: payment_terms.trim(),
        created_by:    req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Purchase order created', data });
  } catch (err) {
    console.error('POST /purchase-orders:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET SINGLE PO ────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        *,
        payments (
          id, type, amount, due_date, status,
          utr, vendor_notified,
          approved_at, paid_at, created_at
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Mark overdue on each payment
    const today = new Date().toISOString().split('T')[0];
    const payments = (data.payments || []).map(p => ({
      ...p,
      is_overdue: p.due_date < today && p.status !== 'Paid'
    }));

    res.json({ data: { ...data, payments } });
  } catch (err) {
    console.error('GET /purchase-orders/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE PO ────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { vendor_name, total_amount, payment_terms } = req.body;

    // Can't reduce total_amount below what's already allocated
    if (total_amount !== undefined) {
      const { data: po } = await supabaseAdmin
        .from('purchase_orders')
        .select('payments(amount)')
        .eq('id', req.params.id)
        .single();

      if (po) {
        const allocated = (po.payments || []).reduce((s, p) => s + parseFloat(p.amount), 0);
        if (parseFloat(total_amount) < allocated) {
          return res.status(400).json({
            error: `Cannot reduce total below already allocated amount of ${allocated.toFixed(2)}`
          });
        }
      }
    }

    const updates = {};
    if (vendor_name)   updates.vendor_name   = vendor_name.trim();
    if (total_amount)  updates.total_amount  = parseFloat(total_amount);
    if (payment_terms) updates.payment_terms = payment_terms.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Purchase order updated', data });
  } catch (err) {
    console.error('PUT /purchase-orders/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE PO ────────────────────────────────────────────────────────────────
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    // Only allow delete if no payments exist
    const { data: po } = await supabaseAdmin
      .from('purchase_orders')
      .select('payments(id)')
      .eq('id', req.params.id)
      .single();

    if (!po) return res.status(404).json({ error: 'Purchase order not found' });

    if (po.payments?.length > 0) {
      return res.status(400).json({
        error: `Cannot delete PO with ${po.payments.length} existing payment(s). Remove payments first.`
      });
    }

    const { error } = await supabaseAdmin
      .from('purchase_orders')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Purchase order deleted successfully' });
  } catch (err) {
    console.error('DELETE /purchase-orders/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;