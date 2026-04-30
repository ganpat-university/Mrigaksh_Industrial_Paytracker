import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from backend folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function seedAdmin() {
  const email = 'admin@payments.com';
  const password = 'SecurePassword123!';
  const name = 'Admin';
  const role = 'admin';

  console.log(`Creating admin user: ${email}...`);

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role }
  });

  if (authError) {
    console.error('Error creating admin user:', authError.message);
    process.exit(1);
  }

  // Ensure public.users table is updated (though the trigger should do it)
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .upsert({
      id: authData.user.id,
      email: email,
      name: name,
      role: role
    });

  if (profileError) {
    console.error('Error updating public.users profile:', profileError.message);
    process.exit(1);
  }

  console.log('✅ Admin user successfully seeded!');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log('You can now log in using these credentials.');
}

seedAdmin();
