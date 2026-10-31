# ProjectForge: Engineering Project Collaboration Platform
## Technical Project Specification & Implementation Guide

**Document Version:** 2.0.0  
**Project Type:** Undergraduate University Web Application Development Mini Project  
**Technology Stack:** MERN (MongoDB, Express.js, React.js, Node.js)  
**Target File:** `docs/PROJECT_SPEC.md`

---

## 1. Project Overview & Problem Statement

### 1.1 Project Overview
**ProjectForge** is an engineering project collaboration platform designed for undergraduate students and faculty supervisors. It serves as a central workspace for managing academic group projects (such as semester design projects, mini projects, and capstone prototypes).

The platform enables students to propose project ideas, assemble peer teams, track tasks with deadlines, measure progress through an automated **Project Pulse** metric, share external project resources, and communicate with assigned faculty supervisors.

### 1.2 Problem Statement
Undergraduate engineering group projects commonly face operational difficulties:
1. **Scattered Coordination:** Students coordinate across informal messaging groups, unsorted cloud folders, and personal chats, resulting in lost links and uncoordinated work.
2. **Limited Supervisor Visibility:** Supervisors typically manage multiple project groups at once and lack an easy way to check ongoing task progress before final evaluation dates.
3. **Difficult Supervisor Discovery:** Students often do not know which faculty members specialize in specific technical domains (e.g., Embedded Systems, Machine Learning, Power Systems), leading to slow or arbitrary supervisor selection.
4. **Unstructured Review Feedback:** Document feedback and revision requests are often lost in email threads without clear records of what was requested and what was updated.
5. **Subjective Progress Tracking:** Project status is usually reported through informal claims rather than objective data based on actual completed tasks.

ProjectForge solves these issues by providing a clear, web-based workspace with role-based access, transparent task progress, and a structured feedback flow.

---

## 2. Project Objectives & Intended Users

### 2.1 Project Objectives
* **Provide a Single Source of Truth:** Keep project details, team rosters, task deadlines, external document links, and supervisor feedback in one accessible web application.
* **Support Student Learning:** Keep the system architecture approachable and explainable for an undergraduate developer, emphasizing clean MERN fundamentals over unnecessary third-party libraries.
* **Demonstrate Core Software Engineering Skills:** Show mastery of full CRUD operations, database schema design, backend validation, route protection, and responsive user interface design.
* **Implement Objective Progress Tracking:** Calculate project health using real task data rather than arbitrary manual status selections.

### 2.2 Intended Users
* **Student User:** An undergraduate student who registers with university details, creates projects, applies to join peer teams, manages assigned tasks, and submits project deliverables.
* **Faculty Supervisor:** An academic instructor or professor whose account is set up through a controlled process. Supervisors publish their research interests, accept or decline project supervision requests, and provide structured feedback on student deliverables.

---

## 3. User Account Types & Controlled Supervisor Setup

ProjectForge maintains two distinct account types at the system level.

### 3.1 Student Account (`student`)
* **Registration:** Open, public self-registration via the application signup form.
* **Required Profile Fields:**
  * Full Name
  * Email Address (unique, university format validated)
  * Password (stored exclusively as a salted bcrypt hash)
  * Student / Roll Number
  * Department (e.g., Computer, Electrical, Mechanical, Civil)
  * Semester / Year of Study
  * Skills / Technical Interests (e.g., React, Python, Circuit Design)
* **Default Role:** `student`

### 3.2 Supervisor Account (`supervisor`)
* **Registration Constraint:** **No public self-registration.** To prevent students or unauthorized visitors from granting themselves supervisor privileges, supervisor accounts cannot be created through the public signup form.
* **Setup Mechanism for Mini Project:**
  1. **Database Seed Script (Primary method for demonstration):** Run `npm run seed:supervisors` to insert verified faculty accounts with designated research interests and credentials into MongoDB.
  2. **Controlled Setup Endpoint:** A protected initialization route requiring a pre-configured server secret key defined in the backend `.env` file.
* **Profile Fields:**
  * Full Name
  * Institutional Email Address (unique)
  * Password (salted bcrypt hash)
  * Department
  * Academic Designation (e.g., Assistant Professor, Associate Professor, Professor)
  * Research Interests (e.g., Robotics, Cloud Computing, VLSI, Renewable Energy)
  * Office Location / Consultation Hours
  * Maximum Project Capacity (default: 5 projects)

---

## 4. Project-Specific Roles & Permission Model

While `accountType` determines system-level permissions, individual projects define contextual roles for students.

```
+-------------------------------------------------------------------------+
|                           System Account Types                          |
+-------------------------------------------------------------------------+
           |                                                 |
   [ Student Account ]                             [ Supervisor Account ]
           |                                                 |
           v                                                 v
+------------------------+                        +-----------------------+
| Project-Specific Roles |                        | Project Relationship  |
+------------------------+                        +-----------------------+
| 1. Project Leader      |                        | Assigned Supervisor   |
|    - Created the project                        | - Accepted request    |
|    - Full project CRUD                          | - Review deliverables |
|    - Manage team membership                     | - Post advice/feedback|
|    - Request supervisor                         +-----------------------+
|                        |
| 2. Project Member      |
|    - Approved joiner   |
|    - Create/update task|
|    - Post comments     |
|    - Add doc links     |
+------------------------+
```

### 4.1 Project Leader
* **Assignment:** The student who creates the project is automatically assigned as the Project Leader.
* **Exclusive Permissions:**
  * Edit project metadata via `PATCH /api/projects/:id` (title, abstract, domain, tags, max team size, deadline, repository URL).
  * Delete the project (with confirmation and child-before-parent resource cleanup).
  * Approve or reject incoming student membership requests.
  * Remove team members from the roster.
  * Send supervision requests to faculty members.
  * Submit milestone deliverable links for review.
* **Rule:** A project has exactly one Project Leader. The leader cannot be removed from the team unless the project is deleted.

### 4.2 Project Member
* **Assignment:** A student whose join request has been approved by the Project Leader.
* **Permissions:**
  * View private project workspace details (including full member contact details, tasks, and document resources).
  * Create tasks (automatically stamped with `createdBy`), edit tasks, and update task status.
  * Delete tasks that they personally created (or Project Leader can delete any task).
  * Add external document links, edit document links they have contributed (`PATCH /api/documents/:documentId`), and delete document links they added.
  * Post comments in the project discussion feed.
* **Restrictions:** Project members cannot edit project information, delete the project, approve join requests, or change the assigned supervisor.
* **Public Visitor Distinction:** Unauthenticated visitors and non-member students may only view public project metadata (title, abstract, domain, tags, recruitment status) with sanitized member rosters (names, departments, skills). Private contact details (emails, student IDs) and internal workspace data are strictly hidden.

### 4.3 Assigned Supervisor
* **Assignment:** A supervisor who has formally accepted a supervision request from the Project Leader.
* **Permissions:**
  * View full private workspace details of the supervised project.
  * Review milestone deliverables and submit feedback (Approve or Request Revisions).
  * Post pinned discussion notices and comments in the project feed.

---

## 5. Staged Implementation Plan

To ensure the project is achievable, reliable, and straightforward to explain during evaluation, development is divided into three sequential stages. Non-essential features are kept out of the initial build.

```
===========================================================================
Stage 1: Essential Foundation (Week 1–2)
---------------------------------------------------------------------------
• Student signup & login (JWT + bcrypt)
• Controlled supervisor account seeding
• Project CRUD (Create, Read, Update, Delete) with MongoDB persistence
• Project search, filtering, and sorting
• Backend route protection (Leader-only update/delete)
• Responsive, clean layout and form validation
===========================================================================
                                   |
                                   v
===========================================================================
Stage 2: Core Collaboration (Week 2–3)
---------------------------------------------------------------------------
• Team join requests & leader approval workflow
• Team roster management & automatic recruitment closure
• Project tasks with due dates, priorities, and status transitions
• Objective "Project Pulse" calculation from real task completion data
===========================================================================
                                   |
                                   v
===========================================================================
Stage 3: Additional Collaboration (Week 3–4)
---------------------------------------------------------------------------
• Supervisor directory with research domain search
• Supervision request & acceptance workflow
• Validated external document resource links (Google Drive, GitHub, etc.)
• Project discussion comments
• Deliverable submission links & supervisor review feedback
===========================================================================
```

### 5.1 Stage 1 — Essential Foundation
* **Goal:** A rock-solid core application where users authenticate, create projects, browse projects, and manage project details with reliable database persistence.
* **Deliverables:**
  1. Student registration, login, token verification, and logout.
  2. Supervisor accounts created via a database seed script.
  3. Complete Project CRUD with MongoDB persistence.
  4. Project listing page with search by keyword, domain filter, and sort options.
  5. Backend authorization ensuring only Project Leaders can update or delete projects.
  6. Centralized API response format and error handling.

### 5.2 Stage 2 — Core Collaboration
* **Goal:** Enable students to form teams and track project work through tasks and an automated health metric.
* **Deliverables:**
  1. Join request workflow: students request to join open projects, leaders approve or reject.
  2. Automatic project recruitment status updates when maximum capacity is reached.
  3. Task management: create tasks, assign members, set due dates, and update statuses (`todo`, `in_progress`, `done`).
  4. Project Pulse calculation: an objective, deterministic progress score calculated from task completion and overdue task data.

### 5.3 Stage 3 — Additional Collaboration
* **Goal:** Complete the academic workflow by connecting faculty supervisors and providing project communication.
* **Deliverables:**
  1. Supervisor Directory: searchable list of faculty members by research interests and department.
  2. Formal supervision request workflow (Leader requests $\rightarrow$ Supervisor accepts/declines).
  3. External document links: register validated links to Google Docs, GitHub, Overleaf, or Figma.
  4. Project discussion feed: chronological comment feed for team members and supervisors.
  5. Milestone submissions: leader submits deliverable URLs, supervisor reviews and provides approval or revision requests.

### 5.4 Explicitly Excluded from Initial Scope (Optional Future Work)
To keep the code clean and manageable for a beginner student, the following features are intentionally excluded:
* Real-time WebSockets / live chat (standard HTTP requests are used instead).
* Binary file upload storage (Multer / AWS S3) — replaced with validated external URLs.
* Real-time audio/video calls.
* Complex notification engines (email dispatchers, push notifications).
* Version-diff file comparisons or audit logs.
* University Single Sign-On (SSO / LDAP / SAML).

---

## 6. Consistent Data Models & Status Dictionary

To ensure consistency across the entire application, all models use a standardized dictionary of lowercase status strings.

### 6.1 Status Dictionary

| Entity | Field Name | Allowed Values | Description |
| :--- | :--- | :--- | :--- |
| **Project** | `status` | `'proposed'`, `'in_progress'`, `'completed'` | Overall lifecycle state of the project. |
| **Project** | `recruitmentStatus` | `'open'`, `'closed'` | Indicates if team is accepting new student members. |
| **Membership Request** | `status` | `'pending'`, `'approved'`, `'rejected'`, `'cancelled'` | State of a student's application to join a project. |
| **Supervision Request** | `status` | `'pending'`, `'accepted'`, `'declined'` | State of a leader's request for faculty supervision. |
| **Task** | `status` | `'todo'`, `'in_progress'`, `'done'` | Current progress state of an individual task. |
| **Task** | `priority` | `'low'`, `'medium'`, `'high'` | Relative urgency of the task. |
| **Submission** | `status` | `'submitted'`, `'approved'`, `'revisions_requested'` | Supervisor review status for a milestone deliverable. |
| **Document Link** | `category` | `'specification'`, `'code_repository'`, `'design_diagram'`, `'report'`, `'presentation'`, `'other'` | Type of external resource linked. |

---

### 6.2 Mongoose Schema Definitions

#### 1. User Schema (`User.js`)
```javascript
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  accountType: { type: String, enum: ['student', 'supervisor'], required: true },
  department: { type: String, required: true, trim: true },
  // Student-specific fields
  studentId: { type: String, trim: true },
  semester: { type: Number },
  skills: [{ type: String, trim: true }],
  // Supervisor-specific fields
  designation: { type: String, trim: true },
  researchInterests: [{ type: String, trim: true }],
  officeLocation: { type: String, trim: true },
  maxCapacity: { type: Number, default: 5 },
  createdAt: { type: Date, default: Date.now }
});
```

#### 2. Project Schema (`Project.js`)
```javascript
const projectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
  abstract: { type: String, required: true, trim: true, minlength: 20, maxlength: 1500 },
  domain: { 
    type: String, 
    required: true, 
    enum: ['Computer', 'Electrical', 'Mechanical', 'Civil', 'Biomedical', 'Multidisciplinary'] 
  },
  tags: [{ type: String, trim: true }],
  leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  maxTeamSize: { type: Number, required: true, min: 2, max: 6, default: 4 },
  targetCompletionDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['proposed', 'in_progress', 'completed'], 
    default: 'proposed' 
  },
  recruitmentStatus: { 
    type: String, 
    enum: ['open', 'closed'], 
    default: 'open' 
  },
  pulseScore: { type: Number, default: 0, min: 0, max: 100 },
  repositoryUrl: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
```

#### 3. Membership Request Schema (`MembershipRequest.js`)
```javascript
const membershipRequestSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  statement: { type: String, required: true, trim: true, maxlength: 300 },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'cancelled'], 
    default: 'pending' 
  },
  createdAt: { type: Date, default: Date.now }
});
```

#### 4. Task Schema (`Task.js`)
```javascript
const taskSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dueDate: { type: Date, required: true },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium' 
  },
  status: { 
    type: String, 
    enum: ['todo', 'in_progress', 'done'], 
    default: 'todo' 
  },
  completedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});
```

#### 5. Supervision Request Schema (`SupervisionRequest.js`)
```javascript
const supervisionRequestSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proposalMessage: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'declined'], 
    default: 'pending' 
  },
  feedback: { type: String, trim: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null }
});
```

#### 6. Document Link Schema (`DocumentLink.js`)
```javascript
const documentLinkSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  url: { type: String, required: true, trim: true },
  category: { 
    type: String, 
    enum: ['specification', 'code_repository', 'design_diagram', 'report', 'presentation', 'other'], 
    default: 'other' 
  },
  description: { type: String, trim: true, maxlength: 300 },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
```

#### 7. Discussion Comment Schema (`DiscussionComment.js`)
```javascript
const discussionCommentSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
```

#### 8. Submission Schema (`Submission.js`)
```javascript
const submissionSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  deliverableUrl: { type: String, required: true, trim: true },
  notes: { type: String, trim: true, maxlength: 800 },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['submitted', 'approved', 'revisions_requested'], 
    default: 'submitted' 
  },
  supervisorFeedback: { type: String, trim: true, maxlength: 1500 },
  reviewedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});
```

---

## 7. Standardized API Architecture & Response Envelope

All API endpoints follow a unified naming convention and return consistent JSON structures so that frontend code remains simple and predictable.

### 7.1 Unified JSON Response Envelope

#### Successful Response
```json
{
  "success": true,
  "message": "Project retrieved successfully",
  "data": { ... },
  "errors": null
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "errors": [
    { "field": "title", "message": "Title must be between 5 and 120 characters" }
  ]
}
```

### 7.2 Standard HTTP Status Codes
* `200 OK`: Request succeeded.
* `201 Created`: Resource successfully created.
* `400 Bad Request`: Malformed syntax, invalid ObjectId parameter format, or business rule violation (e.g., team already full).
* `401 Unauthorized`: Authentication token cookie missing, expired, or invalid.
* `403 Forbidden`: Authenticated user lacks permission for the resource (e.g., non-leader updating project, non-creator/non-leader deleting task).
* `404 Not Found`: Target resource does not exist in the database.
* `409 Conflict`: Unique constraint violation or conflicting duplicate state (e.g., duplicate email address, duplicate active join request, duplicate pending supervision proposal).
* `422 Unprocessable Entity`: Input failed schema validation checks or invalid URL format.
* `500 Internal Server Error`: Unhandled server exception.

---

## 8. Stage 1: Essential Foundation Specifications

### 8.1 Authentication Endpoints
* **`POST /api/auth/register` (Students Only):**
  * Validates: name, university email, password ($\ge 6$ characters), department, student ID.
  * Ensures email is not already registered; duplicate email returns HTTP 409 Conflict.
  * Hashes password with `bcrypt.hash(password, 10)`.
  * Persists user with `accountType: 'student'`.
  * Issues signed JWT payload: `{ id: user._id, accountType: user.accountType }` sent via an `HttpOnly` cookie named `token` (`SameSite=Strict`, `secure` in production). JWTs must never be stored in browser `localStorage` or `sessionStorage`.
  * Returns: 201 Created with sanitized user data (`data.user`) and `errors: null`.
* **`POST /api/auth/login`:**
  * Validates: email, password.
  * Looks up user by email; compares password using `bcrypt.compare`.
  * Issues signed JWT payload transmitted via `Set-Cookie: token=<jwt>; HttpOnly; Path=/; SameSite=Strict`.
  * Returns: 200 OK with sanitized user object (`data.user`), `errors: null`.
* **`POST /api/auth/logout`:**
  * Clears the authentication session by setting `Set-Cookie: token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`.
  * Returns: 200 OK with `data: null`, `errors: null`.
* **`GET /api/auth/me`:**
  * Protected by `requireAuth` middleware reading `req.cookies.token`.
  * Returns currently logged-in user profile (`data.user`), `errors: null`.

### 8.2 Supervisor Seeding Script
To demonstrate supervisor workflows during evaluation without creating public security holes:
* Script: `backend/scripts/seedSupervisors.js`.
* Execution: `npm run seed:supervisors`.
* Behavior: Connects to MongoDB, inserts 3–5 representative faculty supervisor accounts across different departments (Computer, Electrical, Mechanical), complete with realistic research interests and securely hashed passwords.

### 8.3 Project CRUD Operations
* **`POST /api/projects` (Create):**
  * Protected: Authenticated students only.
  * Payload: `title`, `abstract`, `domain`, `tags`, `maxTeamSize`, `targetCompletionDate`, `repositoryUrl`.
  * Action: Sets `leader = req.user._id`, `members = [req.user._id]`, `status = 'proposed'`, `recruitmentStatus = 'open'`, `pulseScore = 0`.
* **`GET /api/projects` (List, Search, Filter, Sort):**
  * Publicly accessible.
  * Query parameters:
    * `search`: Matches text in `title`, `abstract`, or `tags`.
    * `domain`: Filters by engineering domain.
    * `status`: Filters by project status (`proposed`, `in_progress`, `completed`).
    * `recruitment`: Filters by `open` or `closed`.
    * `sort`: `newest` (default), `oldest`, `deadline`, `pulse`.
* **`GET /api/projects/:id` (View Details — Public vs. Private Workspace):**
  * **Public Project View (Unauthenticated visitors & non-members):** Publicly accessible. Returns general metadata (`title`, `abstract`, `domain`, `tags`, `status`, `recruitmentStatus`, `pulseScore`) and sanitized roster info (`name`, `department`, `skills`). Members' email addresses, student IDs, and private workspace resources are omitted to protect student privacy.
  * **Private Workspace View (Authorized Leader, Members, and Assigned Supervisor):** Authenticated access. Returns full workspace details including members' emails, student IDs, repository URLs, internal task tracking, and document links.
* **`PATCH /api/projects/:id` (Update Metadata):**
  * Protected by `requireProjectLeader`.
  * Performs partial updates on non-structural metadata (`title`, `abstract`, `domain`, `tags`, `maxTeamSize`, `targetCompletionDate`, `status`, `repositoryUrl`).
  * Protected fields (`leader`, `members`, `supervisor`, `pulseScore`) cannot be modified through this endpoint.
  * Rejects if a non-leader attempts update (HTTP 403 Forbidden).
* **`DELETE /api/projects/:id` (Delete):**
  * Protected by `requireProjectLeader`.
  * Deletion Strategy (Child-Before-Parent): Safely removes associated child documents (`tasks`, `membershipRequests`, `supervisionRequests`, `documentLinks`, `discussionComments`, `submissions`) before deleting the parent `Project` document to ensure referential integrity and avoid orphaned records on partial failure.

### 8.4 Backend Authorization Middleware
```
Request ---> [ requireAuth ] ---> [ requireProjectLeader ] ---> Controller
```
1. **`requireAuth`:** Reads the JWT token from the `HttpOnly` session cookie named `token` (`req.cookies.token`). Decodes JWT and attaches `req.user`. Cookie security flags enforce `httpOnly: true` (mitigating XSS theft), `sameSite: 'strict'` (CSRF defense), and `secure: true` in production. For automated testing harnesses, `requireAuth` also accepts `Authorization: Bearer <token>` as a secondary test fallback if no cookie is present. JWTs must never be stored in browser `localStorage` or `sessionStorage`. Returns 401 Unauthorized if token is missing or invalid.
2. **`requireRole(roles)`:** Verifies `roles.includes(req.user.accountType)`. Returns 403 Forbidden if unauthorized.
3. **`requireProjectLeader`:** Finds project by `req.params.id || req.params.projectId`. Verifies `project.leader.equals(req.user._id)`. Returns 403 Forbidden if requester is not the leader.
4. **`requireProjectMember`:** Verifies requester is either the leader or an accepted member in `project.members`. Returns 403 Forbidden otherwise.

---

## 9. Stage 2: Core Collaboration Specifications

### 9.1 Team Membership Requests & Leader Approval
1. **Submit Join Request (`POST /api/projects/:projectId/join-requests`):**
   * Student submits a statement explaining their interest and skills.
   * Checks:
     * User cannot join a project they already belong to.
     * User cannot submit multiple active `pending` requests to the same project.
     * Project `recruitmentStatus` must be `'open'`.
     * `project.members.length` must be less than `project.maxTeamSize`.
2. **List Requests for Project (`GET /api/projects/:projectId/join-requests`):**
   * Accessible by Project Leader to review applicants.
3. **Approve Request (`PATCH /api/membership-requests/:requestId/approve`):**
   * Protected: Project Leader only.
   * Action: Sets request status to `'approved'`, appends student ID to `project.members`.
   * **Capacity Check:** If `project.members.length === project.maxTeamSize`, sets `project.recruitmentStatus = 'closed'`.
4. **Reject Request (`PATCH /api/membership-requests/:requestId/reject`):**
   * Protected: Project Leader only.
   * Action: Sets request status to `'rejected'`.
5. **Cancel Request (`PATCH /api/membership-requests/:requestId/cancel`):**
   * Action: Student withdraws their own pending request.

---

### 9.2 Tasks & Deadlines
* **`POST /api/projects/:projectId/tasks` (Create Task):**
  * Access: Project Leader and Project Members.
  * Fields: `title`, `description`, `assignedTo` (must be a team member), `dueDate`, `priority`.
  * Action: Backend automatically sets `createdBy = req.user._id` (required task creator reference).
  * Automatically recalculates `project.pulseScore`.
* **`GET /api/projects/:projectId/tasks` (List Tasks):**
  * Access: All team members and assigned supervisor.
  * Allows filtering by status (`todo`, `in_progress`, `done`).
* **`PATCH /api/tasks/:taskId` (Update Task / Status):**
  * Access: Team members and Project Leader.
  * If status transitions to `'done'`, sets `completedAt = new Date()`.
  * If status moves back from `'done'`, resets `completedAt = null`.
  * Triggers recalculation of the project's **Project Pulse**.
* **`DELETE /api/tasks/:taskId` (Delete Task):**
  * Access: Task creator (`task.createdBy.equals(req.user._id)`) or Project Leader (`project.leader.equals(req.user._id)`). Unauthorized attempts return HTTP 403 Forbidden.
  * Triggers recalculation of the project's **Project Pulse**.

---

### 9.3 Project Pulse (Calculated Health Metric)

#### Design Principle
Project Pulse is an objective, deterministic score ($0$ to $100$) calculated exclusively from live task data. It removes guesswork by calculating project health automatically whenever task operations occur.

#### Mathematical Definition

$$\text{Task Completion Rate} = \frac{\text{Completed Tasks}}{\text{Total Tasks}} \times 100$$

$$\text{Overdue Incomplete Tasks} = \text{Count of tasks where } (\text{status} \neq \text{'done'} \text{ and } \text{dueDate} < \text{Now})$$

$$\text{Overdue Penalty} = \text{Overdue Incomplete Tasks} \times 10$$

$$\text{Project Pulse} = \max\left(0, \min\left(100, \operatorname{round}(\text{Task Completion Rate} - \text{Overdue Penalty})\right)\right)$$

#### Precise Edge-Case Behaviors
1. **When there are 0 tasks in the project:**
   * $\text{Total Tasks} = 0$.
   * $\text{Project Pulse} = 0\%$.
   * **Visual Display:** Gray badge labeled `"No Tasks Yet"`.
   * **Explanation:** A project with no defined tasks cannot have measurable progress. The UI prompts the team: *"Create tasks with deadlines to start tracking Project Pulse."*
2. **When all tasks are completed:**
   * $\text{Completed Tasks} = \text{Total Tasks}$.
   * $\text{Overdue Incomplete Tasks} = 0$.
   * $\text{Project Pulse} = 100\%$.
   * **Visual Display:** Green badge labeled `"On Track"`.
3. **When overdue tasks exceed completed tasks:**
   * Example: 1 completed task out of 4 total tasks ($25\%$), with 2 overdue tasks ($-20\%$).
   * $\text{Pulse} = 25 - 20 = 5\%$.
   * The formula enforces a lower boundary at $0$ (score never becomes negative).
4. **When a project has tasks but a calculated score of zero:**
   * Example: 0 completed tasks out of 5 total tasks ($0\%$), or overdue penalties reduce the score to 0.
   * $\text{Total Tasks} > 0$, $\text{Project Pulse} = 0\%$.
   * **Visual Display:** Red badge labeled `"At Risk"`.
   * **Explanation:** The project has active tasks, but zero progress has been achieved or penalties have wiped out completion credit.

#### Health Status Bands

| Pulse Score Range | Badge Color | Status Label | Meaning |
| :--- | :--- | :--- | :--- |
| **0% (with 0 tasks)** | Gray | `No Tasks Yet` | Team needs to add tasks. |
| **0% (with tasks) – 39%** | Red | `At Risk` | Zero or very low completion rate, or high overdue count with active tasks. |
| **40% – 74%** | Amber / Yellow | `In Progress` | Moderate progress, some pending tasks. |
| **75% – 100%** | Green | `On Track` | High completion rate, deadlines on schedule. |

---

## 10. Stage 3: Additional Collaboration Specifications

### 10.1 Supervisor Directory & Supervision Requests
1. **Supervisor Directory (`GET /api/supervisors`):**
   * Lists all faculty supervisors.
   * Search by name, department, or research interests.
   * Displays supervisor name, department, title, research areas, and current count of supervised projects.
2. **Submit Supervision Request (`POST /api/projects/:projectId/supervision-requests`):**
   * Protected: Project Leader only.
   * Constraints:
     * Project must not already have an assigned supervisor.
     * Project may have **only one pending supervision request at a time** (prevents spamming multiple faculty members simultaneously).
   * Payload: `supervisorId`, `proposalMessage`.
3. **Supervisor Review (`PATCH /api/supervision-requests/:requestId`):**
   * Protected: The targeted supervisor only.
   * Actions:
     * **Accept:** Updates request status to `'accepted'`, sets `project.supervisor = supervisorId`.
     * **Decline:** Updates request status to `'declined'`, includes optional `feedback` note. The Project Leader is then free to send a request to a different supervisor.

---

### 10.2 External Document Links
To avoid the security, storage, and configuration overhead of multipart file uploads (such as AWS S3 or Multer storage), ProjectForge stores validated external web links.

* **`POST /api/projects/:projectId/documents` (Add Document Link):**
  * Protected: Team members and Leader.
  * Fields: `title`, `url`, `category`, `description`.
  * **Validation:** The backend verifies that `url` starts with `http://` or `https://`. Malicious protocols (`javascript:`, `data:`) are rejected with HTTP 422 Unprocessable Entity.
* **`GET /api/projects/:projectId/documents` (List Documents):**
  * Lists all external resources categorized by type.
  * Access: Team members, Leader, and Assigned Supervisor.
* **`PATCH /api/documents/:documentId` (Edit Document Link):**
  * Protected: Contributor who added the link (`document.addedBy.equals(req.user._id)`) or the Project Leader.
  * Fields: `title`, `url`, `category`, `description`.
  * **Validation:** Same URL validation (`http://` or `https://`) and category enum check. Malicious or malformed inputs rejected with HTTP 422 Unprocessable Entity. Unauthorized requests rejected with HTTP 403 Forbidden.
* **`DELETE /api/documents/:documentId` (Remove Document):**
  * Protected: Contributor who added the link (`document.addedBy.equals(req.user._id)`) or the Project Leader. Unauthorized requests rejected with HTTP 403 Forbidden.

---

### 10.3 Project Discussions & Comments
* **`POST /api/projects/:projectId/comments` (Post Comment):**
  * Access: Project Leader, Team Members, and Assigned Supervisor.
  * Fields: `content` (up to 2000 characters).
  * Automatically records author ID and timestamp.
* **`GET /api/projects/:projectId/comments` (List Comments):**
  * Returns comments in chronological order.
  * Pinned notices (announcements pinned by the Leader or Supervisor) appear at the top.
* **`DELETE /api/comments/:commentId` (Delete Comment):**
  * Access: Author of the comment or the Project Leader.

---

### 10.4 Deliverable Submissions & Supervisor Feedback
* **`POST /api/projects/:projectId/submissions` (Submit Deliverable):**
  * Protected: Project Leader.
  * Fields: `title` (e.g., *"Interim Progress Report"*), `deliverableUrl` (e.g., link to Google Doc or GitHub release), `notes`.
  * Sets `status = 'submitted'`.
* **`GET /api/projects/:projectId/submissions` (List Submissions):**
  * Access: Team members and Assigned Supervisor.
* **`PATCH /api/submissions/:submissionId/review` (Supervisor Feedback):**
  * Protected: Assigned Supervisor only.
  * Payload: `status` (`'approved'` or `'revisions_requested'`), `supervisorFeedback` (detailed guidance).
  * Action: Updates submission record with feedback and timestamp. If revisions are requested, the team can address the critique and submit an updated deliverable link.

---

## 11. Security & Data Integrity Requirements

The security model is tailored specifically for an undergraduate mini project: robust against common vulnerabilities without introducing enterprise complexity.

1. **Password Hashing:**
   * Passwords must be hashed using `bcrypt` (10 rounds) before saving to MongoDB.
   * Plaintext passwords must never appear in database records, console logs, or API responses.
2. **Stateless JWT Cookie Authentication:**
   * JSON Web Tokens signed with a secret key stored in the backend `.env` file.
   * Tokens expire after 24 hours.
   * Transmitted exclusively via an `HttpOnly` cookie named `token` (`SameSite=Strict`, `secure` in production). Client scripts cannot access the cookie, preventing XSS-based token theft. Strict same-site enforcement provides CSRF protection.
   * For automated testing harnesses (e.g. Postman, supertest), `requireAuth` may optionally support `Authorization: Bearer <token>` as a secondary fallback.
3. **Backend Authorization Defense:**
   * Hiding an "Edit" or "Delete" button in the React frontend is treated as a UI convenience, not a security boundary.
   * Every protected endpoint re-verifies ownership and user role in the database before modifying data.
4. **MongoDB Persistence & Client Storage Boundary:**
   * All user, project, task, and discussion data must persist in MongoDB.
   * Browser `localStorage` and `sessionStorage` **must never store the JWT**. Client-side storage is reserved solely for non-sensitive UI preferences or cached user display details—never for authentication credentials or primary application state.
5. **Input Validation & Sanitization:**
   * Schema-level validation enforces string lengths, required fields, and enums.
   * Route-level validation rejects malformed requests before executing business logic.
6. **Environment Variable Configuration:**
   * Sensitive values (`MONGO_URI`, `JWT_SECRET`, `PORT`) must remain in `.env` files and must never be committed to source control.

---

## 12. User Interface States & Feedback

To provide a smooth, professional user experience:

1. **Loading States:**
   * Display loading spinners or skeleton placeholder cards during API data fetches.
   * Disable form submit buttons and display a loading indicator during submission to prevent accidental duplicate requests.
2. **Empty States:**
   * When data collections are empty, display helpful messages rather than blank pages:
     * *No Projects Found:* *"No projects match your search criteria. Try clearing filters or create a new project."*
     * *No Tasks:* *"No tasks created yet. Click 'Add Task' to assign items and track Project Pulse."*
     * *No Documents:* *"No external resources linked yet. Add links to Google Drive, GitHub, or design documents."*
3. **Toast Notifications:**
   * Display clear, non-intrusive alerts for user actions (e.g., *"Project updated successfully"*, *"Task completed"*, *"Invalid email format"*).
4. **Confirmation Modals:**
   * Require explicit confirmation before destructive actions (deleting a project or removing a team member).

---

## 13. Scope Boundaries & Excluded Features

To maintain high code quality and finish the project within the semester timeline, the following boundaries are established:

| Category | In Scope for Mini Project | Excluded from Mini Project |
| :--- | :--- | :--- |
| **Communication** | Chronological comments and discussion feed. | Real-time WebSocket chat, typing indicators, live cursors. |
| **Documents** | Validated external URLs (Google Drive, GitHub, etc.). | Local file uploads via Multer, AWS S3 storage buckets. |
| **Supervisor Setup** | Database seeding script (`npm run seed:supervisors`). | Self-service institutional verification or HR system integration. |
| **Meetings** | Sharing external Google Meet / Zoom links in documents. | Embedded WebRTC video/audio conferencing. |
| **Authentication** | Standard JWT authentication with bcrypt password hashing. | University Single Sign-On (SSO), LDAP, or SAML. |
| **Academic Rules** | Platform-level workflow (propose, collaborate, review). | Claims of official institutional policy enforcement. |

---

## 14. Core Acceptance Criteria

These criteria provide clear test cases for project demonstration and evaluation.

### Stage 1 Criteria
* **AC-01 (Student Registration):** Submitting valid student details creates a user with `accountType: 'student'` and a hashed password, setting the `token` `HttpOnly` cookie. Submitting duplicate emails returns HTTP 409 Conflict.
* **AC-02 (Supervisor Setup Protection):** Attempting to register with `accountType: 'supervisor'` via the public signup endpoint is rejected with HTTP 403 Forbidden. Running the seed script successfully provisions supervisor accounts.
* **AC-03 (Project CRUD Persistence):** An authenticated student can create a project, which immediately persists in MongoDB. The creator is stored as `leader` and added to `members`.
* **AC-04 (Leader Authorization Guard):** A non-leader student attempting to update (`PATCH`) or delete (`DELETE`) a project receives HTTP 403 Forbidden.
* **AC-05 (Search & Filter):** Querying `/api/projects?search=robotics&domain=Mechanical` correctly returns only matching project documents.

### Stage 2 Criteria
* **AC-06 (Membership Request Flow):** A student can submit a join request. The Project Leader can approve it, which adds the student to `project.members`.
* **AC-07 (Recruitment Auto-Close):** When an approved request brings `project.members.length` to `project.maxTeamSize`, `project.recruitmentStatus` changes to `'closed'`.
* **AC-08 (Task Creation & Status):** Team members can create tasks with deadlines and update their status (`todo` $\rightarrow$ `in_progress` $\rightarrow$ `done`). Task creation records `createdBy`. Deletion is restricted to the creator or Project Leader.
* **AC-09 (Pulse Calculation):** When a project has tasks, its `pulseScore` accurately reflects the formula $(\text{Completion Rate} - \text{Overdue Penalty})$. If a project has 0 tasks, its pulse is $0\%$ with the status `"No Tasks Yet"`. If a project has tasks but calculated score is 0, its status is `"At Risk"` (Red).

### Stage 3 Criteria
* **AC-10 (Supervisor Request Constraint):** A project can have only one pending supervision request at a time. Attempting to send a second request while one is pending returns HTTP 409 Conflict.
* **AC-11 (Supervisor Acceptance):** When a supervisor accepts a request, `project.supervisor` is updated, and the supervisor gains review access.
* **AC-12 (Document Link Validation):** Submitting a URL with `https://` succeeds. Submitting a URL with `javascript:` or invalid formatting is rejected with HTTP 422. Contributors or Project Leaders can edit links via `PATCH /api/documents/:documentId`.
* **AC-13 (Deliverable Review):** When a leader submits a deliverable URL, the assigned supervisor can submit review feedback (`'approved'` or `'revisions_requested'`).
