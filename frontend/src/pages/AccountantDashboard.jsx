import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { getPayments, markPaid, notifyVendor, uploadBulkPayments, downloadTemplate } from '../api';

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function UTRModal({ payment, onClose, onDone }) {
  const [utr, setUtr] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await markPaid(payment.id, utr); onDone(); onClose(); }
    catch (er) { setErr(er.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">💸 Mark as Paid</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {err && <div className="alert alert-error">{err}</div>}
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13 }}>
          Payment: <strong style={{ color: '#fff' }}>{fmt(payment.amount)}</strong> for {payment.purchase_orders?.vendor_name}
        </p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">UTR / Transaction Reference</label>
            <input className="form-input" placeholder="e.g. HDFC202600288210" value={utr}
              onChange={e => setUtr(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success">Mark Paid</button>
          </div>
        </form>
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
      document.getElementById('acc-upload-input').value = '';
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

        <label htmlFor="acc-upload-input" style={{
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
          <input id="acc-upload-input" type="file" accept=".csv,.xlsx,.xls"
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
              document.getElementById('acc-upload-input').value = '';
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

export default function AccountantDashboard() {
  const PAGE_SIZE = 10;

  const [tab, setTab] = useState('approved');
  const [approved, setApproved] = useState([]);
  const [paid, setPaid]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [payModal, setPayModal] = useState(null);

  // ── Pagination state — separate per tab ──
  const [approvedPage,  setApprovedPage]  = useState(1);
  const [paidPage,      setPaidPage]      = useState(1);
  const [approvedTotal, setApprovedTotal] = useState(0);
  const [paidTotal,     setPaidTotal]     = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [approvedRes, paidRes] = await Promise.all([
        getPayments({ status: 'Approved', page: approvedPage, limit: PAGE_SIZE }),
        getPayments({ status: 'Paid',     page: paidPage,     limit: PAGE_SIZE }),
      ]);
      setApproved(approvedRes.data.data);
      setApprovedTotal(approvedRes.data.total ?? approvedRes.data.data.length);
      setPaid(paidRes.data.data);
      setPaidTotal(paidRes.data.total ?? paidRes.data.data.length);
    } finally { setLoading(false); }
  }, [approvedPage, paidPage]);

  useEffect(() => { load(); }, [load]);

  const handleNotify = async (id) => {
    if (!confirm('Mark vendor as notified?')) return;
    try { await notifyVendor(id); load(); }
    catch (er) { alert(er.response?.data?.error); }
  };

  const navItems = [
    { label: 'To-Do (Approved)', icon: '✅', active: tab === 'approved', onClick: () => setTab('approved') },
    { label: 'Paid History',     icon: '📜', active: tab === 'paid',     onClick: () => setTab('paid') },
    { label: 'Bulk Upload',      icon: '📤', active: tab === 'upload',   onClick: () => setTab('upload') },
  ];

  const PayTable = ({ data, showNotify }) => (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>PO</th><th>Vendor</th><th>Type</th><th>Amount</th><th>Due</th><th>Status</th>
            {showNotify ? <th>Actions</th> : <><th>UTR</th><th>Vendor Notified</th></>}
          </tr></thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon">🎉</div><div className="empty-state-text">Nothing here!</div></div></td></tr>}
            {data.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.purchase_orders?.po_number}</td>
                <td>{p.purchase_orders?.vendor_name}</td>
                <td>{p.type}</td>
                <td style={{ fontWeight: 700 }}>{fmt(p.amount)}</td>
                <td style={{ color: p.is_overdue ? 'var(--danger)' : '' }}>{p.due_date}</td>
                <td><span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span></td>
                {showNotify
                  ? <td className="actions-cell">
                      <button className="btn btn-success btn-sm" onClick={() => setPayModal(p)}>💸 Pay</button>
                    </td>
                  : <>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.utr || '—'}</td>
                      <td>
                        {p.vendor_notified
                          ? <span className="badge badge-notified">✓ Notified</span>
                          : <button className="btn btn-secondary btn-sm" onClick={() => handleNotify(p.id)}>🔔 Notify</button>}
                      </td>
                    </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Layout title="Accountant Dashboard" navItems={navItems}>
      {loading ? <div className="spinner">Loading…</div> : <>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--info-light)' }}>🔔</div>
            <div className="stat-value">{approvedTotal}</div>
            <div className="stat-label">Awaiting Payment</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--success-light)' }}>💸</div>
            <div className="stat-value">{paidTotal}</div>
            <div className="stat-label">Payments Made</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--warning-light)' }}>📢</div>
            <div className="stat-value">{paid.filter(p => !p.vendor_notified).length}</div>
            <div className="stat-label">Pending Notifications (this page)</div>
          </div>
        </div>

        {tab === 'approved' && <>
          <div className="page-header">
            <div className="page-title">Approved Payments — Ready to Pay</div>
          </div>
          <PayTable data={approved} showNotify={true} />
          <Pagination page={approvedPage} total={approvedTotal} pageSize={PAGE_SIZE} onPageChange={setApprovedPage} />
        </>}

        {tab === 'paid' && <>
          <div className="page-header">
            <div className="page-title">Payment History</div>
          </div>
          <PayTable data={paid} showNotify={false} />
          <Pagination page={paidPage} total={paidTotal} pageSize={PAGE_SIZE} onPageChange={setPaidPage} />
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

      {payModal && <UTRModal payment={payModal} onClose={() => setPayModal(null)} onDone={load} />}
    </Layout>
  );
}