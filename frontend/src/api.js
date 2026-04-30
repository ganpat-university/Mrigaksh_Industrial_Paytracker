import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// AUTH
export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');
export const getUsers = (params) => api.get('/auth/users', { params });
export const updateUserRole = (id, role) => api.patch(`/auth/role/${id}`, { role });

// PURCHASE ORDERS
export const getPOs = (params) => api.get('/purchase-orders', { params })
export const getPO = (id) => api.get(`/purchase-orders/${id}`);
export const createPO = (data) => api.post('/purchase-orders', data);
export const updatePO = (id, data) => api.put(`/purchase-orders/${id}`, data);
export const deletePO = (id) => api.delete(`/purchase-orders/${id}`);

// PAYMENTS
export const getPayments = (params) => api.get('/payments', { params });
export const getPayment = (id) => api.get(`/payments/${id}`);
export const createPayment = (data) => api.post('/payments', data);
export const approvePayment = (id) => api.patch(`/payments/${id}/approve`);
export const markPaid = (id, utr) => api.patch(`/payments/${id}/pay`, { utr });
export const notifyVendor = (id) => api.patch(`/payments/${id}/notify`);
export const deletePayment = (id) => api.delete(`/payments/${id}`);

// UPLOAD
export const uploadBulkPayments = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/upload/bulk-payments', form);
};

export const downloadTemplate = async () => {
  const res = await api.get('/upload/template', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'payments_template.csv';
  a.click();
  window.URL.revokeObjectURL(url);
};

// VENDOR
export const getVendorNotifications = () => api.get('/vendor/my-notifications');

export default api;