// src/middleware/auth.js
// authenticate  - verifies Supabase JWT and attaches user + role to req
// requireRole   - role-based guard middleware factory

import { supabaseAdmin } from '../config/supabase.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch role and name from our public.users table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'User profile not found. Ensure the user is registered.' });
    }

    req.user = {
      id:    profile.id,
      name:  profile.name,
      email: profile.email,
      role:  profile.role,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal auth error' });
  }
};

// Usage: router.patch('/approve', requireRole('admin'), handler)
export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`
    });
  }
  next();
};

// Blocks vendors from accessing internal routes
export const blockVendor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.user.role === 'vendor') {
    return res.status(403).json({
      error: 'Access denied. Vendors cannot access internal payment data. Use /api/vendor/my-notifications to see your payment status.'
    });
  }
  next();
};
