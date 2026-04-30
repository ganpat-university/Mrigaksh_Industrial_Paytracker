import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { getPOs, createPO, getPayments, createPayment, uploadBulkPayments, downloadTemplate } from '../api';

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Bulk Upload Panel ─────────────────────────────────────────────────────────
function UploadPanel() {
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState('');

  const handleFile = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(''); setResult(null);
    try {
      const res = await uploadBulkPayments(file);
      setResult(res.data);
      setFile(null);
      document.getElementById('user-upload-input').value = '';
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  return (
    <div className="upload-panel-wrap" style={{ maxWidth: 580 }}>
      {/* Download template */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>📥 Download Template</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Get the correct CSV format: <code style={{ color: 'var(--accent-hover)' }}>po_number, type, amount, due_date</code>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={downloadTemplate}>
            ⬇ Download CSV Template
          </button>
        </div>
      </div>

      {/* Upload area */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>📤 Upload Payments File</div>

        <label htmlFor="user-upload-input" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, border: '2px dashed var(--border-light)', borderRadius: 'var(--radius)',
          padding: '36px 20px', cursor: 'pointer', marginBottom: 16,
          background: file ? 'var(--success-light)' : 'var(--bg-input)',
          borderColor: file ? 'var(--success)' : 'var(--border-light)',
          transition: 'all 0.2s'
        }}>
          <span style={{ fontSize: 32 }}>{file ? '✅' : '📂'}</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {file ? file.name : 'Click to select file'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Supports: .csv, .xlsx, .xls
          </span>
          <input id="user-upload-input" type="file" accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }} onChange={handleFile} />
        </label>

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleUpload}
            disabled={!file || uploading} style={{ flex: 1 }}>
            {uploading ? 'Uploading…' : '⬆ Upload & Process'}
          </button>
          {file && (
            <button className="btn btn-secondary" onClick={() => {
              setFile(null); setResult(null); setError('');
              document.getElementById('user-upload-input').value = '';
            }}>Clear</button>
          )}
        </div>

        {/* Result */}
        {result && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              padding: '12px 16px', borderRadius: 'var(--radius-sm)',
              background: result.inserted > 0 ? 'var(--success-light)' : 'var(--danger-light)',
              border: `1px solid ${result.inserted > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: result.inserted > 0 ? 'var(--success)' : 'var(--danger)',
              fontWeight: 600, marginBottom: 12
            }}>
              {result.message}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, background: 'var(--success-light)', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)' }}>{result.inserted}</div>
                <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>Inserted</div>
              </div>
              <div style={{ flex: 1, background: 'var(--danger-light)', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--danger)' }}>{result.skipped}</div>
                <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>Skipped</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-input)', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{result.total}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Total Rows</div>
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  ROW ERRORS
                </div>
                {result.errors.map((e, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', marginBottom: 6,
                    background: 'var(--danger-light)', borderRadius: 6,
                    fontSize: 12, color: '#fca5a5'
                  }}>
                    <strong>Row {e.row}</strong> {e.po_number && `(${e.po_number})`}: {e.errors?.join(', ')}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pagination component ─────────────────────────────────────────────────────
function Pagination({ page, total, pageSize, onPageChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn btn-secondary btn-sm" onClick={() => onPageChange(page - 1)} disabled={page === 1}>← Prev</button>
      <span className="pagination-info">Page {page} of {totalPages} · {total} records</span>
      <button className="btn btn-secondary btn-sm" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>Next →</button>
    </div>
  );
}

export default function UserDashboard() {
  const PAGE_SIZE = 10;

  const [tab, setTab] = useState('pos');
  const [pos, setPOs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [poForm, setPOForm] = useState({ po_number: '', vendor_name: '', total_amount: '', payment_terms: '' });
  const [payForm, setPayForm] = useState({ po_id: '', type: 'Advance', amount: '', due_date: '' });
  const [formErr, setFormErr] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // ── Pagination state ──
  const [poPage,   setPoPage]   = useState(1);
  const [payPage,  setPayPage]  = useState(1);
  const [poTotal,  setPoTotal]  = useState(0);
  const [payTotal, setPayTotal] = useState(0);

  // Reset to page 1 when filter changes
  useEffect(() => { setPayPage(1); }, [statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, payRes] = await Promise.all([
        getPOs({ page: poPage, limit: PAGE_SIZE }),
        getPayments({
          ...(statusFilter ? { status: statusFilter } : {}),
          page: payPage,
          limit: PAGE_SIZE,
        }),
      ]);
      setPOs(poRes.data.data);
      setPoTotal(poRes.data.total ?? poRes.data.data.length);
      setPayments(payRes.data.data);
      setPayTotal(payRes.data.total ?? payRes.data.data.length);
    } finally { setLoading(false); }
  }, [statusFilter, poPage, payPage]);

  useEffect(() => { load(); }, [load]);

  const handleCreatePO = async (e) => {
    e.preventDefault(); setFormErr('');
    try {
      await createPO(poForm);
      setShowPOModal(false);
      setPOForm({ po_number: '', vendor_name: '', total_amount: '', payment_terms: '' });
      load();
    } catch (err) { setFormErr(err.response?.data?.error || 'Failed'); }
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault(); setFormErr('');
    try {
      await createPayment(payForm);
      setShowPayModal(false);
      setPayForm({ po_id: '', type: 'Advance', amount: '', due_date: '' });
      load();
    } catch (err) { setFormErr(err.response?.data?.error || 'Failed'); }
  };

  const navItems = [
    { label: 'Purchase Orders', icon: '📋', active: tab === 'pos',      onClick: () => setTab('pos') },
    { label: 'My Payments',     icon: '💰', active: tab === 'payments', onClick: () => setTab('payments') },
    { label: 'Bulk Upload',     icon: '📤', active: tab === 'upload',   onClick: () => setTab('upload') },
  ];

  return (
    <Layout title="User Dashboard" navItems={navItems}>
      {loading ? <div className="spinner">Loading…</div> : <>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--accent-light)' }}>📋</div>
            <div className="stat-value">{pos.length}</div>
            <div className="stat-label">Purchase Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--warning-light)' }}>⏳</div>
            <div className="stat-value">{payments.filter(p => p.status === 'Pending').length}</div>
            <div className="stat-label">Pending Payments</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--success-light)' }}>✅</div>
            <div className="stat-value">{payments.filter(p => p.status === 'Paid').length}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>

        {tab === 'pos' && <>
          <div className="page-header">
            <div className="page-title">Purchase Orders</div>
            <button className="btn btn-primary" onClick={() => { setFormErr(''); setShowPOModal(true); }}>+ New PO</button>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>PO Number</th><th>Vendor</th><th>Total</th><th>Allocated</th><th>Remaining</th><th>Terms</th>
                </tr></thead>
                <tbody>
                  {pos.length === 0 && <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-text">No POs yet — create one!</div></div></td></tr>}
                  {pos.map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 700 }}>{po.po_number}</td>
                      <td>{po.vendor_name}</td>
                      <td>{fmt(po.total_amount)}</td>
                      <td>{fmt(po.allocated_amount)}</td>
                      <td style={{ color: po.remaining_amount > 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(po.remaining_amount)}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{po.payment_terms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={poPage} total={poTotal} pageSize={PAGE_SIZE} onPageChange={setPoPage} />
        </>}

        {tab === 'payments' && <>
          <div className="page-header">
            <div className="page-title">Payments</div>
            <button className="btn btn-primary" onClick={() => { setFormErr(''); setShowPayModal(true); }}>+ New Payment</button>
          </div>
          <div className="filter-bar">
            {['', 'Pending', 'Approved', 'Paid'].map(s => (
              <button key={s} className={`filter-btn ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>PO</th><th>Vendor</th><th>Type</th><th>Amount</th><th>Due Date</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {payments.length === 0 && <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-text">No payments yet</div></div></td></tr>}
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.purchase_orders?.po_number}</td>
                      <td>{p.purchase_orders?.vendor_name}</td>
                      <td>{p.type}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(p.amount)}</td>
                      <td style={{ color: p.is_overdue ? 'var(--danger)' : '' }}>{p.due_date}{p.is_overdue && ' 🔴'}</td>
                      <td><span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={payPage} total={payTotal} pageSize={PAGE_SIZE} onPageChange={setPayPage} />
        </>}

        {tab === 'upload' && <>
          <div className="page-header">
            <div>
              <div className="page-title">Bulk Upload Payments</div>
              <div className="page-subtitle">Upload a CSV or Excel file to create multiple payments at once</div>
            </div>
          </div>
          <UploadPanel />
        </>}
      </>}

      {showPOModal && (
        <Modal title="Create Purchase Order" onClose={() => setShowPOModal(false)}>
          {formErr && <div className="alert alert-error">{formErr}</div>}
          <form onSubmit={handleCreatePO}>
            <div className="form-group"><label className="form-label">PO Number</label>
              <input className="form-input" placeholder="PO-2024-001" value={poForm.po_number}
                onChange={e => setPOForm(p => ({ ...p, po_number: e.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Vendor Name</label>
              <input className="form-input" placeholder="Vendor Co Ltd" value={poForm.vendor_name}
                onChange={e => setPOForm(p => ({ ...p, vendor_name: e.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Total Amount (₹)</label>
              <input className="form-input" type="number" placeholder="500000" value={poForm.total_amount}
                onChange={e => setPOForm(p => ({ ...p, total_amount: e.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Payment Terms</label>
              <input className="form-input" placeholder="Net 30, 50% Advance..." value={poForm.payment_terms}
                onChange={e => setPOForm(p => ({ ...p, payment_terms: e.target.value }))} required /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPOModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create</button>
            </div>
          </form>
        </Modal>
      )}

      {showPayModal && (
        <Modal title="Create Payment" onClose={() => setShowPayModal(false)}>
          {formErr && <div className="alert alert-error">{formErr}</div>}
          <form onSubmit={handleCreatePayment}>
            <div className="form-group"><label className="form-label">Purchase Order</label>
              <select className="form-select" value={payForm.po_id}
                onChange={e => setPayForm(p => ({ ...p, po_id: e.target.value }))} required>
                <option value="">Select a PO…</option>
                {pos.map(po => <option key={po.id} value={po.id}>{po.po_number} — {po.vendor_name}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Type</label>
              <select className="form-select" value={payForm.type}
                onChange={e => setPayForm(p => ({ ...p, type: e.target.value }))}>
                <option>Advance</option><option>Partial</option><option>Final</option>
              </select></div>
            <div className="form-group"><label className="form-label">Amount (₹)</label>
              <input className="form-input" type="number" placeholder="250000" value={payForm.amount}
                onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Due Date</label>
              <input className="form-input" type="date" value={payForm.due_date}
                onChange={e => setPayForm(p => ({ ...p, due_date: e.target.value }))} required /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}