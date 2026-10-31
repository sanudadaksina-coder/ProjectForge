/**
 * ProjectForge: Supervisor Account Provisioning Seed Script
 *
 * PROVISIONING PURPOSE:
 * Provides controlled generation of fictional faculty supervisor accounts
 * for demonstration and evaluation without exposing a public signup endpoint.
 *
 * SAFETY GUARDS:
 * 1. Requires explicit seed password via process.env.SUPERVISOR_SEED_PASSWORD.
 * 2. Requires explicit execution confirmation via process.env.CONFIRM_SEED === 'true' or '--confirm' argument.
 * 3. Fully idempotent: will NOT duplicate existing users or overwrite existing credentials.
 * 4. Displays only sanitized non-sensitive summaries (never prints passwords or secrets).
 *
 * DO NOT RUN IN AUTOMATED TESTS OR WITHOUT EXPLICIT ADMINISTRATIVE INTENT.
 */

const path = require('path');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

const FICTIONAL_SUPERVISORS = [
  {
    name: 'Dr. K.L.M.N. Darmaweera',
    email: 'sarah.chen@university.edu',
    contactEmail: 'Darmaweera@ruh.ac.lk',
    accountType: 'supervisor',
    department: 'Department of Electrical and Information Engineering',
    designation: 'Senior Lecturer',
    researchInterests: [
      'Power Electronics',
      'Renewable Energy',
      'Sensor Fusion Techniques',
      'Smart Grid Technologies'
    ],
    officeLocation: 'Electric Machines and Power Systems Laboratory',
    maxCapacity: 5
  },
  {
    name: 'Prof. Sujani N. Thilakarathne',
    email: 'marcus.vance@university.edu',
    contactEmail: 'Sujani@ruh.ac.lk',
    accountType: 'supervisor',
    department: 'Department of Civil and Environmental Engineering',
    designation: 'Professor',
    researchInterests: [
      'Construction Materials',
      'Concrete Structures',
      'Steel Structures',
      'Dynamics and Vibration Control'
    ],
    officeLocation: 'Building Materials and Construction Laboratory',
    maxCapacity: 4
  },
  {
    name: 'Dr. Priyanvada Samaradiyakara',
    email: 'elena.rostova@university.edu',
    contactEmail: 'Priyanvada@ruh.ac.lk',
    accountType: 'supervisor',
    department: 'Department of Computer Engineering',
    designation: 'Senior Lecturer',
    researchInterests: [
      'Artificial Intelligence',
      'Augmented and Virtual Reality',
      'Computer Systems',
      'Cyber Security'
    ],
    officeLocation: 'Artificial Intelligence and Machine Learning Laboratory',
    maxCapacity: 5
  },
  {
    name: 'Dr. G.K.D. Alvitigala',
    email: 'alan.tb@university.edu',
    contactEmail: 'Alvitigala@ruh.ac.lk',
    accountType: 'supervisor',
    department: 'Department of Mechanical and Manufacturing Engineering',
    designation: 'Senior Lecturer',
    researchInterests: [
      'Fluid Mechanics and Fluid Power Systems',
      'Industrial Automation',
      'Manufacturing Engineering'
    ],
    officeLocation: 'Applied Mechanics and Mechatronics Laboratory',
    maxCapacity: 6
  }
];

async function seedSupervisors() {
  console.log('====================================================');
  console.log('ProjectForge: Faculty Supervisor Seed Provisioning');
  console.log('====================================================\n');

  // SAFETY GUARD 1: Explicit Seed Password Requirement
  const seedPassword = process.env.SUPERVISOR_SEED_PASSWORD;
  if (!seedPassword || typeof seedPassword !== 'string' || seedPassword.trim().length < 6) {
    console.error('[ERROR] Missing or invalid SUPERVISOR_SEED_PASSWORD environment variable.');
    console.error('To protect system security, supervisor accounts require an explicitly defined password.');
    console.error('Usage: SUPERVISOR_SEED_PASSWORD="<YourSecurePassword>" CONFIRM_SEED=true npm run seed:supervisors\n');
    process.exit(1);
  }

  // SAFETY GUARD 2: Explicit Confirmation Requirement
  const isConfirmed = process.env.CONFIRM_SEED === 'true' || process.argv.includes('--confirm');
  if (!isConfirmed) {
    console.error('[SAFETY ABORT] Execution not confirmed.');
    console.error('This script inserts demonstration faculty accounts into the configured MongoDB database.');
    console.error('To execute, supply the confirmation flag:');
    console.error('  CONFIRM_SEED=true npm run seed:supervisors');
    console.error('  OR: npm run seed:supervisors -- --confirm\n');
    process.exit(1);
  }

  // Database Connection
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('[ERROR] Missing MONGO_URI in environment configuration.\n');
    process.exit(1);
  }

  if (process.env.NODE_ENV !== 'production') {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }

  try {
    console.log('[INFO] Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      authSource: 'admin'
    });
    console.log(`[INFO] Connected to database: "${mongoose.connection.name}"\n`);

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(seedPassword.trim(), saltRounds);

    let createdCount = 0;
    let existingCount = 0;

    for (const supData of FICTIONAL_SUPERVISORS) {
      const existing = await User.findOne({ email: supData.email.toLowerCase().trim() });
      if (existing) {
        console.log(`  [EXISTS] ${supData.name} (${supData.email}) - Already registered. Preserving existing record.`);
        existingCount++;
        continue;
      }

      const supervisor = new User({
        ...supData,
        email: supData.email.toLowerCase().trim(),
        passwordHash
      });

      await supervisor.save();
      console.log(`  [CREATED] ${supData.name} (${supData.email}) - Department: ${supData.department}, Max Capacity: ${supData.maxCapacity}`);
      createdCount++;
    }

    console.log('\n----------------------------------------------------');
    console.log(`Seed completed successfully:`);
    console.log(`  - Created accounts:  ${createdCount}`);
    console.log(`  - Existing preserved: ${existingCount}`);
    console.log(`  - Total supervisors: ${createdCount + existingCount}`);
    console.log('----------------------------------------------------\n');
  } catch (error) {
    console.error('[FATAL] Error seeding supervisors:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[INFO] Database connection closed.');
  }
}

if (require.main === module) {
  seedSupervisors();
}

module.exports = { seedSupervisors, FICTIONAL_SUPERVISORS };

