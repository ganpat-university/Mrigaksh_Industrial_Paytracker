// src/routes/upload.js
// POST /api/upload/bulk-payments   - upload CSV or Excel, bulk insert payments
// GET  /api/upload/template        - download sample CSV template

import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Multer: memory storage (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const extOk = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    if (extOk) return cb(null, true);
    cb(new Error('Only CSV and Excel (.xlsx, .xls) files are allowed'));
  }
});

router.use(authenticate);

// ─── DOWNLOAD SAMPLE TEMPLATE ─────────────────────────────────────────────────
router.get('/template', (req, res) => {
  const csv = [
    'po_number,type,amount,due_date',
    'PO-2024-001,Advance,50000,2024-03-01',
    'PO-2024-001,Partial,75000,2024-04-01',
    'PO-2024-001,Final,125000,2024-05-01',
    'PO-2024-002,Advance,30000,2024-03-15',
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="payments_template.csv"');
  res.send(csv);
});

// ─── BULK UPLOAD ──────────────────────────────────────────────────────────────
router.post('/bulk-payments', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use field name: "file"' });
  }

  const ext = req.file.originalname.split('.').pop().toLowerCase();
  let records = [];

  // ── Parse file ──
  try {
    if (ext === 'csv') {
      records = parse(req.file.buffer.toString('utf-8'), {
        columns:           true,
        skip_empty_lines:  true,
        trim:              true,
        skip_records_with_empty_values: true,
      });
    } else if (['xlsx', 'xls'].includes(ext)) {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const sheet    = workbook.Sheets[workbook.SheetNames[0]];
      records = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
    }
  } catch (parseErr) {
    return res.status(400).json({ error: `File parse error: ${parseErr.message}` });
  }

  if (records.length === 0) {
    return res.status(400).json({ error: 'File is empty or has no valid rows' });
  }

  // ── Pre-load all POs into a map for fast lookup ──
  const { data: allPOs } = await supabaseAdmin
    .from('purchase_orders')
    .select('id, po_number, total_amount, payments(amount)');

  const poMap = {};
  for (const po of allPOs || []) {
    const allocated = (po.payments || []).reduce((s, p) => s + parseFloat(p.amount), 0);
    poMap[po.po_number.trim()] = {
      id:           po.id,
      total_amount: parseFloat(po.total_amount),
      allocated,
    };
  }

  // ── Process each row ──
  const results = { total: records.length, inserted: 0, skipped: 0, errors: [] };
  const toInsert = [];

  for (let i = 0; i < records.length; i++) {
    const row    = records[i];
    const rowNum = i + 2;  // row 1 = header

    const po_number = (row['po_number'] || row['PO Number'] || '').toString().trim();
    const type      = (row['type']      || row['Type']      || '').toString().trim();
    const amount    = parseFloat(row['amount'] || row['Amount'] || 0);
    const due_date  = (row['due_date']  || row['Due Date']  || '').toString().trim();

    // Validate row
    const rowErrors = [];
    if (!po_number) rowErrors.push('po_number is required');
    if (!type)      rowErrors.push('type is required');
    if (!['Advance', 'Final', 'Partial'].includes(type))
      rowErrors.push(`type must be Advance/Final/Partial (got "${type}")`);
    if (isNaN(amount) || amount <= 0)
      rowErrors.push(`amount must be a positive number (got "${row['amount']}")`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date))
      rowErrors.push(`due_date must be YYYY-MM-DD format (got "${due_date}")`);

    if (rowErrors.length) {
      results.errors.push({ row: rowNum, po_number, errors: rowErrors });
      results.skipped++;
      continue;
    }

    // Check PO exists
    const po = poMap[po_number];
    if (!po) {
      results.errors.push({ row: rowNum, po_number, errors: [`PO "${po_number}" not found`] });
      results.skipped++;
      continue;
    }

    // Check budget
    const newAllocated = po.allocated + amount;
    if (newAllocated > po.total_amount) {
      const remaining = po.total_amount - po.allocated;
      results.errors.push({
        row: rowNum, po_number,
        errors: [`Amount ${amount} exceeds PO remaining budget of ${remaining.toFixed(2)}`]
      });
      results.skipped++;
      continue;
    }

    // Update local map so subsequent rows for same PO account for prior rows in this batch
    poMap[po_number].allocated += amount;

    toInsert.push({
      po_id:      po.id,
      type,
      amount,
      due_date,
      status:     'Pending',
      created_by: req.user.id,
    });
  }

  // ── Bulk insert valid rows ──
  if (toInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('payments')
      .insert(toInsert);

    if (insertError) {
      return res.status(500).json({ error: `DB insert failed: ${insertError.message}` });
    }
    results.inserted = toInsert.length;
  }

  const statusCode = results.errors.length > 0 && results.inserted === 0 ? 400 : 200;
  res.status(statusCode).json({
    message:  `Processed ${results.total} rows — ${results.inserted} inserted, ${results.skipped} skipped`,
    ...results,
  });
});

export default router;
