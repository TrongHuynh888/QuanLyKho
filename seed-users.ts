import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function seedUsers() {
  console.log('👤 Seeding auth users...\n');

  const users = [
    { email: 'huynhphutrong8223@gmail.com', password: 'Trong123', full_name: 'Huỳnh Phú Trọng', role: 'admin' },
    { email: 'manager@taika.vn', password: 'Manager@123', full_name: 'Nguyễn Quản Lý', role: 'manager' },
    { email: 'worker@taika.vn', password: 'Worker@123', full_name: 'Trần Nhân Viên', role: 'worker' },
  ];

  for (const u of users) {
    // Create user via admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });

    if (error) {
      if (error.message.includes('already been registered')) {
        console.log(`ℹ️  ${u.email} already exists, updating role...`);
        // Find and update existing user's profile
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', u.email);
        if (profiles && profiles.length > 0) {
          await supabase
            .from('profiles')
            .update({ role: u.role, full_name: u.full_name })
            .eq('id', profiles[0].id);
          console.log(`  ✅ Updated role to '${u.role}'`);
        }
      } else {
        console.log(`❌ ${u.email}: ${error.message}`);
      }
    } else if (data.user) {
      // Update the profile role (trigger creates it as 'worker' by default)
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ role: u.role })
        .eq('id', data.user.id);
      if (profileErr) {
        console.log(`❌ Profile update for ${u.email}: ${profileErr.message}`);
      } else {
        console.log(`✅ ${u.email} → role: ${u.role}`);
      }
    }
  }

  console.log('\n🎉 Auth seeding complete!');
  console.log('\nTest accounts:');
  console.log('  Admin:   huynhphutrong8223@gmail.com / Trong123');
  console.log('  Manager: manager@taika.vn / Manager@123');
  console.log('  Worker:  worker@taika.vn / Worker@123');
}

seedUsers().catch(console.error);
