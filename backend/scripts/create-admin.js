#!/usr/bin/env node

/**
 * create-admin.js — Create or promote a Super-Admin user in GEU Alumni Connect
 *
 * Usage:
 *   node scripts/create-admin.js [email] [username] [password] [fullName]
 *
 * Defaults:
 *   Email:     admin@geu.ac.in
 *   Username:  admin
 *   Password:  Admin@12345
 *   FullName:  System Administrator
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');

async function createOrPromoteAdmin() {
  const email = process.argv[2] || 'admin@geu.ac.in';
  const username = process.argv[3] || 'admin';
  const password = process.argv[4] || 'Admin@12345';
  const fullName = process.argv[5] || 'System Administrator';

  try {
    console.log(`Checking existing user for email (${email}) or username (${username})...`);

    const existingUser = await db.query(
      `SELECT * FROM users WHERE email = $1 OR username = $2`,
      [email, username]
    );

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let userId;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      console.log(`User already exists (ID: ${userId}). Upgrading to Super-Admin and resetting password...`);
      await db.query(
        `UPDATE users
            SET password_hash = $1,
                is_admin = TRUE,
                is_super_admin = TRUE,
                must_change_password = FALSE
          WHERE id = $2`,
        [passwordHash, userId]
      );
    } else {
      console.log(`Creating new Super-Admin user...`);
      const res = await db.query(
        `INSERT INTO users (email, username, password_hash, is_admin, is_super_admin, must_change_password)
         VALUES ($1, $2, $3, TRUE, TRUE, FALSE)
         RETURNING id`,
        [email, username, passwordHash]
      );
      userId = res.rows[0].id;

      // Ensure profile exists
      await db.query(
        `INSERT INTO profiles (user_id, full_name, headline)
         VALUES ($1, $2, 'GEU Super Administrator')
         ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name`,
        [userId, fullName]
      );
    }

    console.log(`\n=======================================================`);
    console.log(`  SUPER-ADMIN CREATED / UPDATED SUCCESSFULLY!`);
    console.log(`=======================================================`);
    console.log(`  User ID:    ${userId}`);
    console.log(`  Email:      ${email}`);
    console.log(`  Username:   ${username}`);
    console.log(`  Password:   ${password}`);
    console.log(`  Role:       Super-Admin (is_admin=true, is_super_admin=true)`);
    console.log(`=======================================================\n`);
  } catch (err) {
    console.error('Failed to create/update admin user:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createOrPromoteAdmin();
