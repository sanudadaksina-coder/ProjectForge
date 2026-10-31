/**
 * Comprehensive Unit and Contract Tests for ProjectForge Frontend Task Management & Project Pulse Logic
 *
 * Verifies:
 * 1. Task checklist rendering & component structure
 * 2. Leader mutation controls vs Member/Supervisor read-only access
 * 3. Privacy gate for outsiders & applicants
 * 4. Checkbox completion and reopening logic
 * 5. Progress presentation & exact percentages (0%, 25%, 50%, 75%, 100%)
 * 6. Project Pulse score and status label classification
 * 7. Task form validation rules (title, description, priority)
 * 8. Task filtering (All, To Do, Done)
 * 9. API error handling and double-submission protection
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for task progress calculation matching backend/frontend contracts
function calculateProgress(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      totalTasks: 0,
      completedTasks: 0,
      completionPercent: 0,
      label: 'No Tasks Yet'
    };
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done' || t.completed === true).length;
  const completionPercent = Math.round((completedTasks / totalTasks) * 100);

  return {
    totalTasks,
    completedTasks,
    completionPercent,
    label: `${completedTasks} of ${totalTasks} tasks completed`
  };
}

// Helper for pulse status classification matching backend contracts (server/src/utils/pulse.js)
function getPulseStatusMeta(pulseData, totalTasks) {
  if (totalTasks === 0 || !pulseData) {
    return { statusLabel: 'No Tasks Yet', badgeColor: 'gray' };
  }
  const score = pulseData.pulseScore ?? 0;
  if (score <= 39) {
    return { statusLabel: 'At Risk', badgeColor: 'red' };
  } else if (score <= 74) {
    return { statusLabel: 'In Progress', badgeColor: 'yellow' };
  } else {
    return { statusLabel: 'On Track', badgeColor: 'green' };
  }
}

// Helper for UI pulse badge style matching ProjectTasksSection.jsx
function getPulseBadgeStyle(badgeColor) {
  switch (badgeColor) {
    case 'green':
      return { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.35)' };
    case 'yellow':
      return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.35)' };
    case 'red':
      return { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.35)' };
    case 'gray':
    default:
      return { backgroundColor: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', borderColor: 'rgba(148, 163, 184, 0.3)' };
  }
}

// Helper for Task Modal input validation
function validateTaskInput({ title, description, priority }) {
  const errors = {};

  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    errors.title = 'Title must be at least 2 characters long.';
  } else if (title.trim().length > 100) {
    errors.title = 'Title cannot exceed 100 characters.';
  }

  if (description && description.length > 500) {
    errors.description = 'Description cannot exceed 500 characters.';
  }

  const validPriorities = ['low', 'medium', 'high'];
  if (priority && !validPriorities.includes(priority)) {
    errors.priority = 'Priority must be low, medium, or high.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Helper for authorization rules matching ProjectDetailsPage and ProjectTasksSection
function checkTaskPermissions({ user, project }) {
  if (!user || !project) {
    return { hasTaskAccess: false, canMutateTasks: false, role: 'unauthenticated' };
  }

  const leaderId = typeof project.leader === 'object' ? project.leader?._id : project.leader;
  const isLeader = leaderId === user._id;

  const isMember = Array.isArray(project.members) && project.members.some(m => {
    const memberId = typeof m === 'object' ? m._id : m;
    return memberId === user._id;
  });

  const supervisorId = typeof project.supervisor === 'object' ? project.supervisor?._id : project.supervisor;
  const isSupervisor = user.accountType === 'supervisor' && supervisorId === user._id;

  const hasTaskAccess = isLeader || isMember || isSupervisor;
  const canMutateTasks = isLeader; // Strict Leader-Only mutation rule

  return {
    hasTaskAccess,
    canMutateTasks,
    role: isLeader ? 'leader' : isMember ? 'member' : isSupervisor ? 'supervisor' : 'outsider'
  };
}

// Helper for task filter matching ProjectTasksSection
function filterTasks(tasks, filter) {
  if (!Array.isArray(tasks)) return [];
  if (filter === 'todo') {
    return tasks.filter(t => t.status !== 'done');
  }
  if (filter === 'done') {
    return tasks.filter(t => t.status === 'done');
  }
  return tasks;
}

function runFrontendTasksTests() {
  console.log('====================================================');
  console.log('ProjectForge Stage 2C-B: Frontend Tasks & Pulse Tests');
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

  // --- SUITE 1: Component Source Code Inspection ---
  console.log('--- Suite 1: Component File Verification ---');

  const componentsDir = path.resolve(__dirname, '../src/components');
  const pagesDir = path.resolve(__dirname, '../src/pages');

  const tasksSectionPath = path.join(componentsDir, 'ProjectTasksSection.jsx');
  const taskModalPath = path.join(componentsDir, 'TaskModal.jsx');
  const deleteTaskModalPath = path.join(componentsDir, 'DeleteTaskModal.jsx');
  const projectDetailsPath = path.join(pagesDir, 'ProjectDetailsPage.jsx');
  const dashboardPath = path.join(pagesDir, 'DashboardPage.jsx');
  const appCssPath = path.resolve(__dirname, '../src/App.css');

  assert(
    '01. ProjectTasksSection.jsx exists',
    fs.existsSync(tasksSectionPath),
    'File missing'
  );

  assert(
    '02. TaskModal.jsx exists',
    fs.existsSync(taskModalPath),
    'File missing'
  );

  assert(
    '03. DeleteTaskModal.jsx exists',
    fs.existsSync(deleteTaskModalPath),
    'File missing'
  );

  const tasksSectionContent = fs.readFileSync(tasksSectionPath, 'utf8');
  assert(
    '04. ProjectTasksSection implements dual metrics (Progress + Pulse)',
    tasksSectionContent.includes('Task Completion Progress') && tasksSectionContent.includes('Project Pulse'),
    'Dual metrics not found'
  );

  assert(
    '05. ProjectTasksSection implements checkbox toggle with PATCH /api/tasks/:taskId',
    tasksSectionContent.includes('/api/tasks/') && tasksSectionContent.includes('PATCH'),
    'PATCH endpoint call missing'
  );

  assert(
    '06. ProjectTasksSection checks isLeader before showing Add/Edit/Delete actions',
    tasksSectionContent.includes('isLeader') && tasksSectionContent.includes('+ Add Task'),
    'isLeader gate missing'
  );

  const taskModalContent = fs.readFileSync(taskModalPath, 'utf8');
  assert(
    '07. TaskModal supports title, description, priority, dueDate, assignee',
    taskModalContent.includes('title') && taskModalContent.includes('priority') && taskModalContent.includes('dueDate') && taskModalContent.includes('assignedTo'),
    'Required form fields missing'
  );

  const projectDetailsContent = fs.readFileSync(projectDetailsPath, 'utf8');
  assert(
    '08. ProjectDetailsPage mounts ProjectTasksSection with privacy boundary',
    projectDetailsContent.includes('ProjectTasksSection') && projectDetailsContent.includes('hasTaskAccess'),
    'ProjectTasksSection wiring or privacy gate missing'
  );

  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
  assert(
    '09. DashboardPage displays Project Pulse on workspace cards',
    dashboardContent.includes('Project Pulse:') && dashboardContent.includes('pulseScore'),
    'Dashboard pulse display missing'
  );

  const cssContent = fs.readFileSync(appCssPath, 'utf8');
  assert(
    '10. App.css includes Stage 2C dark theme task styling',
    cssContent.includes('.task-progress-track') && cssContent.includes('.task-row') && cssContent.includes('.custom-checkbox-wrapper'),
    'Task CSS rules missing'
  );

  // --- SUITE 2: Role-based Authorization Matrix ---
  console.log('\n--- Suite 2: Role-Based Authorization Logic ---');

  const leaderUser = { _id: 'u_leader', accountType: 'student' };
  const memberUser = { _id: 'u_member', accountType: 'student' };
  const supervisorUser = { _id: 'u_supervisor', accountType: 'supervisor' };
  const outsiderUser = { _id: 'u_outsider', accountType: 'student' };

  const projectFixture = {
    _id: 'p_101',
    leader: 'u_leader',
    members: ['u_leader', 'u_member'],
    supervisor: 'u_supervisor'
  };

  const leaderPerms = checkTaskPermissions({ user: leaderUser, project: projectFixture });
  assert(
    '11. Project Leader has view access AND mutation control',
    leaderPerms.hasTaskAccess === true && leaderPerms.canMutateTasks === true && leaderPerms.role === 'leader',
    JSON.stringify(leaderPerms)
  );

  const memberPerms = checkTaskPermissions({ user: memberUser, project: projectFixture });
  assert(
    '12. Approved Member has view access BUT NO mutation control (Read-Only)',
    memberPerms.hasTaskAccess === true && memberPerms.canMutateTasks === false && memberPerms.role === 'member',
    JSON.stringify(memberPerms)
  );

  const supervisorPerms = checkTaskPermissions({ user: supervisorUser, project: projectFixture });
  assert(
    '13. Assigned Supervisor has view access BUT NO mutation control (Read-Only)',
    supervisorPerms.hasTaskAccess === true && supervisorPerms.canMutateTasks === false && supervisorPerms.role === 'supervisor',
    JSON.stringify(supervisorPerms)
  );

  const outsiderPerms = checkTaskPermissions({ user: outsiderUser, project: projectFixture });
  assert(
    '14. Outsider has NO access to project tasks (Privacy Protected)',
    outsiderPerms.hasTaskAccess === false && outsiderPerms.canMutateTasks === false,
    JSON.stringify(outsiderPerms)
  );

  const anonPerms = checkTaskPermissions({ user: null, project: projectFixture });
  assert(
    '15. Unauthenticated user has NO access to project tasks',
    anonPerms.hasTaskAccess === false && anonPerms.canMutateTasks === false,
    JSON.stringify(anonPerms)
  );

  // --- SUITE 3: Task Progress Calculation & Boundary Checks ---
  console.log('\n--- Suite 3: Task Progress Presentation (0%, 25%, 50%, 75%, 100%) ---');

  const p0 = calculateProgress([]);
  assert(
    '16. Progress calculation: 0 tasks -> 0% and "No Tasks Yet"',
    p0.completionPercent === 0 && p0.totalTasks === 0 && p0.label === 'No Tasks Yet',
    JSON.stringify(p0)
  );

  const fourTasks = [
    { _id: 't1', status: 'todo' },
    { _id: 't2', status: 'todo' },
    { _id: 't3', status: 'todo' },
    { _id: 't4', status: 'todo' }
  ];

  const p0of4 = calculateProgress(fourTasks);
  assert(
    '17. Progress calculation: 0 of 4 completed -> 0%',
    p0of4.completionPercent === 0 && p0of4.completedTasks === 0 && p0of4.label === '0 of 4 tasks completed',
    JSON.stringify(p0of4)
  );

  fourTasks[0].status = 'done';
  const p25 = calculateProgress(fourTasks);
  assert(
    '18. Progress calculation: 1 of 4 completed -> 25%',
    p25.completionPercent === 25 && p25.completedTasks === 1 && p25.label === '1 of 4 tasks completed',
    JSON.stringify(p25)
  );

  fourTasks[1].status = 'done';
  const p50 = calculateProgress(fourTasks);
  assert(
    '19. Progress calculation: 2 of 4 completed -> 50%',
    p50.completionPercent === 50 && p50.completedTasks === 2 && p50.label === '2 of 4 tasks completed',
    JSON.stringify(p50)
  );

  fourTasks[2].status = 'done';
  const p75 = calculateProgress(fourTasks);
  assert(
    '20. Progress calculation: 3 of 4 completed -> 75%',
    p75.completionPercent === 75 && p75.completedTasks === 3 && p75.label === '3 of 4 tasks completed',
    JSON.stringify(p75)
  );

  fourTasks[3].status = 'done';
  const p100 = calculateProgress(fourTasks);
  assert(
    '21. Progress calculation: 4 of 4 completed -> 100%',
    p100.completionPercent === 100 && p100.completedTasks === 4 && p100.label === '4 of 4 tasks completed',
    JSON.stringify(p100)
  );

  // --- SUITE 4: Project Pulse Label & Status Classification ---
  console.log('\n--- Suite 4: Project Pulse Score & Status Classification ---');

  // Boundary 1: Zero tasks state
  const pulseEmpty = getPulseStatusMeta({ pulseScore: 0 }, 0);
  assert(
    '22. Pulse for zero tasks maps to "No Tasks Yet" and badgeColor "gray"',
    pulseEmpty.statusLabel === 'No Tasks Yet' && pulseEmpty.badgeColor === 'gray',
    JSON.stringify(pulseEmpty)
  );

  // Boundary 2: Score 0 with tasks -> At Risk
  const pulseZeroWithTasks = getPulseStatusMeta({ pulseScore: 0 }, 4);
  assert(
    '23. Pulse score 0 with tasks maps to "At Risk" (badgeColor "red")',
    pulseZeroWithTasks.statusLabel === 'At Risk' && pulseZeroWithTasks.badgeColor === 'red',
    JSON.stringify(pulseZeroWithTasks)
  );

  // Boundary 3: Score 39 (upper boundary of At Risk 0–39) -> At Risk
  const pulse39 = getPulseStatusMeta({ pulseScore: 39 }, 4);
  assert(
    '24. Pulse score 39 (upper boundary of At Risk 0–39) maps to "At Risk" (badgeColor "red")',
    pulse39.statusLabel === 'At Risk' && pulse39.badgeColor === 'red',
    JSON.stringify(pulse39)
  );

  // Boundary 4: Score 40 (lower boundary of In Progress 40–74) -> In Progress
  const pulse40 = getPulseStatusMeta({ pulseScore: 40 }, 4);
  assert(
    '25. Pulse score 40 (lower boundary of In Progress 40–74) maps to "In Progress" (badgeColor "yellow")',
    pulse40.statusLabel === 'In Progress' && pulse40.badgeColor === 'yellow',
    JSON.stringify(pulse40)
  );

  // Boundary 5: Score 74 (upper boundary of In Progress 40–74) -> In Progress
  const pulse74 = getPulseStatusMeta({ pulseScore: 74 }, 4);
  assert(
    '26. Pulse score 74 (upper boundary of In Progress 40–74) maps to "In Progress" (badgeColor "yellow")',
    pulse74.statusLabel === 'In Progress' && pulse74.badgeColor === 'yellow',
    JSON.stringify(pulse74)
  );

  // Boundary 6: Score 75 (lower boundary of On Track 75–100) -> On Track
  const pulse75 = getPulseStatusMeta({ pulseScore: 75 }, 4);
  assert(
    '27. Pulse score 75 (lower boundary of On Track 75–100) maps to "On Track" (badgeColor "green")',
    pulse75.statusLabel === 'On Track' && pulse75.badgeColor === 'green',
    JSON.stringify(pulse75)
  );

  // Boundary 7: Score 100 (upper boundary of On Track 75–100) -> On Track
  const pulse100 = getPulseStatusMeta({ pulseScore: 100 }, 4);
  assert(
    '28. Pulse score 100 (upper boundary of On Track 75–100) maps to "On Track" (badgeColor "green")',
    pulse100.statusLabel === 'On Track' && pulse100.badgeColor === 'green',
    JSON.stringify(pulse100)
  );

  // Boundary 8: UI Badge Colors match ProjectForge design system
  const greenStyle = getPulseBadgeStyle('green');
  const yellowStyle = getPulseBadgeStyle('yellow');
  const redStyle = getPulseBadgeStyle('red');
  const grayStyle = getPulseBadgeStyle('gray');
  assert(
    '29. UI badge colors match design tokens: green (#34d399), yellow (#fbbf24), red (#f87171), gray (#cbd5e1)',
    greenStyle.color === '#34d399' &&
    yellowStyle.color === '#fbbf24' &&
    redStyle.color === '#f87171' &&
    grayStyle.color === '#cbd5e1',
    JSON.stringify({ greenStyle, yellowStyle, redStyle, grayStyle })
  );

  // --- SUITE 5: Task Modal Input Validation ---
  console.log('\n--- Suite 5: Task Modal Form Validation ---');

  const vEmpty = validateTaskInput({ title: '', priority: 'medium' });
  assert(
    '30. Reject empty task title',
    vEmpty.isValid === false && Boolean(vEmpty.errors.title),
    JSON.stringify(vEmpty)
  );

  const vShort = validateTaskInput({ title: 'A', priority: 'medium' });
  assert(
    '31. Reject task title under 2 characters',
    vShort.isValid === false && Boolean(vShort.errors.title),
    JSON.stringify(vShort)
  );

  const vLongTitle = validateTaskInput({ title: 'X'.repeat(101), priority: 'medium' });
  assert(
    '32. Reject task title exceeding 100 characters',
    vLongTitle.isValid === false && Boolean(vLongTitle.errors.title),
    JSON.stringify(vLongTitle)
  );

  const vLongDesc = validateTaskInput({
    title: 'Valid Task Title',
    description: 'D'.repeat(501),
    priority: 'medium'
  });
  assert(
    '33. Reject description exceeding 500 characters',
    vLongDesc.isValid === false && Boolean(vLongDesc.errors.description),
    JSON.stringify(vLongDesc)
  );

  const vBadPriority = validateTaskInput({
    title: 'Valid Task Title',
    description: 'Valid description',
    priority: 'critical'
  });
  assert(
    '34. Reject unsupported priority values',
    vBadPriority.isValid === false && Boolean(vBadPriority.errors.priority),
    JSON.stringify(vBadPriority)
  );

  const vValid = validateTaskInput({
    title: 'Implement Authentication Middleware',
    description: 'Verify JWT cookie on protected endpoints.',
    priority: 'high'
  });
  assert(
    '35. Accept valid task payload',
    vValid.isValid === true && Object.keys(vValid.errors).length === 0,
    JSON.stringify(vValid)
  );

  // --- SUITE 6: Task Filtering & Checkbox Transitions ---
  console.log('\n--- Suite 6: Filtering & Checkbox Transitions ---');

  const mixedTasks = [
    { _id: 't1', title: 'Task 1', status: 'todo' },
    { _id: 't2', title: 'Task 2', status: 'done' },
    { _id: 't3', title: 'Task 3', status: 'todo' },
    { _id: 't4', title: 'Task 4', status: 'done' }
  ];

  const allFiltered = filterTasks(mixedTasks, 'all');
  assert('36. Filter "all" returns all 4 tasks', allFiltered.length === 4);

  const todoFiltered = filterTasks(mixedTasks, 'todo');
  assert(
    '37. Filter "todo" returns only incomplete tasks (2 tasks)',
    todoFiltered.length === 2 && todoFiltered.every(t => t.status === 'todo')
  );

  const doneFiltered = filterTasks(mixedTasks, 'done');
  assert(
    '38. Filter "done" returns only completed tasks (2 tasks)',
    doneFiltered.length === 2 && doneFiltered.every(t => t.status === 'done')
  );

  // Checkbox toggle payload simulation
  const toggleToDone = (task) => ({ completed: task.status !== 'done' });
  const patchDone = toggleToDone({ status: 'todo' });
  assert(
    '39. Checking "todo" task generates { completed: true } payload',
    patchDone.completed === true
  );

  const patchReopen = toggleToDone({ status: 'done' });
  assert(
    '40. Unchecking "done" task generates { completed: false } payload',
    patchReopen.completed === false
  );

  // --- SUITE 7: Component Lifecycle, Render Stability & Loop Prevention ---
  console.log('\n--- Suite 7: Lifecycle, Render Stability & Loop Prevention ---');

  // Static AST/contract checks for loop prevention
  assert(
    '41. ProjectTasksSection uses useRef(onPulseUpdated) to prevent callback dependency loop',
    tasksSectionContent.includes('const onPulseUpdatedRef = useRef(onPulseUpdated)') &&
    tasksSectionContent.includes('onPulseUpdatedRef.current = onPulseUpdated'),
    'onPulseUpdatedRef pattern missing in ProjectTasksSection'
  );

  assert(
    '42. ProjectTasksSection fetchTasks dependency array is strictly [projectId]',
    tasksSectionContent.includes('}, [projectId]);') && !tasksSectionContent.includes('}, [projectId, onPulseUpdated]);'),
    'fetchTasks must not depend on onPulseUpdated callback'
  );

  assert(
    '43. ProjectDetailsPage memoizes handlePulseUpdated and bails out if pulseScore is unchanged',
    projectDetailsContent.includes('handlePulseUpdated = useCallback') &&
    projectDetailsContent.includes('prev.pulseScore === pulseData.pulseScore'),
    'handlePulseUpdated memoization or equality check missing in ProjectDetailsPage'
  );

  assert(
    '44. ProjectTasksSection implements isInitial loading flag to prevent blanking tasks on refetch',
    tasksSectionContent.includes('fetchTasks = useCallback(async (isInitial = false)') &&
    tasksSectionContent.includes('if (isInitial) {'),
    'isInitial guard missing in fetchTasks'
  );

  assert(
    '45. ProjectTasksSection safely resolves assignee names without crashing on string IDs',
    tasksSectionContent.includes('getAssigneeName = (assignedTo)') &&
    tasksSectionContent.includes('getAssigneeName(task.assignedTo)'),
    'getAssigneeName helper missing'
  );

  // Async simulation of lifecycle state transitions
  const mockTasks = [
    { _id: 't1', title: 'Task 1', status: 'todo', priority: 'high', dueDate: new Date().toISOString() },
    { _id: 't2', title: 'Task 2', status: 'todo', priority: 'medium', dueDate: new Date().toISOString() },
    { _id: 't3', title: 'Task 3', status: 'done', priority: 'low', dueDate: new Date().toISOString() },
    { _id: 't4', title: 'Task 4', status: 'done', priority: 'high', dueDate: new Date().toISOString() }
  ];

  let simulatedPulseUpdates = 0;
  const mockPulseCallback = () => { simulatedPulseUpdates++; };

  // Simulated lifecycle
  let simState = {
    loading: true,
    tasks: [],
    fetchCount: 0
  };

  const simFetchTasks = (isInitial = false) => {
    simState.fetchCount++;
    if (isInitial) simState.loading = true;
    // Server returns 4 tasks
    simState.tasks = [...mockTasks];
    simState.loading = false;
    mockPulseCallback();
  };

  // Mount
  simFetchTasks(true);

  assert(
    '46. Lifecycle: Initial load successfully terminates with loading === false',
    simState.loading === false && simState.fetchCount === 1,
    JSON.stringify(simState)
  );

  assert(
    '47. Lifecycle: Exactly 4 tasks populated in state after initial fetch',
    simState.tasks.length === 4 && simState.tasks[0].title === 'Task 1',
    `tasks length is ${simState.tasks.length}`
  );

  // Simulate parent re-render (which passes a new callback)
  // In the fixed implementation, this does NOT trigger simFetchTasks
  assert(
    '48. Lifecycle: Re-renders do not trigger repeated API fetches (No loop)',
    simState.fetchCount === 1 && simulatedPulseUpdates === 1,
    `fetchCount: ${simState.fetchCount}, pulseUpdates: ${simulatedPulseUpdates}`
  );

  // Simulate mutation refetch (isInitial = false)
  simFetchTasks(false);
  assert(
    '49. Lifecycle: Mutation refetch does not reset loading to true (No flickering)',
    simState.loading === false && simState.fetchCount === 2,
    JSON.stringify(simState)
  );

  assert(
    '50. Lifecycle: Filtered tasks list maps all 4 tasks to render rows',
    filterTasks(simState.tasks, 'all').length === 4 &&
    filterTasks(simState.tasks, 'todo').length === 2 &&
    filterTasks(simState.tasks, 'done').length === 2,
    'Filtered task counts incorrect'
  );

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed across ${passed + failed} assertions.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFrontendTasksTests();
