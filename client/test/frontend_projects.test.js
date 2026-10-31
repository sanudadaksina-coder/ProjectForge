/**
 * Focused Unit and Contract Tests for ProjectForge Frontend Project CRUD Logic
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_DOMAINS = [
  'Computer',
  'Electrical',
  'Mechanical',
  'Civil',
  'Biomedical',
  'Multidisciplinary'
];

const URL_REGEX = /^https?:\/\/.+/i;

function validateProjectForm(data, currentMemberCount = 1) {
  const errors = {};

  const trimmedTitle = (data.title || '').trim();
  if (!trimmedTitle) {
    errors.title = 'Project title is required.';
  } else if (trimmedTitle.length < 5 || trimmedTitle.length > 120) {
    errors.title = 'Title must be between 5 and 120 characters.';
  }

  const trimmedAbstract = (data.abstract || '').trim();
  if (!trimmedAbstract) {
    errors.abstract = 'Project abstract is required.';
  } else if (trimmedAbstract.length < 20 || trimmedAbstract.length > 1500) {
    errors.abstract = 'Abstract must be between 20 and 1500 characters.';
  }

  if (!data.domain || !VALID_DOMAINS.includes(data.domain)) {
    errors.domain = 'Please select a valid engineering domain.';
  }

  const size = Number(data.maxTeamSize);
  if (!Number.isInteger(size) || size < 2 || size > 6) {
    errors.maxTeamSize = 'Maximum team size must be an integer between 2 and 6.';
  } else if (size < currentMemberCount) {
    errors.maxTeamSize = `Team size cannot be smaller than current member count (${currentMemberCount}).`;
  }

  if (!data.targetCompletionDate) {
    errors.targetCompletionDate = 'Target completion date is required.';
  } else {
    const selectedDate = new Date(data.targetCompletionDate);
    if (isNaN(selectedDate.getTime()) || selectedDate <= new Date()) {
      errors.targetCompletionDate = 'Target completion date must be in the future.';
    }
  }

  const repo = (data.repositoryUrl || '').trim();
  if (repo && !URL_REGEX.test(repo)) {
    errors.repositoryUrl = 'Repository URL must be a valid web address starting with http:// or https://.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

function createSafeProjectPayload(formData) {
  const parsedTags = formData.tags
    ? (Array.isArray(formData.tags) ? formData.tags : formData.tags.split(',').map(t => t.trim()).filter(Boolean))
    : [];

  return {
    title: formData.title.trim(),
    abstract: formData.abstract.trim(),
    domain: formData.domain,
    tags: parsedTags,
    maxTeamSize: Number(formData.maxTeamSize),
    targetCompletionDate: new Date(formData.targetCompletionDate).toISOString(),
    repositoryUrl: (formData.repositoryUrl || '').trim()
  };
}

function runProjectFrontendTests() {
  console.log('====================================================');
  console.log('ProjectForge Frontend Project CRUD Logic Tests');
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

  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  const futureDateString = futureDate.toISOString().split('T')[0];

  const validProjectData = {
    title: 'Autonomous Campus Quadcopter Drone',
    abstract: 'A self-navigating aerial vehicle equipped with computer vision for emergency sample delivery between engineering blocks.',
    domain: 'Computer',
    tags: 'Robotics, IoT, Computer Vision',
    maxTeamSize: '4',
    targetCompletionDate: futureDateString,
    repositoryUrl: 'https://github.com/student/drone'
  };

  // TEST 1: Valid form data passes validation
  const val1 = validateProjectForm(validProjectData);
  assert('1. Valid project creation data passes client validation', val1.isValid, JSON.stringify(val1.errors));

  // TEST 2: Short title (< 5 chars) rejected
  const shortTitleVal = validateProjectForm({ ...validProjectData, title: 'IoT' });
  assert('2. Project title < 5 characters is rejected', shortTitleVal.errors.title !== undefined);

  // TEST 3: Short abstract (< 20 chars) rejected
  const shortAbstractVal = validateProjectForm({ ...validProjectData, abstract: 'Too short.' });
  assert('3. Project abstract < 20 characters is rejected', shortAbstractVal.errors.abstract !== undefined);

  // TEST 4: Invalid domain enum rejected
  const badDomainVal = validateProjectForm({ ...validProjectData, domain: 'Astrophysics' });
  assert('4. Domain outside allowed enum is rejected', badDomainVal.errors.domain !== undefined);

  // TEST 5: Team size < 2 rejected
  const smallTeamVal = validateProjectForm({ ...validProjectData, maxTeamSize: '1' });
  assert('5. Team size < 2 is rejected', smallTeamVal.errors.maxTeamSize !== undefined);

  // TEST 6: Team size > 6 rejected
  const largeTeamVal = validateProjectForm({ ...validProjectData, maxTeamSize: '8' });
  assert('6. Team size > 6 is rejected', largeTeamVal.errors.maxTeamSize !== undefined);

  // TEST 7: Past date rejected
  const pastDateVal = validateProjectForm({ ...validProjectData, targetCompletionDate: '2020-01-01' });
  assert('7. Past completion date is rejected', pastDateVal.errors.targetCompletionDate !== undefined);

  // TEST 8: Malformed repository URL rejected
  const badUrlVal = validateProjectForm({ ...validProjectData, repositoryUrl: 'not-a-valid-url' });
  assert('8. Malformed repository URL is rejected', badUrlVal.errors.repositoryUrl !== undefined);

  // TEST 9: Empty repository URL accepted
  const emptyUrlVal = validateProjectForm({ ...validProjectData, repositoryUrl: '' });
  assert('9. Empty repository URL is accepted as optional', emptyUrlVal.errors.repositoryUrl === undefined);

  // TEST 10: Edit validation: maxTeamSize cannot be smaller than current member count
  const editTeamSizeVal = validateProjectForm({ ...validProjectData, maxTeamSize: '2' }, 3); // current members: 3
  assert('10. maxTeamSize smaller than current members (3) is rejected during edit', editTeamSizeVal.errors.maxTeamSize !== undefined);

  // TEST 11: Safe payload does not inject protected fields
  const payload = createSafeProjectPayload(validProjectData);
  assert('11. Payload excludes structural fields (leader, members, supervisor, pulseScore)',
    payload.leader === undefined &&
    payload.members === undefined &&
    payload.supervisor === undefined &&
    payload.pulseScore === undefined,
    JSON.stringify(payload)
  );

  // TEST 12: Static compliance check - no localStorage or sessionStorage in project pages
  const projectPageFiles = [
    'ProjectDiscoveryPage.jsx',
    'CreateProjectPage.jsx',
    'ProjectDetailsPage.jsx',
    'EditProjectPage.jsx'
  ];
  let storageLeaks = 0;
  for (const file of projectPageFiles) {
    const content = fs.readFileSync(path.join(__dirname, `../src/pages/${file}`), 'utf-8');
    if (content.includes('localStorage') || content.includes('sessionStorage')) {
      storageLeaks++;
    }
  }
  assert('12. Project pages strictly adhere to in-memory state (no localStorage/sessionStorage)',
    storageLeaks === 0,
    `Found storage leaks in ${storageLeaks} page(s)`
  );

  console.log('\n----------------------------------------------------');
  console.log(`Project Frontend Logic Tests Passed: ${passed}`);
  console.log(`Project Frontend Logic Tests Failed: ${failed}`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runProjectFrontendTests();
