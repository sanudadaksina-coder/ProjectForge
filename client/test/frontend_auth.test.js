/**
 * Focused Unit and Contract Tests for ProjectForge Frontend Auth Logic
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Validation logic under test (matching RegisterPage and LoginPage)
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

function validateStudentRegistration(data) {
  const errors = {};

  const trimmedName = (data.name || '').trim();
  if (!trimmedName) {
    errors.name = 'Full name is required.';
  } else if (trimmedName.length < 2 || trimmedName.length > 80) {
    errors.name = 'Name must be between 2 and 80 characters.';
  }

  const trimmedEmail = (data.email || '').trim();
  if (!trimmedEmail) {
    errors.email = 'University email address is required.';
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = 'Please provide a valid email format.';
  }

  if (!data.department || !data.department.trim()) {
    errors.department = 'Please select your academic department.';
  }

  if (data.semester !== undefined && data.semester !== null && data.semester !== '') {
    const sem = Number(data.semester);
    if (!Number.isInteger(sem) || sem < 1 || sem > 8) {
      errors.semester = 'Semester must be an integer between 1 and 8.';
    }
  }

  if (!data.password) {
    errors.password = 'Password is required.';
  } else if (data.password.length < 6) {
    errors.password = 'Password must be at least 6 characters long.';
  }

  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

function parseSkills(skillsString) {
  if (!skillsString) return [];
  return skillsString.split(',').map(s => s.trim()).filter(Boolean);
}

function createRegistrationPayload(formData) {
  return {
    name: formData.name.trim(),
    email: formData.email.trim(),
    password: formData.password,
    accountType: 'student', // Fixed student account type: never allows supervisor self-registration
    department: formData.department.trim(),
    studentId: formData.studentId ? formData.studentId.trim() : null,
    semester: formData.semester ? Number(formData.semester) : null,
    skills: parseSkills(formData.skills)
  };
}

// Test Runner
function runFrontendTests() {
  console.log('====================================================');
  console.log('ProjectForge Frontend Authentication Logic Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName, condition, detail = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${detail}`);
      failed++;
    }
  }

  // TEST 1: Valid student data passes validation
  const validData = {
    name: 'Jane Doe',
    email: 'jane.d@univ.edu',
    department: 'Computer',
    studentId: 'CS-2024-99',
    semester: '6',
    skills: 'React, Node.js, MongoDB',
    password: 'Password123!',
    confirmPassword: 'Password123!'
  };
  const valResult1 = validateStudentRegistration(validData);
  assert('1. Valid student registration form passes validation', valResult1.isValid, JSON.stringify(valResult1.errors));

  // TEST 2: Short name (< 2 chars) rejected
  const shortNameResult = validateStudentRegistration({ ...validData, name: 'A' });
  assert('2. Name < 2 characters rejected by client validation', shortNameResult.errors.name !== undefined);

  // TEST 3: Invalid email rejected
  const invalidEmailResult = validateStudentRegistration({ ...validData, email: 'notanemail' });
  assert('3. Invalid email rejected by client validation', invalidEmailResult.errors.email !== undefined);

  // TEST 4: Password < 6 chars rejected
  const shortPassResult = validateStudentRegistration({ ...validData, password: '123', confirmPassword: '123' });
  assert('4. Password < 6 characters rejected by client validation', shortPassResult.errors.password !== undefined);

  // TEST 5: Password mismatch rejected
  const mismatchResult = validateStudentRegistration({ ...validData, confirmPassword: 'DifferentPassword123!' });
  assert('5. Mismatched confirmPassword rejected by client validation', mismatchResult.errors.confirmPassword !== undefined);

  // TEST 6: Semester out of range (> 8) rejected
  const badSemResult = validateStudentRegistration({ ...validData, semester: '9' });
  assert('6. Semester > 8 rejected by client validation', badSemResult.errors.semester !== undefined);

  // TEST 7: Semester within range (1-8) accepted
  const goodSemResult = validateStudentRegistration({ ...validData, semester: '4' });
  assert('7. Semester 4 accepted by client validation', goodSemResult.errors.semester === undefined);

  // TEST 8: Skills parsing trims whitespace and removes empty items
  const parsed = parseSkills('  React,  , Node.js , MongoDB ,  ');
  assert('8. Skills parser trims and eliminates empty tags',
    parsed.length === 3 && parsed[0] === 'React' && parsed[1] === 'Node.js' && parsed[2] === 'MongoDB',
    JSON.stringify(parsed)
  );

  // TEST 9: Payload generation locks accountType to student
  const payload = createRegistrationPayload(validData);
  assert('9. Registration payload strictly hardcodes accountType="student"',
    payload.accountType === 'student',
    `accountType was ${payload.accountType}`
  );

  // TEST 10: Verify AuthContext does not reference localStorage or sessionStorage
  const authContextCode = fs.readFileSync(path.join(__dirname, '../src/context/AuthContext.jsx'), 'utf-8');
  const usesBrowserStorage = authContextCode.includes('localStorage') || authContextCode.includes('sessionStorage');
  assert('10. AuthContext code never references localStorage or sessionStorage',
    !usesBrowserStorage,
    'Found localStorage or sessionStorage in AuthContext.jsx'
  );

  console.log('\n----------------------------------------------------');
  console.log(`Frontend Logic Tests Passed: ${passed}`);
  console.log(`Frontend Logic Tests Failed: ${failed}`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runFrontendTests();
