/**
 * Seed script — creates initial Carpark + admin User directly in MongoDB.
 * Usage:  node scripts/seed.mjs
 * Requires .env.local with MONGODB_URI set.
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// ── 1. Load .env.local ────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');
try {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error('Could not read .env.local — make sure it exists in the project root.');
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI || MONGODB_URI.includes('YOUR_ACTUAL_PASSWORD')) {
  console.error('❌  MONGODB_URI in .env.local still has a placeholder password.');
  console.error('   Edit .env.local and replace YOUR_ACTUAL_PASSWORD with your real password.');
  process.exit(1);
}

// ── 2. Seed data — edit these if you want different credentials ───────────────
const CARPARK_NAME  = 'SoftNursery Carparking System';
const ADMIN_NAME    = 'SoftNursery';
const ADMIN_EMAIL   = 'admin@softnursery.com';
const ADMIN_PASSWORD = '12345678';
const CAPACITY      = 50;
const DAILY_RATE    = 25;  // NZD per day default

// ── 3. Connect and seed ───────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

console.log('Connecting to MongoDB…');
await mongoose.connect(MONGODB_URI, { bufferCommands: false, dbName: 'carpark' });
console.log('Connected ✓');

const db = mongoose.connection.db;

// Check if already seeded
const existingUser = await db.collection('users').findOne({});
if (existingUser) {
  console.log('⚠️  Database already has users — skipping seed to avoid duplicates.');
  console.log(`   Login with the existing admin account.`);
  await mongoose.disconnect();
  process.exit(0);
}

// Create Carpark
const carparkResult = await db.collection('carparks').insertOne({
  name: CARPARK_NAME,
  capacity: CAPACITY,
  dailyRate: DAILY_RATE,
  timezone: 'Pacific/Auckland',
  createdAt: new Date(),
  updatedAt: new Date(),
});
const carparkId = carparkResult.insertedId;
console.log(`Carpark created: ${CARPARK_NAME} (${carparkId})`);

// Create admin User
const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
const userResult = await db.collection('users').insertOne({
  carparkId,
  name: ADMIN_NAME,
  email: ADMIN_EMAIL.toLowerCase(),
  passwordHash,
  role: 'admin',
  initials: ADMIN_NAME.slice(0, 2).toUpperCase(),
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});
console.log(`Admin user created: ${ADMIN_EMAIL} (${userResult.insertedId})`);

await mongoose.disconnect();

console.log('');
console.log('✅  Seed complete!');
console.log('');
console.log('   Login at http://localhost:3000/login');
console.log(`   Email   : ${ADMIN_EMAIL}`);
console.log(`   Password: ${ADMIN_PASSWORD}`);
console.log('');
