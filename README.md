# ProjectForge

> **Centralized Collaboration & Supervision Workspace for Undergraduate Engineering Projects**  
> *EE4207 — Web Application Development Mini-Project Submission*

[![Live Demo](https://img.shields.io/badge/Live_Demo-projectforge--tau.vercel.app-0070F3?style=flat&logo=vercel&logoColor=white)](https://projectforge-tau.vercel.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-ProjectForge-181717?style=flat&logo=github&logoColor=white)](https://github.com/sanudadaksina-coder/ProjectForge)
[![Stack](https://img.shields.io/badge/Stack-MERN-green?style=flat)](https://projectforge-tau.vercel.app)
[![Verified Tests](https://img.shields.io/badge/Verified_Tests-343_Passed-success?style=flat)](https://github.com/sanudadaksina-coder/ProjectForge)
[![Node](https://img.shields.io/badge/Node-v20%2B_%7C_v22%2B-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)

**Live Application:** [https://projectforge-tau.vercel.app](https://projectforge-tau.vercel.app)  
**Source Code Repository:** [https://github.com/sanudadaksina-coder/ProjectForge](https://github.com/sanudadaksina-coder/ProjectForge)

---

## 1. Academic Context & Introduction

**ProjectForge** is a full-stack MERN (MongoDB, Express.js, React, Node.js) web application designed and developed for the **EE4207 Web Application Development** undergraduate engineering curriculum. 

Undergraduate engineering projects (such as final-year capstone, comprehensive design, and semester mini-projects) require multidisciplinary collaboration, formal supervisory governance, milestone monitoring, and team recruitment. ProjectForge provides a centralized platform connecting engineering students and faculty supervisors into structured, transparent project workspaces.

---

## 2. Problem Addressed & Project Objectives

### The Problem
* **Fragmented Communication:** Student project teams frequently coordinate through disparate chat groups, emails, and shared spreadsheets, causing lost action items and untracked deadlines.
* **Recruitment Inefficiencies:** Students seeking multidisciplinary partners lack a unified directory of proposed projects, required engineering skills, and roster availability.
* **Supervisory Friction:** Academic staff receive unstructured project supervision requests without standardized proposals, capacity tracking, or visibility into project activity.
* **Uncertain Milestone Health:** Subjective progress reporting often conceals schedule slippage until final submission milestones.

### Project Objectives
1. **Unified Workspace:** Provide a single-origin collaborative hub for project discovery, team management, task coordination, and faculty supervision.
2. **Objective Health Metrics:** Implement a deterministic algorithm (**Project Pulse**) that quantifies project health based on deadline discipline and completed work.
3. **Structured Governance:** Provide role-based authorization differentiating project leaders, team members, outsider students, and faculty supervisors.
4. **Production Security:** Enforce secure authentication using signed JSON Web Tokens (JWT) transmitted strictly through encrypted `HttpOnly` same-origin cookies with robust input validation.

---

## 3. Technology Stack

### Frontend
* **React 19 (`^19.3.1`)**: Component-driven declarative user interface with functional hooks and in-memory session management.
* **React Router DOM 7 (`^7.18.4`)**: Client-side single-page application (SPA) routing, route protection, and navigation guards.
* **Vite 8 (`^8.3.4`)**: High-performance module bundler, development server with hot module replacement (HMR), and production asset optimization.
* **Custom Vanilla CSS Design System**: Responsive dark/light theme, accessible form controls, and CSS Grid/Flexbox layouts without heavy third-party UI framework dependencies.
* **Oxlint (`^1.88.0`)**: High-performance static code analysis and linting.

### Backend & API
* **Node.js (`>=20.19.0 / >=22.12.0`)**: Server-side JavaScript runtime environment.
* **Express.js 4 (`^4.21.2`)**: RESTful API server structuring routes, middleware, and request/response pipelines.
* **JSON Web Tokens (`jsonwebtoken ^9.0.3`)**: Cryptographic session tokens with 24-hour expiration.
* **Bcrypt.js (`^3.0.3`)**: Password hashing with automated salt generation (cost factor 10).
* **Cookie-Parser (`^1.4.7`)**: Secure cookie parsing for incoming HTTP requests.
* **CORS (`^2.8.5`)**: Cross-Origin Resource Sharing handling with credentials support.
* **Dotenv (`^16.4.7`)**: Zero-dependency environment variable loader.

### Database & Cloud Infrastructure
* **MongoDB Atlas**: Managed multi-region cloud database cluster.
* **Mongoose 9 (`^9.11.4`)**: Object Data Modeling (ODM) library with schema validation, indexes, and document population.
* **Vercel Hobby Platform**:
  * **Edge Network / CDN**: Global static hosting for compiled Vite frontend assets with automatic SPA fallback rewrites.
  * **Serverless Functions**: Express REST API hosted in region `bom1` (Mumbai, India) co-located with the MongoDB Atlas AWS Mumbai (`ap-south-1`) cluster.

---

## 4. Implemented Features

### 4.1 Authentication & Session Security
* **Student Registration:** Public registration restricted strictly to engineering students. Validates standardized university email addresses, student registration numbers, semester levels (1–8), and academic departments.
* **Supervisor Governance:** Supervisor self-registration is strictly prohibited on public endpoints. Demonstration faculty profiles are securely managed via administrative database scripts with bcrypt password hashing.
* **HttpOnly Session Cookies:** JWT tokens are issued with `httpOnly: true`, `secure: true` (in production), `sameSite: 'strict'`, and a 24-hour expiration (`maxAge: 86400000`). Tokens are never stored in `localStorage` or `sessionStorage`, mitigating Cross-Site Scripting (XSS) token theft.
* **Centralized Auth Context:** Client session is restored on startup via `GET /api/auth/me` and held exclusively in React memory.

### 4.2 Project CRUD & Public Discovery
* **Public Project Catalog:** Search and filter projects across title, abstract, tags, and engineering domains.
* **Standardized Engineering Domains:** Categorized into six distinct technical domains defined in `server/src/models/Project.js`: `Computer`, `Electrical`, `Mechanical`, `Civil`, `Biomedical`, and `Multidisciplinary` (distinct from academic faculty departments).
* **Privacy Boundary:** Public project views redact student email addresses and registration IDs, exposing only collaborator names and departments. Full operational contact details are reserved for authenticated project teammates and assigned faculty supervisors.
* **Project Lifecycle:** Supported project lifecycle states are `proposed` → `in_progress` → `completed` (defined in the `status` schema enum). Projects also maintain a recruitment status of `open` or `closed`. Only the authorized Project Leader can update project metadata or delete a project.

### 4.3 Team Recruitment & Membership Workflows
* **Join Requests:** Eligible students apply to open projects by submitting a motivational statement (10–300 characters).
* **Capacity Guards:** Projects enforce a maximum team size limit (2–6 students). Teams reaching capacity automatically transition recruitment status from `open` to `closed`.
* **Leader Decision Inbox:** Project leaders review applicant profiles, student IDs, and motivation statements, with dedicated `accept` and `decline` actions.
* **Safe Roster Management:** Leaders can remove members when necessary; recruitment status automatically re-opens if team capacity drops below `maxTeamSize`.

### 4.4 Task Management & Project Pulse
* **Action Checklist:** Structured task management supporting title, description, priority (`low`, `medium`, `high`), due date, and team member assignment.
* **Checkbox Toggle:** Fast toggle updates task completion status (`todo` ↔ `done`), stamping or resetting completion timestamps.
* **Dual Real-Time Metrics:** Clear separation between simple **Task Completion Progress** (0–100%) and dynamic **Project Pulse** health rating (0–100).
* **Cascade Deletion:** Deleting a project automatically cascades and cleans up child tasks and membership requests.

### 4.5 Faculty Supervisor Directory & Supervision Hub
* **Academic Directory:** Searchable directory of faculty supervisors categorized across standardized engineering departments with research interests, office locations, and live supervision workload.
* **Formal Supervision Proposals:** Project leaders submit detailed technical supervision proposals (20–1,000 characters) to available faculty members.
* **Supervisor Dashboard:** Dedicated hub (`/supervisor/dashboard`) where faculty review pending student proposals, inspect project workspaces, and accept or decline requests with constructive feedback.
* **Workload Capacity Limits:** Supervisors have a strict capacity threshold (default 5 concurrent projects). Supervisors at capacity are marked unavailable and cannot accept new proposals.

---

## 5. User Roles & Permission Matrix

The application enforces fine-grained access control across four principal access tiers:

| Feature / Action | Unauthenticated Visitor | Outsider Student | Project Team Member | Project Leader | Faculty Supervisor |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Browse Public Project Catalog | Yes | Yes | Yes | Yes | Yes |
| View Public Project Overview | Yes (Sanitized) | Yes (Sanitized) | Yes | Yes | Yes |
| Student Self-Registration | Yes | N/A (Logged In) | N/A | N/A | N/A |
| Create New Project | No | Yes (Becomes Leader) | Yes (Becomes Leader) | Yes | No (Blocked) |
| Apply to Join Team | No | Yes (If Open) | No (Already Member) | No (Is Leader) | No (Blocked) |
| View Private Workspace / Contact Info | No | No | Yes | Yes | Yes (If Assigned) |
| Manage Team Members (Accept/Remove) | No | No | No | Yes | No |
| View Tasks & Project Pulse Score | No | No | Yes (Read-Only) | Yes | Yes (If Assigned) |
| Create, Edit, Toggle, Delete Tasks | No | No | No | Yes | No |
| Submit Supervision Request | No | No | No | Yes | No |
| View Supervisor Directory | No | Yes | Yes | Yes | Yes |
| Access Supervision Decision Hub | No | No | No | No | Yes (Own Requests) |
| Accept / Decline Supervision Proposals | No | No | No | No | Yes (Targeted Only) |

---

## 6. Metric Calculations & Formulas

ProjectForge distinguishes between simple **Task Completion Progress** and the dynamic **Project Pulse** health score. Both metrics are computed deterministically in `server/src/utils/pulse.js`.

### 6.1 Task Completion Progress (Linear Completion)
Reflects the mathematical proportion of completed tasks regardless of calendar deadlines:

$$\text{Completion Progress (\%)} = \begin{cases} 0\% & \text{if } \text{Total Tasks} = 0 \\ \text{round}\left( \frac{\text{Completed Tasks}}{\text{Total Tasks}} \times 100 \right) & \text{if } \text{Total Tasks} > 0 \end{cases}$$

```javascript
// Algorithmic definition (server/src/utils/pulse.js)
const totalTasks = tasks.length;
const completedTasks = tasks.filter(t => t.status === 'done').length;
const completionPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
```

### 6.2 Project Pulse Score (Dynamic Health Rating)
Quantifies operational momentum by balancing completed tasks against overdue milestone penalties:

$$\text{Completion Rate} = \frac{\text{Completed Tasks}}{\text{Total Tasks}} \times 100$$

$$\text{Overdue Penalty} = \text{Overdue Incomplete Tasks} \times 10$$

$$\text{Raw Pulse Score} = \text{round}\left( \text{Completion Rate} - \text{Overdue Penalty} \right)$$

$$\text{Project Pulse Score} = \max\left(0, \min\left(100, \text{Raw Pulse Score}\right)\right)$$

```javascript
// Algorithmic definition (server/src/utils/pulse.js)
const completionRate = (completedTasks / totalTasks) * 100;
const overduePenalty = overdueIncompleteTasks * 10; // 10-point deduction per overdue item
const rawScore = Math.round(completionRate - overduePenalty);
const pulseScore = Math.max(0, Math.min(100, rawScore));
```

*An overdue incomplete task is defined as any task where `status !== 'done'` and `dueDate < currentTimestamp`.*

### 6.3 Pulse Classification & Visual Indicators

| Pulse Score Range | Condition | Status Label | Badge Color | Meaning |
| :---: | :---: | :---: | :---: | :--- |
| **0** | `totalTasks === 0` | `No Tasks Yet` | Gray (`#cbd5e1`) | Project has been created but no milestone tasks are logged. |
| **0 – 39** | `totalTasks > 0` | `At Risk` | Red (`#f87171`) | Heavy overdue task burden or critically low completion rate. |
| **40 – 74** | Any | `In Progress` | Yellow (`#fbbf24`) | Steady milestone progress with manageable or minor delays. |
| **75 – 100** | Any | `On Track` | Green (`#34d399`) | High completion discipline with zero or minimal deadline slippage. |

---

## 7. Project Directory Structure

```text
ProjectForge/
├── api/
│   └── index.js                      # Vercel Serverless Function entry point (Express adapter)
├── client/                           # React frontend application (Vite SPA)
│   ├── public/                       # Static public assets
│   ├── src/
│   │   ├── components/               # Modular UI components & modal dialogs
│   │   │   ├── ApplyToJoinModal.jsx
│   │   │   ├── DeclineRequestModal.jsx
│   │   │   ├── DeleteTaskModal.jsx
│   │   │   ├── JoinRequestsSection.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── ProjectTasksSection.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── RemoveMemberModal.jsx
│   │   │   ├── RequestSupervisionModal.jsx
│   │   │   ├── SupervisionSection.jsx
│   │   │   ├── SupervisorProfileModal.jsx
│   │   │   └── TaskModal.jsx
│   │   ├── context/                  # Context providers (Auth state management)
│   │   │   ├── AuthContext.jsx
│   │   │   └── useAuth.js
│   │   ├── pages/                    # Routed application page views
│   │   │   ├── CreateProjectPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── EditProjectPage.jsx
│   │   │   ├── LandingPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── ProjectDetailsPage.jsx
│   │   │   ├── ProjectDiscoveryPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── SupervisorDashboardPage.jsx
│   │   │   └── SupervisorDirectoryPage.jsx
│   │   ├── App.css                   # Global stylesheet and responsive design system
│   │   ├── App.jsx                   # Route declarations and root layout
│   │   └── main.jsx                  # React DOM entry point
│   ├── test/                         # Frontend unit and integration regression suites
│   ├── package.json                  # Client package dependencies and scripts
│   └── vite.config.js                # Vite build and development proxy configuration
├── docs/                             # Academic specifications & API contracts
│   ├── API_CONTRACT.md               # Standardized REST endpoint schema specifications
│   ├── DATA_MODEL.md                 # Mongoose schemas and entity relationships
│   └── PROJECT_SPEC.md               # Functional project specification
├── server/                           # Express REST API backend
│   ├── scripts/                      # Database maintenance & seeding scripts
│   │   ├── seedSupervisors.js        # Supervisor account creation seed script
│   │   └── updateSupervisorProfiles.js
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                 # Cached serverless MongoDB connection manager
│   │   ├── controllers/              # Request handling & operational business logic
│   │   │   ├── authController.js
│   │   │   ├── membershipController.js
│   │   │   ├── projectController.js
│   │   │   ├── supervisionController.js
│   │   │   ├── supervisorController.js
│   │   │   └── taskController.js
│   │   ├── middleware/
│   │   │   └── auth.js               # JWT verification & role authorization guards
│   │   ├── models/                   # Mongoose data schemas
│   │   │   ├── MembershipRequest.js
│   │   │   ├── Project.js
│   │   │   ├── SupervisionRequest.js
│   │   │   ├── Task.js
│   │   │   └── User.js
│   │   ├── routes/                   # Express REST route definitions
│   │   │   ├── authRoutes.js
│   │   │   ├── membershipRoutes.js
│   │   │   ├── projectRoutes.js
│   │   │   ├── supervisionRoutes.js
│   │   │   ├── supervisorRoutes.js
│   │   │   └── taskRoutes.js
│   │   ├── utils/                    # Shared algorithmic logic
│   │   │   ├── pulse.js              # Deterministic Pulse & Progress calculator
│   │   │   └── token.js              # JWT creation and cookie handlers
│   │   ├── app.js                    # Express app configuration & middleware pipeline
│   │   └── server.js                 # Standalone local HTTP entry point (port 5000)
│   ├── test/                         # Backend automated test suites
│   ├── .env.example                  # Safe environment template
│   └── package.json                  # Backend package dependencies and scripts
├── package.json                      # Root workspace orchestrator
├── vercel.json                       # Vercel single-project build and rewrite configuration
└── README.md                         # Project documentation
```

---

## 8. Local Installation & Execution Guide

### Prerequisites
* **Node.js**: `v20.19.0` or `v22.12.0+` installed ([nodejs.org](https://nodejs.org/))
* **npm**: `v10+`
* **MongoDB**: A local MongoDB instance (`mongodb://localhost:27017`) or a free MongoDB Atlas cluster

### 1. Clone the Repository
```bash
git clone https://github.com/sanudadaksina-coder/ProjectForge.git
cd ProjectForge
```

### 2. Install Dependencies
Install dependencies across the root, client, and server packages:
```bash
# Install root dependencies
npm install

# Install client dependencies
npm --prefix client install

# Install server dependencies
npm --prefix server install
```

### 3. Configure Local Environment Variables
Create a `.env` file in the `server/` directory:
```bash
cp server/.env.example server/.env
```
Open `server/.env` and supply your local configuration:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/projectforge_db
JWT_SECRET=your_local_development_jwt_secret_placeholder_minimum_32_characters
CLIENT_ORIGIN=http://localhost:5173
```

### 4. (Optional) Seed Demonstration Supervisor Accounts
The supervisor account seeding script (`server/scripts/seedSupervisors.js`) is an **optional administrative utility** that provisions four fictional faculty profiles for local demonstration and evaluation.

> [!WARNING]
> This script is intended strictly for initial setup in local or demonstration environments. **Do not execute this script casually against an existing, populated production database.**

For security and accidental-execution prevention, the script enforces two mandatory safety gates:
1. **Explicit Password Requirement:** Requires a password of at least 6 characters supplied via the `SUPERVISOR_SEED_PASSWORD` environment variable (never hardcoded in source code).
2. **Explicit Confirmation:** Requires explicit execution authorization via the `--confirm` CLI flag or `CONFIRM_SEED=true`.

The script is idempotent: it checks existing accounts by email and will not overwrite existing users or alter existing passwords.

**Execution Examples (Safe Placeholders):**

* **Using CLI Confirmation Flag:**
  ```bash
  # Linux / macOS / Bash:
  SUPERVISOR_SEED_PASSWORD="<YourSecureSeedPassword>" npm --prefix server run seed:supervisors -- --confirm

  # Windows PowerShell:
  $env:SUPERVISOR_SEED_PASSWORD="<YourSecureSeedPassword>"; npm --prefix server run seed:supervisors -- --confirm
  ```

* **Using Environment Variable Confirmation:**
  ```bash
  # Linux / macOS / Bash:
  SUPERVISOR_SEED_PASSWORD="<YourSecureSeedPassword>" CONFIRM_SEED=true npm --prefix server run seed:supervisors

  # Windows PowerShell:
  $env:SUPERVISOR_SEED_PASSWORD="<YourSecureSeedPassword>"; $env:CONFIRM_SEED="true"; npm --prefix server run seed:supervisors
  ```

*Alternatively, define `SUPERVISOR_SEED_PASSWORD=<YourSecureSeedPassword>` in `server/.env` and execute:*
```bash
npm --prefix server run seed:supervisors -- --confirm
```

### 5. Run the Local Development Environment
Start both the backend API server and Vite frontend concurrently in separate terminal windows:

* **Terminal 1 — Backend Express Server:**
  ```bash
  npm --prefix server run dev
  # Listens on http://localhost:5000
  ```

* **Terminal 2 — Frontend Vite Application:**
  ```bash
  npm --prefix client run dev
  # Serves on http://localhost:5173 with proxying to localhost:5000
  ```

Open your browser and navigate to `http://localhost:5173`.

---

## 9. Environment Variables Configuration

| Variable Name | Environment | Description | Example / Placeholder |
| :--- | :--- | :--- | :--- |
| `PORT` | Local | Port for the standalone Express HTTP server | `5000` |
| `NODE_ENV` | All | Application environment context | `development` or `production` |
| `MONGO_URI` | All | MongoDB connection string URI | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority` |
| `JWT_SECRET` | All | Cryptographic secret for signing JWT auth tokens | `random_high_entropy_secret_string_min_32_chars` |
| `CLIENT_ORIGIN` | All | Allowed origin for CORS headers | `http://localhost:5173` (local) or your domain |

> [!CAUTION]
> Never commit actual passwords, private database connection strings, or production JWT secrets to source control. Ensure all `.env` files remain ignored via `.gitignore`.

---

## 10. MongoDB Atlas Configuration & Network Access

When connecting to MongoDB Atlas in cloud or serverless production environments:

1. **Database Cluster:** Provision an M0 (Free Tier) or dedicated cluster in the desired cloud region (AWS Mumbai `ap-south-1` is recommended for minimal latency with Vercel `bom1`).
2. **Database User & Least Privilege:** Create a dedicated database user with access restricted strictly to the required database (e.g. `readWrite` on `projectforge_db`), avoiding overly permissive administrative roles. Ensure the `authSource=admin` parameter is present in the connection string.
3. **Network Access & Cloud IP Allowlist Considerations:**
   * **For Local Development:** Add your individual public workstation IP address or local subnet to the Atlas Network Access allowlist for tight network boundary isolation.
   * **For Vercel Serverless Deployment:** Vercel Serverless Functions execute on dynamic shared IP ranges across cloud regions without dedicated static outbound IPs on the Hobby tier. Consequently, connecting from Vercel necessitates adding `0.0.0.0/0` (Allow access from anywhere) in MongoDB Atlas Network Access.

   > [!CAUTION]
   > **Security Note:** Unrestricted IP allowlisting (`0.0.0.0/0`) is a pragmatic workaround for serverless hosting limitations and is **not** an enterprise security default. In this topology, defense-in-depth relies entirely on:
   > - Strong, high-entropy database user passwords managed via environment variables.
   > - Least-privilege database user permissions (restricting the database user to `readWrite` strictly on the target database, avoiding cluster-admin privileges).
   > - Utilizing Atlas temporary IP access rules during grading and evaluation windows where possible.
   > - Removing or disabling the `0.0.0.0/0` access rule once evaluation or grading is concluded.

---

## 11. Live Vercel Deployment

The application is deployed as a single project on Vercel:

* **Production URL:** [https://projectforge-tau.vercel.app](https://projectforge-tau.vercel.app)
* **Architecture:**
  * **Static Assets:** React/Vite client built into `client/dist` and distributed globally across Vercel's Edge CDN.
  * **API Function:** Node.js Express serverless function (`api/index.js`) executing in region `bom1` (Mumbai, India).
  * **Single HTTPS Origin:** Frontend and API share the identical domain, ensuring `sameSite: 'strict'` HttpOnly cookies operate seamlessly without cross-origin friction.
  * **SPA Fallback:** All non-API routes (`/dashboard`, `/projects/:id`, `/supervisors`, etc.) rewrite to `/index.html` to support direct browser navigation and hard refreshes.

---

## 12. Automated Testing & Verified Test Coverage

ProjectForge contains **13 automated test suites** covering **343 verified assertions** across backend business logic, authorization boundaries, database concurrency, and frontend state management:

### Test Execution Commands
Run the automated test suites using the project package scripts:

```bash
# --- Backend Test Suites ---
npm --prefix server run test:auth          # 19 tests: Student registration, JWT, cookies, login, logout
npm --prefix server run test:crud          # 26 tests: Project creation, public vs private views, mutations
npm --prefix server run test:membership    # 31 tests: Join requests, concurrency race guards, member removals
npm --prefix server run test:task          # 20 tests: Task checklist, permissions, Project Pulse calculation
npm --prefix server run test:supervisor    # 25 tests: Faculty directory, proposal submissions, accept/decline
npm --prefix server run test:production    # 24 tests: Express static serving, SPA fallback, 404 JSON isolation
npm --prefix server run test:vercel        # 35 tests: Vercel serverless adapter, connection caching, rewrites

# --- Frontend Test Suites ---
npm --prefix client run test:frontend      # 10 tests: Student registration validation, in-memory state
npm --prefix client run test:projects      # 12 tests: Project CRUD form guards, payload sanitization
npm --prefix client run test:membership    # 16 tests: Join modal logic, capacity handling, credentials:include
npm --prefix client run test:tasks         # 50 tests: Dual metric UI calculation, checkbox transitions
npm --prefix client run test:supervisor    # 54 tests: Directory search, proposal boundaries, workload display
npm --prefix client run test:refinement    # 21 tests: Clean presentation verification, UI regression

# --- Static Analysis & Production Build ---
npm --prefix client run lint               # Oxlint static code analysis (0 errors)
npm --prefix client run build              # Vite production bundle compilation
```

### Database Connection Behavior During Testing
* **Dedicated Isolated Test Databases:** The core integration suites—`test:auth`, `test:crud`, `test:membership`, `test:task`, and `test:supervisor`—explicitly override the database connection to dedicated ephemeral databases (`projectforge_auth_test_db`, `projectforge_crud_test_db`, `projectforge_membership_test_db`, `projectforge_task_test_db`, and `projectforge_supervisor_test_db`). These suites clean up and drop their test databases upon completion to prevent pollution of development records.
* **Development Database Connection:** In contrast, `server/test/vercel.function.test.js` exercises the production serverless entry point adapter (`api/index.js`), which connects to the database designated by `process.env.MONGO_URI` (by default `projectforge_db` in development) to test connection caching and endpoint responses using non-destructive, read-only requests.
* **Standalone Mocking:** `server/test/production.smoke.test.js` and all frontend test suites (`client/test/`) run against ephemeral local servers or in-memory React structures without modifying any persistent database records.

> [!NOTE]
> The figures below represent **previously verified execution results** during preflight and deployment testing across the 13 automated test suites (180 backend + 163 frontend assertions passed, 0 failed), rather than an independently guaranteed static coverage metric.

| Scope | Test Suites | Total Assertions | Status |
| :--- | :---: | :---: | :---: |
| **Backend Integration & Unit** | 7 Suites | 180 Passed / 0 Failed | **100% PASS** |
| **Frontend Unit & Logic** | 6 Suites | 163 Passed / 0 Failed | **100% PASS** |
| **Total Automated Coverage** | **13 Suites** | **343 Passed / 0 Failed** | **100% PASS** |

---

## 13. Known Hosting Limitations

* **Serverless Function Lifecycles & Timeouts:** On Vercel serverless infrastructure, functions execute in ephemeral container runtimes subject to platform execution timeout limits (configured via `maxDuration` in `vercel.json` up to tier boundaries). REST API endpoints are designed for rapid response; however, long-running synchronous batch operations, complex data migrations, or continuous background daemons should not be hosted within serverless functions.
* **Serverless Cold Starts:** Ephemeral serverless containers spin up on demand when cold. Initial cold-start requests may experience additional latency while Node.js boots and the database connection is initialized. ProjectForge mitigates this through intra-process connection caching (`global.mongoose` in `server/src/config/db.js`) and co-locating the serverless region (`bom1` Mumbai) with the MongoDB Atlas AWS Mumbai cluster.
* **Persistent WebSockets & State:** Serverless environments are stateless and cannot maintain persistent stateful TCP or WebSocket connections. Real-time metric synchronization is achieved through on-demand client state invalidation and request-time recalculations.

---

## 14. Academic Mini-Project Submission Notice

* **Course:** EE4207 — Web Application Development
* **Institution:** Department of Electrical and Information Engineering, Faculty of Engineering
* **Project Title:** ProjectForge — Centralized Workspaces for Undergraduate Engineering Projects
* **Author / Developer:** Sanuda Daksina (`sanudadaksina-coder`)
* **Academic Term:** 2026 Academic Year
* **Submission Version:** 1.0.0 (Production Release)

---

## 15. License

This project is developed solely for academic coursework evaluation under the EE4207 Web Application Development curriculum. All rights reserved.
