import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import {
  getPOs, createPO, deletePO,
  getPayments, createPayment, approvePayment, deletePayment,
  getUsers, updateUserRole,
  uploadBulkPayments, downloadTemplate
} from '../api';
import api from '../api';

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
  const [file, setFile]         = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');

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
      // reset file input
      document.getElementById('admin-upload-input').value = '';
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

        <label htmlFor="admin-upload-input" style={{
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
          <input id="admin-upload-input" type="file" accept=".csv,.xlsx,.xls"
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
              document.getElementById('admin-upload-input').value = '';
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

export default function AdminDashboard() {
  const PAGE_SIZE = 10;

  const [tab, setTab] = useState('overview');
  const [pos, setPOs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [poForm, setPOForm] = useState({ po_number: '', vendor_name: '', total_amount: '', payment_terms: '' });
  const [payForm, setPayForm] = useState({ po_id: '', type: 'Advance', amount: '', due_date: '' });
  const [formErr, setFormErr] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleModal, setRoleModal] = useState(null);

  // ── Pagination state ──
  const [poPage,    setPoPage]    = useState(1);
  const [payPage,   setPayPage]   = useState(1);
  const [userPage,  setUserPage]  = useState(1);
  const [poTotal,   setPoTotal]   = useState(0);
  const [payTotal,  setPayTotal]  = useState(0);
  const [userTotal, setUserTotal] = useState(0);

  // ── Accurate stat totals (across all pages, not just current page) ──
  const [pendingCount,  setPendingCount]  = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [paidCount,     setPaidCount]     = useState(0);
  const [totalValue,    setTotalValue]    = useState(0);

  // Reset page 1 when filter changes
  useEffect(() => { setPayPage(1); }, [statusFilter]);

  // ✅ Reset user page to 1 when switching to users tab
  useEffect(() => { setUserPage(1); }, [tab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, payRes, usersRes, pendRes, apprRes, paidRes] = await Promise.all([
        getPOs({ page: poPage, limit: PAGE_SIZE }),
        getPayments({
          ...(statusFilter ? { status: statusFilter } : {}),
          page: payPage,
          limit: PAGE_SIZE,
        }),
        // ✅ Always pass page + limit so backend paginates correctly
        getUsers({ page: userPage, limit: PAGE_SIZE }),
        // ✅ Fetch counts for each status separately so stats are accurate across all pages
        getPayments({ status: 'Pending',  page: 1, limit: 1 }),
        getPayments({ status: 'Approved', page: 1, limit: 1 }),
        getPayments({ status: 'Paid',     page: 1, limit: 1 }),
      ]);

      setPOs(poRes.data.data);
      setPoTotal(poRes.data.total ?? poRes.data.data.length);

      setPayments(payRes.data.data);
      setPayTotal(payRes.data.total ?? payRes.data.data.length);

      // ✅ Correctly read paginated user list
      setUsers(usersRes.data.data || []);
      setUserTotal(usersRes.data.total ?? (usersRes.data.data || []).length);

      // ✅ Accurate counts from total field, not from filtered page array
      setPendingCount(pendRes.data.total  ?? 0);
      setApprovedCount(apprRes.data.total ?? 0);
      setPaidCount(paidRes.data.total     ?? 0);

      // Total value: sum across all payments in the current (possibly filtered) view
      // If your API returns a totalValue field use that, otherwise sum current page as approximation
      setTotalValue(
        payRes.data.totalValue ??
        payRes.data.data.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
      );

    } catch (err) {
      console.error('Load error:', err);
      try {
        const poRes = await getPOs({ page: poPage, limit: PAGE_SIZE });
        setPOs(poRes.data.data);
        setPoTotal(poRes.data.total ?? poRes.data.data.length);
      } catch {}
    } finally { setLoading(false); }
  }, [statusFilter, poPage, payPage, userPage]);

  useEffect(() => { load(); }, [load]);

  // ✅ Use separate stat state vars — not derived from current page's payments array
  const stats = {
    totalPOs:      poTotal,
    totalPayments: payTotal,
    pending:       pendingCount,
    approved:      approvedCount,
    paid:          paidCount,
    totalValue,
  };

  const handleCreatePO = async (e) => {
    e.preventDefault(); setFormErr('');
    try {
      await createPO(poForm);
      setShowPOModal(false);
      setPOForm({ po_number: '', vendor_name: '', total_amount: '', payment_terms: '' });
      load();
    } catch (err) { setFormErr(err.response?.data?.error || 'Failed to create PO'); }
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

  const handleApprove = async (id) => {
    if (!confirm('Approve this payment?')) return;
    try { await approvePayment(id); load(); } catch (err) { alert(err.response?.data?.error); }
  };

  const handleDeletePayment = async (id) => {
    if (!confirm('Delete this payment?')) return;
    try { await deletePayment(id); load(); } catch (err) { alert(err.response?.data?.error); }
  };

  const handleDeletePO = async (id) => {
    if (!confirm('Delete this PO? Only works if no payments exist.')) return;
    try { await deletePO(id); load(); } catch (err) { alert(err.response?.data?.error); }
  };

  const handleRoleChange = async (userId, role) => {
    try { await updateUserRole(userId, role); setRoleModal(null); load(); }
    catch (err) { alert(err.response?.data?.error); }
  };

  const navItems = [
    { label: 'Overview',        icon: '📊', active: tab === 'overview',  onClick: () => setTab('overview') },
    { label: 'Purchase Orders', icon: '📋', active: tab === 'pos',       onClick: () => setTab('pos') },
    { label: 'Payments',        icon: '💰', active: tab === 'payments',  onClick: () => setTab('payments') },
    { label: 'Bulk Upload',     icon: '📤', active: tab === 'upload',    onClick: () => setTab('upload') },
    { label: 'User Management', icon: '👥', active: tab === 'users',     onClick: () => setTab('users') },
  ];

  return (
    <Layout title="Admin Dashboard" navItems={navItems}>
      {loading ? <div className="spinner">Loading…</div> : <>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'var(--accent-light)' }}>📋</div>
                <div className="stat-value">{stats.totalPOs}</div>
                <div className="stat-label">Purchase Orders</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'var(--warning-light)' }}>⏳</div>
                <div className="stat-value">{stats.pending}</div>
                <div className="stat-label">Pending Approvals</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'var(--info-light)' }}>✅</div>
                <div className="stat-value">{stats.approved}</div>
                <div className="stat-label">Approved Payments</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'var(--success-light)' }}>💸</div>
                <div className="stat-value">{stats.paid}</div>
                <div className="stat-label">Paid Out</div>
              </div>
              <div className="stat-card stat-card-wide">
                <div className="stat-icon" style={{ background: 'rgba(251,191,36,0.12)' }}>💰</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{fmt(stats.totalValue)}</div>
                <div className="stat-label">Total Payment Value</div>
              </div>
            </div>

            <div className="card">
              <div className="page-header" style={{ marginBottom: 16 }}>
                <div>
                  <div className="page-title" style={{ fontSize: 16 }}>⏳ Pending Approvals</div>
                  <div className="page-subtitle">Payments waiting for your approval</div>
                </div>
              </div>
              {payments.filter(p => p.status === 'Pending').length === 0
                ? <div className="empty-state"><div className="empty-state-icon">🎉</div><div className="empty-state-text">All caught up!</div></div>
                : <div className="table-wrap">
                    <table>
                      <thead><tr>
                        <th>PO</th><th>Vendor</th><th>Type</th><th>Amount</th><th>Due</th><th>Action</th>
                      </tr></thead>
                      <tbody>
                        {payments.filter(p => p.status === 'Pending').map(p => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }}>{p.purchase_orders?.po_number}</td>
                            <td>{p.purchase_orders?.vendor_name}</td>
                            <td>{p.type}</td>
                            <td style={{ fontWeight: 700 }}>{fmt(p.amount)}</td>
                            <td style={{ color: p.is_overdue ? 'var(--danger)' : '' }}>{p.due_date}</td>
                            <td>
                              <button className="btn btn-success btn-sm" onClick={() => handleApprove(p.id)}>✅ Approve</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
            </div>
          </>
        )}

        {/* PURCHASE ORDERS */}
        {tab === 'pos' && (
          <>
            <div className="page-header">
              <div className="page-title">Purchase Orders</div>
              <button className="btn btn-primary" onClick={() => { setFormErr(''); setShowPOModal(true); }}>+ New PO</button>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>PO Number</th><th>Vendor</th><th>Total</th><th>Allocated</th><th>Remaining</th><th>Payments</th><th>Action</th>
                  </tr></thead>
                  <tbody>
                    {pos.length === 0 && <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-text">No POs yet</div></div></td></tr>}
                    {pos.map(po => (
                      <tr key={po.id}>
                        <td style={{ fontWeight: 700 }}>{po.po_number}</td>
                        <td>{po.vendor_name}</td>
                        <td>{fmt(po.total_amount)}</td>
                        <td>{fmt(po.allocated_amount)}</td>
                        <td style={{ color: po.remaining_amount < 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(po.remaining_amount)}</td>
                        <td><span className="badge badge-user">{po.payment_count} payments</span></td>
                        <td className="actions-cell">
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeletePO(po.id)}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination page={poPage} total={poTotal} pageSize={PAGE_SIZE} onPageChange={setPoPage} />
          </>
        )}

        {/* PAYMENTS */}
        {tab === 'payments' && (
          <>
            <div className="page-header">
              <div>
                <div className="page-title">All Payments</div>
              </div>
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
                    <th>PO</th><th>Vendor</th><th>Type</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {payments.length === 0 && <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-text">No payments found</div></div></td></tr>}
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.purchase_orders?.po_number}</td>
                        <td>{p.purchase_orders?.vendor_name}</td>
                        <td>{p.type}</td>
                        <td style={{ fontWeight: 700 }}>{fmt(p.amount)}</td>
                        <td style={{ color: p.is_overdue ? 'var(--danger)' : '' }}>{p.due_date}{p.is_overdue && ' 🔴'}</td>
                        <td><span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span></td>
                        <td className="actions-cell">
                          {p.status === 'Pending' && <button className="btn btn-success btn-sm" onClick={() => handleApprove(p.id)}>✅ Approve</button>}
                          {p.status === 'Pending' && <button className="btn btn-danger btn-sm" onClick={() => handleDeletePayment(p.id)}>🗑</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination page={payPage} total={payTotal} pageSize={PAGE_SIZE} onPageChange={setPayPage} />
          </>
        )}

        {/* BULK UPLOAD */}
        {tab === 'upload' && (
          <>
            <div className="page-header">
              <div>
                <div className="page-title">Bulk Upload Payments</div>
                <div className="page-subtitle">Upload a CSV or Excel file to create multiple payments at once</div>
              </div>
            </div>
            <UploadPanel />
          </>
        )}

        {/* USER MANAGEMENT */}
        {tab === 'users' && (
          <>
            <div className="page-header">
              <div>
                <div className="page-title">User Management</div>
                <div className="page-subtitle">Assign roles to registered users</div>
              </div>
            </div>
            <div className="card" style={{ padding: 0 }}>
              {users.length === 0
                ? <div className="empty-state">
                    <div className="empty-state-icon">👥</div>
                    <div className="empty-state-text">No users found</div>
                  </div>
                : <div className="table-wrap">
                    <table>
                      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr></thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id}>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                            <td><button className="btn btn-secondary btn-sm" onClick={() => setRoleModal(u)}>✏️ Change Role</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
            </div>
            {/* ✅ User pagination now wired correctly */}
            <Pagination page={userPage} total={userTotal} pageSize={PAGE_SIZE} onPageChange={setUserPage} />
          </>
        )}
      </>}

      {/* PO Modal */}
      {showPOModal && (
        <Modal title="Create Purchase Order" onClose={() => setShowPOModal(false)}>
          {formErr && <div className="alert alert-error">{formErr}</div>}
          <form onSubmit={handleCreatePO}>
            <div className="form-group"><label className="form-label">PO Number</label>
              <input className="form-input" placeholder="PO-2024-001" value={poForm.po_number}
                onChange={e => setPOForm(p => ({ ...p, po_number: e.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Vendor Name</label>
              <input className="form-input" placeholder="Vendor Company Ltd" value={poForm.vendor_name}
                onChange={e => setPOForm(p => ({ ...p, vendor_name: e.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Total Amount (₹)</label>
              <input className="form-input" type="number" placeholder="500000" value={poForm.total_amount}
                onChange={e => setPOForm(p => ({ ...p, total_amount: e.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Payment Terms</label>
              <input className="form-input" placeholder="50% Advance, 50% Final" value={poForm.payment_terms}
                onChange={e => setPOForm(p => ({ ...p, payment_terms: e.target.value }))} required /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPOModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create PO</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Payment Modal */}
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
            <div className="form-group"><label className="form-label">Payment Type</label>
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
              <button type="submit" className="btn btn-primary">Create Payment</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Role Modal */}
      {roleModal && (
        <Modal title={`Change role for ${roleModal.name}`} onClose={() => setRoleModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['admin', 'accountant', 'user', 'vendor'].map(r => (
              <button key={r} className={`btn ${roleModal.role === r ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleRoleChange(roleModal.id, r)}>
                <span className={`badge badge-${r}`}>{r}</span> {roleModal.role === r ? '(current)' : ''}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </Layout>
  );
}