/**
 * ProjectForge: Faculty Supervisor Profile Migration Script
 *
 * PURPOSE:
 * Updates the existing four demonstration supervisor accounts with the exact
 * user-supplied Faculty of Engineering profiles and departments.
 *
 * SAFETY GUARDS:
 * 1. DEFAULT MODE IS READ-ONLY DRY RUN. Zero database writes occur unless explicitly confirmed.
 * 2. Real updates strictly require the `--confirm` CLI flag or `CONFIRM_MIGRATION=true` env var.
 * 3. Verifies connection to the target database before committing writes.
 * 4. Strictly matches ONLY the 4 known demo login emails:
 *    - sarah.chen@university.edu
 *    - marcus.vance@university.edu
 *    - elena.rostova@university.edu
 *    - alan.tb@university.edu
 * 5. Requires all 4 records to exist with accountType === 'supervisor'. Rejects execution if
 *    any account is missing, corrupted, or has an unexpected account type.
 * 6. Updates ONLY profile fields: name, designation, department, contactEmail, officeLocation, researchInterests.
 * 7. Strictly PRESERVES _id, email, passwordHash, accountType, maxCapacity, and all project/request links.
 * 8. Uses MongoDB ACID transactions when writing.
 * 9. Never prints passwords, hashes, tokens, or credential strings.
 * 10. Fully idempotent: subsequent runs detect updated data and report no-op changes.
 *
 * DO NOT RUN THIS SCRIPT UNLESS EXPLICITLY AUTHORIZED.
 */

const path = require('path');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');

const TARGET_SUPERVISORS = [
  {
    loginEmail: 'sarah.chen@university.edu',
    profileData: {
      name: 'Dr. K.L.M.N. Darmaweera',
      designation: 'Senior Lecturer',
      department: 'Department of Electrical and Information Engineering',
      contactEmail: 'Darmaweera@ruh.ac.lk',
      officeLocation: 'Electric Machines and Power Systems Laboratory',
      researchInterests: [
        'Power Electronics',
        'Renewable Energy',
        'Sensor Fusion Techniques',
        'Smart Grid Technologies'
      ]
    },
    // Historical profile data for recovery / rollback reference
    recoveryData: {
      name: 'Dr. Sarah Chen',
      designation: 'Associate Professor',
      department: 'Computer',
      contactEmail: null,
      officeLocation: 'Tech Tower Lab 402',
      researchInterests: ['Embedded Systems', 'IoT', 'Edge AI']
    }
  },
  {
    loginEmail: 'marcus.vance@university.edu',
    profileData: {
      name: 'Prof. Sujani N. Thilakarathne',
      designation: 'Professor',
      department: 'Department of Civil and Environmental Engineering',
      contactEmail: 'Sujani@ruh.ac.lk',
      officeLocation: 'Building Materials and Construction Laboratory',
      researchInterests: [
        'Construction Materials',
        'Concrete Structures',
        'Steel Structures',
        'Dynamics and Vibration Control'
      ]
    },
    recoveryData: {
      name: 'Prof. Marcus Vance',
      designation: 'Professor',
      department: 'Electrical',
      contactEmail: null,
      officeLocation: 'Energy Sciences Building 210',
      researchInterests: ['Power Electronics', 'Smart Grids', 'Renewable Energy']
    }
  },
  {
    loginEmail: 'elena.rostova@university.edu',
    profileData: {
      name: 'Dr. Priyanvada Samaradiyakara',
      designation: 'Senior Lecturer',
      department: 'Department of Computer Engineering',
      contactEmail: 'Priyanvada@ruh.ac.lk',
      officeLocation: 'Artificial Intelligence and Machine Learning Laboratory',
      researchInterests: [
        'Artificial Intelligence',
        'Augmented and Virtual Reality',
        'Computer Systems',
        'Cyber Security'
      ]
    },
    recoveryData: {
      name: 'Dr. Elena Rostova',
      designation: 'Assistant Professor',
      department: 'Mechanical',
      contactEmail: null,
      officeLocation: 'Robotics Center 105',
      researchInterests: ['Robotics', 'Biomechanics', 'Mechatronics']
    }
  },
  {
    loginEmail: 'alan.tb@university.edu',
    profileData: {
      name: 'Dr. G.K.D. Alvitigala',
      designation: 'Senior Lecturer',
      department: 'Department of Mechanical and Manufacturing Engineering',
      contactEmail: 'Alvitigala@ruh.ac.lk',
      officeLocation: 'Applied Mechanics and Mechatronics Laboratory',
      researchInterests: [
        'Fluid Mechanics and Fluid Power Systems',
        'Industrial Automation',
        'Manufacturing Engineering'
      ]
    },
    recoveryData: {
      name: 'Dr. Alan Turing-Babbage',
      designation: 'Professor',
      department: 'Computer',
      contactEmail: null,
      officeLocation: 'Computing Hall 301',
      researchInterests: ['Distributed Systems', 'Cloud Computing', 'Fault Tolerance']
    }
  }
];

async function runMigration(options = {}) {
  const isConfirmed = options.confirm === true ||
    process.argv.includes('--confirm') ||
    process.env.CONFIRM_MIGRATION === 'true';

  const isDryRun = !isConfirmed;

  console.log('===================================================================');
  console.log('ProjectForge: Faculty Supervisor Profile Migration');
  console.log('===================================================================');
  console.log(`Execution Mode: ${isDryRun ? '>>> DRY RUN (READ ONLY) <<<' : '>>> REAL UPDATE (WRITES ENABLED) <<<'}`);
  if (isDryRun) {
    console.log('NOTE: Dry run mode active. No documents will be created, modified, or deleted.');
    console.log('To execute real migration: npm run update -- --confirm');
  }
  console.log('-------------------------------------------------------------------\n');

  const mongoUri = options.mongoUri || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('Missing MONGO_URI in configuration. Aborting.');
  }

  if (process.env.NODE_ENV !== 'production') {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }

  let localConnection = false;
  if (mongoose.connection.readyState !== 1) {
    console.log('[INFO] Connecting to MongoDB...');
    await mongoose.connect(mongoUri, { authSource: 'admin' });
    localConnection = true;
  }

  const dbName = mongoose.connection.name;
  console.log(`[INFO] Connected database: "${dbName}"\n`);

  // For real updates in production/development, verify target DB name
  const expectedDb = options.expectedDb || 'projectforge_db';
  if (!isDryRun && dbName !== expectedDb && !options.skipDbCheck) {
    throw new Error(`Target database "${dbName}" does not match expected "${expectedDb}". Aborting real migration.`);
  }

  try {
    // 1. Pre-Flight Inspection: Verify all four target accounts exist
    const matchedUsers = [];
    const missingEmails = [];
    const invalidAccounts = [];

    for (const target of TARGET_SUPERVISORS) {
      const user = await User.findOne({ email: target.loginEmail });
      if (!user) {
        missingEmails.push(target.loginEmail);
      } else if (user.accountType !== 'supervisor') {
        invalidAccounts.push({ email: target.loginEmail, accountType: user.accountType });
      } else {
        matchedUsers.push({ target, user });
      }
    }

    if (missingEmails.length > 0) {
      throw new Error(`Pre-flight validation failed: missing supervisor account(s): ${missingEmails.join(', ')}.`);
    }

    if (invalidAccounts.length > 0) {
      throw new Error(`Pre-flight validation failed: account(s) have non-supervisor accountType: ${JSON.stringify(invalidAccounts)}.`);
    }

    if (matchedUsers.length !== 4) {
      throw new Error(`Expected exactly 4 matched supervisor accounts, found ${matchedUsers.length}. Aborting.`);
    }

    console.log('[VALIDATION] All 4 demonstration supervisor accounts verified successfully.\n');

    // 2. Prepare Before-and-After Summary
    const changeSummary = [];

    for (const { target, user } of matchedUsers) {
      const p = target.profileData;
      const beforeState = {
        _id: user._id.toString(),
        loginEmail: user.email,
        name: user.name,
        designation: user.designation,
        department: user.department,
        contactEmail: user.contactEmail || null,
        officeLocation: user.officeLocation,
        researchInterests: user.researchInterests || [],
        maxCapacity: user.maxCapacity
      };

      const afterState = {
        _id: user._id.toString(), // Preserved
        loginEmail: user.email,   // Preserved
        name: p.name,
        designation: p.designation,
        department: p.department,
        contactEmail: p.contactEmail,
        officeLocation: p.officeLocation,
        researchInterests: p.researchInterests,
        maxCapacity: user.maxCapacity // Preserved
      };

      // Check if changes are actually needed (idempotency check)
      const isAlreadyUpdated =
        user.name === p.name &&
        user.designation === p.designation &&
        user.department === p.department &&
        user.contactEmail === p.contactEmail &&
        user.officeLocation === p.officeLocation &&
        JSON.stringify(user.researchInterests) === JSON.stringify(p.researchInterests);

      changeSummary.push({
        loginEmail: user.email,
        isAlreadyUpdated,
        before: beforeState,
        after: afterState
      });
    }

    // 3. Print Sanitized Diff
    for (const item of changeSummary) {
      console.log(`--- [Account: ${item.loginEmail}] ---`);
      console.log(`  ID:                ${item.before._id} (PRESERVED)`);
      console.log(`  Auth Login Email:  ${item.before.loginEmail} (PRESERVED)`);
      console.log(`  Max Capacity:      ${item.before.maxCapacity} (PRESERVED)`);
      console.log(`  Status:            ${item.isAlreadyUpdated ? 'ALREADY UP TO DATE (No-op)' : 'NEEDS UPDATE'}`);
      console.log(`  Name:              "${item.before.name}" -> "${item.after.name}"`);
      console.log(`  Designation:       "${item.before.designation}" -> "${item.after.designation}"`);
      console.log(`  Department:        "${item.before.department}" -> "${item.after.department}"`);
      console.log(`  Contact Email:     ${item.before.contactEmail} -> "${item.after.contactEmail}"`);
      console.log(`  Office Location:   "${item.before.officeLocation}" -> "${item.after.officeLocation}"`);
      console.log(`  Specializations:   [${item.before.researchInterests.join(', ')}] -> [${item.after.researchInterests.join(', ')}]\n`);
    }

    // 4. Execution or Dry Run Return
    if (isDryRun) {
      console.log('===================================================================');
      console.log('DRY RUN COMPLETE: Verified all 4 accounts. Zero database changes made.');
      console.log('To execute the actual migration, run with explicit confirmation:');
      console.log('  npm run update -- --confirm');
      console.log('===================================================================\n');
      return { success: true, dryRun: true, changes: changeSummary };
    }

    // 5. Confirmed Real Migration (Transaction-Protected)
    console.log('[EXECUTION] Applying verified updates inside MongoDB transaction...');

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const { target, user } of matchedUsers) {
          const p = target.profileData;
          await User.updateOne(
            { _id: user._id, email: target.loginEmail, accountType: 'supervisor' },
            {
              $set: {
                name: p.name,
                designation: p.designation,
                department: p.department,
                contactEmail: p.contactEmail,
                officeLocation: p.officeLocation,
                researchInterests: p.researchInterests
              }
            },
            { session }
          );
        }
      });
    } finally {
      await session.endSession();
    }

    console.log('\n[SUCCESS] Transaction committed. All 4 supervisor profiles successfully updated.');
    console.log('All login credentials, IDs, capacities, and project links remain intact.\n');

    return { success: true, dryRun: false, changes: changeSummary };
  } finally {
    if (localConnection) {
      await mongoose.disconnect();
      console.log('[INFO] Database connection closed.');
    }
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n[FATAL] Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = {
  runMigration,
  TARGET_SUPERVISORS
};

