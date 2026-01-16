// Script to delete a user from Supabase
// Usage: node scripts/delete-user.js rewardly30@gmail.com

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role key

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deleteUser(email) {
  try {
    console.log(`🔍 Searching for user: ${email}`);

    // Find the user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      throw listError;
    }

    const user = users.users.find(u => u.email === email);

    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return;
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    console.log(`Created at: ${user.created_at}`);

    // Delete the user
    console.log(`🗑️  Deleting user...`);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`✅ Successfully deleted user: ${email}`);
    console.log('🧹 All related data (profiles, messages, etc.) has been cleaned up via CASCADE');

  } catch (error) {
    console.error('❌ Error deleting user:', error.message);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: node scripts/delete-user.js <email>');
  console.log('Example: node scripts/delete-user.js rewardly30@gmail.com');
  process.exit(1);
}

deleteUser(email);
