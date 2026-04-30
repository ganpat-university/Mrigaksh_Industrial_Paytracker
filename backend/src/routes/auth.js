// src/routes/auth.js
// POST /api/auth/register  - create new user with role
// POST /api/auth/login     - sign in, get JWT
// GET  /api/auth/me        - get current user profile

import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// ─── REGISTER ────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'email, password, name, and role are required' });
  }

  if (!['user', 'vendor'].includes(role)) {
    return res.status(400).json({ error: 'role must be "user" or "vendor"' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,          // skip email confirmation for dev
    user_metadata: { name, role }
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  // Insert into public.users (the DB trigger does this automatically,
  // but we do it manually here as a fallback / explicit control)
  const { error: profileError } = await supabaseAdmin
  .from('users')
  .upsert({
    id: authData.user.id,
    email: authData.user.email,
    name,
    role,
    created_at: new Date().toISOString() // ✅ ensures no NULL
  });
  if (profileError) {
    console.error('Profile insert error:', profileError);
    // Don't fail — auth user was created, profile upsert is recoverable
  }

  res.status(201).json({
    message: 'User registered successfully',
    user: { id: authData.user.id, email, name, role }
  });
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Fetch role
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('name, role')
    .eq('id', data.user.id)
    .single();

  res.json({
    token:         data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: {
      id:    data.user.id,
      email: data.user.email,
      name:  profile?.name,
      role:  profile?.role,
    }
  });
});

// ─── ME ───────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ─── ADMIN: LIST ALL USERS (paginated) ───────────────────────────────────────
router.get('/users', authenticate, requireRole('admin'), async (req, res) => {

  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10)); // ✅ respect limit param, default 10
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  const { data, count, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, role, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({
    data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  });
});

// ─── ADMIN: UPDATE USER ROLE ────────────────────────────────────────────────
router.patch('/role/:id', authenticate, requireRole('admin'), async (req, res) => {
  const { role } = req.body;
  const userId = req.params.id;

  if (!['admin', 'accountant', 'user', 'vendor'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Step 1: Confirm user exists in Supabase Auth + get their email/name
  const { data: authUser, error: authFetchError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (authFetchError || !authUser?.user) {
    return res.status(404).json({ error: 'User not found in Supabase Auth. Check the user ID.' });
  }

  // Step 2: Update Auth metadata
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { role }
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  // Step 3: upsert instead of update
  // update() returns empty array when the row doesn't exist in public.users yet
  // (admin seeded via Dashboard never gets a trigger-created row)
  // upsert() creates the row if missing, updates it if present — always works
  const name = authUser.user.user_metadata?.name || authUser.user.email.split('@')[0];

  const { data, error: profileError } = await supabaseAdmin
    .from('users')
    .upsert({ id: userId, email: authUser.user.email, name, role })
    .select();

  if (profileError) {
    return res.status(500).json({ error: profileError.message });
  }

  res.json({ message: 'User role updated successfully', user: data[0] });
});

export default router;