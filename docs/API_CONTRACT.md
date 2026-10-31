# ProjectForge: API Contract Specification

**Document Version:** 1.1.0  
**Target Document:** `docs/API_CONTRACT.md`  
**Related Specifications:** `docs/PROJECT_SPEC.md` and `docs/DATA_MODEL.md`  
**Standard Envelope:** `{ "success": boolean, "message": string, "data": object | null, "errors": array | null }`

---

## 1. Global API Conventions & Standards

### 1.1 Base URL & Content Type
* **Base URL:** `/api`
* **Request Header:** `Content-Type: application/json` (for all mutation requests with a JSON body)
* **Response Header:** `Content-Type: application/json; charset=utf-8`

### 1.2 Authentication & Cookie Strategy
* **Authentication Method:** JSON Web Token (JWT) transmitted exclusively via an **`HttpOnly` session cookie** named `token`.
* **Cookie Configuration:**
  ```javascript
  res.cookie('token', token, {
    httpOnly: true, // Prevents client-side JavaScript access (mitigates XSS token theft)
    secure: process.env.NODE_ENV === 'production', // Transmit only over HTTPS in production
    sameSite: 'strict', // Strict CSRF protection: cookie is only sent on first-party requests
    maxAge: 24 * 60 * 60 * 1000 // 24 hours expiration
  });
  ```
* **CSRF Protection & Browser Cookie Mechanics:** The browser automatically handles storing and attaching the `token` cookie to same-origin requests. By setting `SameSite: 'strict'`, cross-site requests (such as malicious third-party links or phishing forms) will not transmit the session cookie, eliminating CSRF vulnerabilities without requiring manual CSRF token state synchronization.
* **Client Storage Rule:** In compliance with security requirements, client applications **must never store the JWT in `localStorage` or `sessionStorage`**. Browser storage may only be used for non-sensitive presentation preferences or cached user display details—never for tokens.
* **Testing Client Support:** For headless automated testing tools (such as Postman or integration test runners), `requireAuth` middleware also checks the `Authorization: Bearer <token>` header as a secondary fallback if no cookie is present.
* **Logout Cookie Invalidation:** Logout immediately invalidates the cookie by setting `maxAge: 0`.

### 1.3 Unified JSON Response Envelope
Every endpoint returns a standardized JSON structure across all stages:

#### Success Envelope (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "message": "Human-readable confirmation message",
  "data": { ... },
  "errors": null
}
```

#### Error Envelope (`400`, `401`, `403`, `404`, `409`, `422`, `500`)
```json
{
  "success": false,
  "message": "Human-readable explanation of failure",
  "data": null,
  "errors": [
    {
      "field": "title",
      "message": "Title must be between 5 and 120 characters"
    }
  ]
}
```

### 1.4 HTTP Status Code Dictionary
* `200 OK`: Request succeeded.
* `201 Created`: Resource successfully created.
* `400 Bad Request`: Malformed syntax, invalid ObjectId format, missing mandatory JSON body, or business logic rule violation (e.g., team already full, self-removal by leader).
* `401 Unauthorized`: Authentication missing, expired, or invalid.
* `403 Forbidden`: Authenticated user lacks permission to access or modify the resource (e.g., non-leader attempting project update, non-creator/non-leader deleting task, supervisor attempting student action).
* `404 Not Found`: Target resource ID does not exist in the database.
* `409 Conflict`: Unique constraint violation or conflicting duplicate state (e.g., duplicate email address, duplicate active join request, duplicate pending supervision request).
* `422 Unprocessable Entity`: Input validation failure against schema rules or URL format.
* `500 Internal Server Error`: Unhandled server exception.

---

## 2. Stage 1: Core Authentication & Project CRUD

Stage 1 establishes student registration, login via `HttpOnly` cookies, controlled supervisor access, full project CRUD (with `PATCH` for partial metadata updates), and system health checks.

---

### 2.1 System Health Check

#### `GET /api/health`
Returns server status and timestamp. Useful for pinging backend readiness.
* **Authentication:** Public
* **Authorization:** None
* **Request Parameters:** None
* **Query Parameters:** None
* **Request Body:** None
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "ProjectForge API is healthy and operational",
    "data": {
      "status": "up",
      "timestamp": "2026-10-25T13:30:00.000Z",
      "environment": "development"
    },
    "errors": null
  }
  ```

---

### 2.2 Authentication Endpoints

#### `POST /api/auth/register` (Student Registration)
Registers a new student account. Public self-registration is strictly restricted to students.
* **Authentication:** Public
* **Authorization:** None
* **Request Body:**
  ```json
  {
    "name": "Alex Johnson",
    "email": "alex.j@university.edu",
    "password": "Password123!",
    "accountType": "student",
    "department": "Computer",
    "studentId": "CS-2024-0412",
    "semester": 6,
    "skills": ["React", "Node.js", "MongoDB"]
  }
  ```
  * `name` (String, required, 2–80 characters)
  * `email` (String, required, valid email, unique, normalized to lowercase)
  * `password` (String, required, minimum 6 characters)
  * `accountType` (String, required, must be `"student"`)
  * `department` (String, required, trimmed)
  * `studentId` (String, optional, trimmed)
  * `semester` (Number, optional, integer 1 to 8)
  * `skills` (Array of Strings, optional)
* **Success Response (`201 Created`):**
  * *Headers:* `Set-Cookie: token=<jwt>; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`
  ```json
  {
    "success": true,
    "message": "Student account registered successfully",
    "data": {
      "user": {
        "_id": "671aa1000000000000000001",
        "name": "Alex Johnson",
        "email": "alex.j@university.edu",
        "accountType": "student",
        "department": "Computer",
        "studentId": "CS-2024-0412",
        "semester": 6,
        "skills": ["React", "Node.js", "MongoDB"],
        "createdAt": "2026-10-25T13:30:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Malformed request syntax or missing required fields.
  * `403 Forbidden`: Attempted to register with `accountType: "supervisor"` (`"Supervisor accounts cannot be publicly registered. Contact administration or run database seed."`).
  * `409 Conflict`: Email already registered (MongoDB duplicate key error code 11000).
  * `422 Unprocessable Entity`: Validation failure (e.g., password $< 6$ characters, invalid semester number).

---

#### `POST /api/auth/login`
Authenticates a student or supervisor using credentials and issues an `HttpOnly` cookie.
* **Authentication:** Public
* **Authorization:** None
* **Request Body:**
  ```json
  {
    "email": "alex.j@university.edu",
    "password": "Password123!"
  }
  ```
* **Success Response (`200 OK`):**
  * *Headers:* `Set-Cookie: token=<jwt>; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`
  ```json
  {
    "success": true,
    "message": "Authentication successful",
    "data": {
      "user": {
        "_id": "671aa1000000000000000001",
        "name": "Alex Johnson",
        "email": "alex.j@university.edu",
        "accountType": "student",
        "department": "Computer",
        "studentId": "CS-2024-0412",
        "semester": 6,
        "skills": ["React", "Node.js", "MongoDB"]
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Missing email or password.
  * `401 Unauthorized`: Invalid email or incorrect password.
  * `422 Unprocessable Entity`: Invalid email format.

---

#### `POST /api/auth/logout`
Logs out the user by clearing the `token` `HttpOnly` cookie.
* **Authentication:** Authenticated (Any)
* **Authorization:** None
* **Request Body:** None
* **Success Response (`200 OK`):**
  * *Headers:* `Set-Cookie: token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`
  ```json
  {
    "success": true,
    "message": "Logged out successfully",
    "data": null,
    "errors": null
  }
  ```
* **Error Response:**
  * `401 Unauthorized`: Missing, expired, or invalid cookie session.

---

#### `GET /api/auth/me`
Retrieves the profile of the currently logged-in user from the validated `token` cookie.
* **Authentication:** Authenticated (Any)
* **Authorization:** None
* **Request Body:** None
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Current user profile retrieved",
    "data": {
      "user": {
        "_id": "671aa1000000000000000001",
        "name": "Alex Johnson",
        "email": "alex.j@university.edu",
        "accountType": "student",
        "department": "Computer",
        "studentId": "CS-2024-0412",
        "semester": 6,
        "skills": ["React", "Node.js", "MongoDB"],
        "createdAt": "2026-10-25T13:30:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Response:**
  * `401 Unauthorized`: Missing, expired, or invalid cookie.

---

### 2.3 Project CRUD Endpoints

#### `POST /api/projects` (Create Project)
Creates a new project. The authenticated student becomes the `leader` and the first element in `members`.
* **Authentication:** Authenticated (`student` only)
* **Authorization:** Student account required.
* **Request Body:**
  ```json
  {
    "title": "Smart Campus Energy Monitor",
    "abstract": "An IoT-enabled embedded sensor system to track real-time power consumption across university laboratories and dormitories.",
    "domain": "Computer",
    "tags": ["IoT", "React", "Node.js", "Sensors"],
    "maxTeamSize": 4,
    "targetCompletionDate": "2027-05-15T00:00:00.000Z",
    "repositoryUrl": "https://github.com/alex-j/campus-energy"
  }
  ```
  * `title` (String, required, 5–120 characters)
  * `abstract` (String, required, 20–1500 characters)
  * `domain` (String, required, enum: `['Computer', 'Electrical', 'Mechanical', 'Civil', 'Biomedical', 'Multidisciplinary']`)
  * `tags` (Array of Strings, optional, default: `[]`)
  * `maxTeamSize` (Number, required, integer 2 to 6, default: 4)
  * `targetCompletionDate` (Date, required, future date)
  * `repositoryUrl` (String, optional, valid HTTP/HTTPS URL, default: `""`)
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Project created successfully",
    "data": {
      "project": {
        "_id": "671aa2000000000000000010",
        "title": "Smart Campus Energy Monitor",
        "abstract": "An IoT-enabled embedded sensor system to track real-time power consumption across university laboratories and dormitories.",
        "domain": "Computer",
        "tags": ["IoT", "React", "Node.js", "Sensors"],
        "leader": "671aa1000000000000000001",
        "members": ["671aa1000000000000000001"],
        "supervisor": null,
        "maxTeamSize": 4,
        "targetCompletionDate": "2027-05-15T00:00:00.000Z",
        "status": "proposed",
        "recruitmentStatus": "open",
        "pulseScore": 0,
        "repositoryUrl": "https://github.com/alex-j/campus-energy",
        "createdAt": "2026-10-25T13:35:00.000Z",
        "updatedAt": "2026-10-25T13:35:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Malformed JSON payload.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Logged in as `supervisor` (`"Supervisors cannot create projects."`).
  * `422 Unprocessable Entity`: Validation failure on required fields or team size out of bounds (2–6).

---

#### `GET /api/projects` (List, Search, Filter, Sort)
Lists all projects with optional keyword search, domain/status filters, and sorting.
* **Authentication:** Public
* **Authorization:** None
* **Query Parameters:**
  * `search` (String, optional, matches text in `title`, `abstract`, or `tags`)
  * `domain` (String, optional, e.g., `Computer`, `Mechanical`)
  * `status` (String, optional, enum: `proposed`, `in_progress`, `completed`)
  * `recruitment` (String, optional, enum: `open`, `closed`)
  * `sort` (String, optional, enum: `newest` (default), `oldest`, `deadline`, `pulse`)
  * `page` (Number, optional, default: 1)
  * `limit` (Number, optional, default: 10)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Projects retrieved successfully",
    "data": {
      "projects": [
        {
          "_id": "671aa2000000000000000010",
          "title": "Smart Campus Energy Monitor",
          "abstract": "An IoT-enabled embedded sensor system...",
          "domain": "Computer",
          "tags": ["IoT", "React"],
          "leader": {
            "_id": "671aa1000000000000000001",
            "name": "Alex Johnson",
            "department": "Computer"
          },
          "membersCount": 1,
          "maxTeamSize": 4,
          "supervisor": null,
          "status": "proposed",
          "recruitmentStatus": "open",
          "pulseScore": 0,
          "targetCompletionDate": "2027-05-15T00:00:00.000Z",
          "createdAt": "2026-10-25T13:35:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "total": 1,
        "pages": 1
      }
    },
    "errors": null
  }
  ```
* **Error Response:**
  * `400 Bad Request`: Invalid pagination parameters (e.g., negative page or invalid limit format).

---

#### `GET /api/projects/:id` (Get Project Details — Public vs. Private Workspace)
Retrieves project details. In compliance with privacy standards, public responses sanitize student rosters, while private workspace access is restricted to authorized project members, the leader, and the assigned supervisor.
* **Authentication:** Public (Basic view) / Authenticated (Private workspace view)
* **Authorization:** Reading public overview requires no authorization. Reading private workspace contact details requires being the Project Leader, an approved Project Member, or the Assigned Supervisor.
* **Path Parameters:**
  * `id` (String, required, valid MongoDB ObjectId)

##### 1. Public Project View (Unauthenticated Visitors & Non-Members)
Returns the public profile with sanitized roster information. Members' email addresses, student IDs, and private workspace resources are omitted to protect student privacy:
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Public project details retrieved successfully",
    "data": {
      "project": {
        "_id": "671aa2000000000000000010",
        "title": "Smart Campus Energy Monitor",
        "abstract": "An IoT-enabled embedded sensor system to track real-time power consumption across university laboratories and dormitories.",
        "domain": "Computer",
        "tags": ["IoT", "React", "Node.js", "Sensors"],
        "leader": {
          "_id": "671aa1000000000000000001",
          "name": "Alex Johnson",
          "department": "Computer"
        },
        "members": [
          {
            "_id": "671aa1000000000000000001",
            "name": "Alex Johnson",
            "department": "Computer",
            "skills": ["React", "Node.js"]
          }
        ],
        "supervisor": null,
        "maxTeamSize": 4,
        "targetCompletionDate": "2027-05-15T00:00:00.000Z",
        "status": "proposed",
        "recruitmentStatus": "open",
        "pulseScore": 0,
        "createdAt": "2026-10-25T13:35:00.000Z",
        "updatedAt": "2026-10-25T13:35:00.000Z"
      }
    },
    "errors": null
  }
  ```

##### 2. Private Workspace View (Authorized Leader, Members, and Assigned Supervisor)
When called by an authenticated and authorized user (Project Leader, approved Project Member, or Assigned Faculty Supervisor), returns the full workspace details including contact info:
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Project workspace details retrieved successfully",
    "data": {
      "project": {
        "_id": "671aa2000000000000000010",
        "title": "Smart Campus Energy Monitor",
        "abstract": "An IoT-enabled embedded sensor system to track real-time power consumption across university laboratories and dormitories.",
        "domain": "Computer",
        "tags": ["IoT", "React", "Node.js", "Sensors"],
        "leader": {
          "_id": "671aa1000000000000000001",
          "name": "Alex Johnson",
          "email": "alex.j@university.edu",
          "department": "Computer",
          "studentId": "CS-2024-0412"
        },
        "members": [
          {
            "_id": "671aa1000000000000000001",
            "name": "Alex Johnson",
            "email": "alex.j@university.edu",
            "department": "Computer",
            "studentId": "CS-2024-0412",
            "skills": ["React", "Node.js"]
          }
        ],
        "supervisor": null,
        "maxTeamSize": 4,
        "targetCompletionDate": "2027-05-15T00:00:00.000Z",
        "status": "proposed",
        "recruitmentStatus": "open",
        "pulseScore": 0,
        "repositoryUrl": "https://github.com/alex-j/campus-energy",
        "createdAt": "2026-10-25T13:35:00.000Z",
        "updatedAt": "2026-10-25T13:35:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `404 Not Found`: Project not found.

---

#### `PATCH /api/projects/:id` (Update Project Metadata)
Performs partial updates on project metadata. Standardized to `PATCH` to reflect partial resource updates. Only the verified **Project Leader** is authorized.
* **Authentication:** Authenticated (`student` only)
* **Authorization:** Requesters must be the Project Leader (`project.leader === req.user._id`).
* **Path Parameters:**
  * `id` (String, required, valid MongoDB ObjectId)
* **Protected Fields Rule:** Metadata updates cannot modify `leader`, `members`, `supervisor`, or `pulseScore`. The backend ignores or rejects these fields if passed.
* **Permitted Request Body Fields:**
  ```json
  {
    "title": "Smart Campus Energy Monitor (Updated)",
    "abstract": "An updated detailed abstract reflecting semester 6 hardware adjustments...",
    "domain": "Computer",
    "tags": ["IoT", "Embedded", "React"],
    "maxTeamSize": 5,
    "targetCompletionDate": "2027-06-01T00:00:00.000Z",
    "status": "in_progress",
    "repositoryUrl": "https://github.com/alex-j/campus-energy-v2"
  }
  ```
  * `maxTeamSize` cannot be set lower than the current `members.length`.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Project updated successfully",
    "data": {
      "project": {
        "_id": "671aa2000000000000000010",
        "title": "Smart Campus Energy Monitor (Updated)",
        "abstract": "An updated detailed abstract reflecting semester 6 hardware adjustments...",
        "domain": "Computer",
        "tags": ["IoT", "Embedded", "React"],
        "leader": "671aa1000000000000000001",
        "members": ["671aa1000000000000000001"],
        "supervisor": null,
        "maxTeamSize": 5,
        "targetCompletionDate": "2027-06-01T00:00:00.000Z",
        "status": "in_progress",
        "recruitmentStatus": "open",
        "pulseScore": 0,
        "repositoryUrl": "https://github.com/alex-j/campus-energy-v2",
        "updatedAt": "2026-10-25T13:40:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Authenticated user is not the Project Leader.
  * `404 Not Found`: Project does not exist.
  * `422 Unprocessable Entity`: Validation failure on updated fields or `maxTeamSize < members.length`.

---

#### `DELETE /api/projects/:id` (Delete Project)
Permanently deletes a project.
* **Authentication:** Authenticated (`student` only)
* **Authorization:** Project Leader exclusively (`project.leader === req.user._id`).
* **Path Parameters:**
  * `id` (String, required, valid MongoDB ObjectId)
* **Request Body:** None
* **Staged Deletion Behavior:**
  * **In Stage 1:** Because only `User` and `Project` collections exist, the controller performs a direct document deletion:
    ```javascript
    await Project.findByIdAndDelete(req.params.id);
    ```
    No cascading or child collection deletion is required in Stage 1.
  * **In Later Stages (Stage 2 & Stage 3):** As specified in `docs/DATA_MODEL.md` Section 4.2, once child collections (`Task`, `MembershipRequest`, `SupervisionRequest`, `DocumentLink`, `DiscussionComment`, `Submission`) exist, the controller safely deletes child records **before** deleting the parent `Project` document:
    ```javascript
    // Stage 2/3 child cleanup sequence:
    await Promise.all([
      Task.deleteMany({ project: id }),
      MembershipRequest.deleteMany({ project: id }),
      SupervisionRequest.deleteMany({ project: id }),
      DocumentLink.deleteMany({ project: id }),
      DiscussionComment.deleteMany({ project: id }),
      Submission.deleteMany({ project: id })
    ]);
    await Project.findByIdAndDelete(id);
    ```
    This prevents orphaned records and ensures that if child deletion partially fails, the project document remains intact so the request can be retried safely.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Project deleted successfully",
    "data": null,
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Authenticated user is not the Project Leader.
  * `404 Not Found`: Project not found.

---

## 3. Stage 2: Team Collaboration

Stage 2 introduces team recruitment, member rosters, task management, and the automated **Project Pulse** health metric.

---

### 3.1 Team Membership Requests

#### `POST /api/projects/:projectId/join-requests` (Apply to Join Project)
Allows a student to apply to an open project team.
* **Authentication:** Authenticated (`student` only)
* **Authorization:** Any student who is not already a member and has no existing `pending` request.
* **Path Parameters:**
  * `projectId` (String, required, MongoDB ObjectId)
* **Validation Rules:**
  * Student cannot request to join their own project (`studentId === project.leader`).
  * Student cannot request if already in `project.members`.
  * Student cannot submit if they already have an active `pending` request for this project.
  * Project `recruitmentStatus` must be `'open'`.
  * `project.members.length` must be less than `project.maxTeamSize`.
* **Request Body:**
  ```json
  {
    "statement": "I have completed coursework in Embedded C and have experience interfacing DHT11 sensors."
  }
  ```
  * `statement` (String, required, 10–300 characters)
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Join request submitted successfully",
    "data": {
      "request": {
        "_id": "671aa3000000000000000020",
        "project": "671aa2000000000000000010",
        "student": "671aa1000000000000000002",
        "statement": "I have completed coursework in Embedded C and have experience interfacing DHT11 sensors.",
        "status": "pending",
        "createdAt": "2026-10-25T13:45:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format, team is full (`members.length >= maxTeamSize`), project is closed, or user is project leader.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Authenticated user is a supervisor.
  * `404 Not Found`: Project not found.
  * `409 Conflict`: User is already a team member or has a pending request for this project.
  * `422 Unprocessable Entity`: Statement validation failure (under 10 or over 300 characters).

---

#### `GET /api/projects/:projectId/join-requests` (List Join Requests)
Lists all join requests submitted for a project.
* **Authentication:** Authenticated (`student` only)
* **Authorization:** **Project Leader only** (`project.leader === req.user._id`).
* **Path Parameters:**
  * `projectId` (String, required, valid MongoDB ObjectId)
* **Query Parameters:**
  * `status` (String, optional, enum: `pending`, `approved`, `rejected`, `cancelled`, default: `pending`)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Join requests retrieved successfully",
    "data": {
      "requests": [
        {
          "_id": "671aa3000000000000000020",
          "student": {
            "_id": "671aa1000000000000000002",
            "name": "Maria Garcia",
            "email": "maria.g@university.edu",
            "department": "Electrical",
            "skills": ["Embedded C", "Circuit Design"],
            "semester": 6
          },
          "statement": "I have completed coursework in Embedded C and have experience interfacing DHT11 sensors.",
          "status": "pending",
          "createdAt": "2026-10-25T13:45:00.000Z"
        }
      ]
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is not the Project Leader.
  * `404 Not Found`: Project not found.

---

#### `PATCH /api/membership-requests/:requestId/approve` (Approve Join Request)
Approves a pending join request. Appends the student to `project.members`.
* **Authentication:** Authenticated (`student` only)
* **Authorization:** **Project Leader of the parent project exclusively**.
* **Path Parameters:**
  * `requestId` (String, required, MongoDB ObjectId)
* **Validation & Business Rules:**
  * Request must exist and have `status: 'pending'`.
  * Team must not be full: verifies `project.members.length < project.maxTeamSize`.
  * **Recruitment Auto-Closure:** If adding this member causes `project.members.length === project.maxTeamSize`, the backend automatically sets `project.recruitmentStatus = 'closed'`.
* **Request Body:** None
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Membership request approved; member added to team",
    "data": {
      "requestId": "671aa3000000000000000020",
      "status": "approved",
      "project": {
        "_id": "671aa2000000000000000010",
        "membersCount": 2,
        "maxTeamSize": 4,
        "recruitmentStatus": "open"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format, request is not in `pending` status, or team has reached `maxTeamSize`.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: User is not the Project Leader.
  * `404 Not Found`: Request not found.

---

#### `PATCH /api/membership-requests/:requestId/reject` (Reject Join Request)
Rejects a pending join request.
* **Authentication:** Authenticated (`student` only)
* **Authorization:** Project Leader only.
* **Path Parameters:**
  * `requestId` (String, required, valid MongoDB ObjectId)
* **Request Body:** None
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Membership request rejected",
    "data": {
      "requestId": "671aa3000000000000000020",
      "status": "rejected"
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format or request is not in `pending` status.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: User is not the Project Leader.
  * `404 Not Found`: Request not found.

---

#### `PATCH /api/membership-requests/:requestId/cancel` (Cancel Join Request)
Allows an applicant student to withdraw their own pending join request before the leader reviews it.
* **Authentication:** Authenticated (`student` only)
* **Authorization:** The applicant student who submitted the request (`request.student === req.user._id`).
* **Path Parameters:**
  * `requestId` (String, required, valid MongoDB ObjectId)
* **Validation Rules:**
  * Request must be in `pending` status.
* **Request Body:** None
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Join request cancelled",
    "data": {
      "requestId": "671aa3000000000000000020",
      "status": "cancelled"
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format or request is not in `pending` status.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is not the applicant student who submitted the request.
  * `404 Not Found`: Request not found.

---

#### `DELETE /api/projects/:projectId/members/:userId` (Remove Team Member)
Removes an accepted student member from the project roster.
* **Authentication:** Authenticated (`student` only)
* **Authorization:** **Project Leader exclusively**.
* **Path Parameters:**
  * `projectId` (String, required)
  * `userId` (String, required, ID of member to remove)
* **Validation & Business Rules:**
  * Leader cannot remove themselves (`userId !== project.leader.toString()`).
  * The target user must be present in `project.members`.
  * **Recruitment Re-Opening:** If `project.recruitmentStatus === 'closed'` and removing a member brings `members.length < maxTeamSize`, recruitment automatically reopens (`project.recruitmentStatus = 'open'`).
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Member removed from project roster",
    "data": {
      "removedUserId": "671aa1000000000000000002",
      "membersCount": 1,
      "recruitmentStatus": "open"
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Leader attempted to remove themselves (`"Leader cannot be removed from project."`).
  * `403 Forbidden`: Requester is not the Project Leader.
  * `404 Not Found`: User is not an active member of this project.

---

### 3.2 Tasks & Deadlines

#### `POST /api/projects/:projectId/tasks` (Create Task)
Creates an actionable task linked to the project. Automatically sets `createdBy = req.user._id` and triggers backend recalculation of `project.pulseScore`.
* **Authentication:** Authenticated
* **Authorization:** Project Leader or approved Project Member (`project.members.includes(req.user._id)`).
* **Path Parameters:**
  * `projectId` (String, required, valid MongoDB ObjectId)
* **Request Body:**
  ```json
  {
    "title": "Configure ESP32 Firmware",
    "description": "Flash ESP32 microcontroller with FreeRTOS and establish MQTT broker handshake.",
    "assignedTo": "671aa1000000000000000002",
    "dueDate": "2026-11-15T00:00:00.000Z",
    "priority": "high"
  }
  ```
  * `title` (String, required, 2–100 characters)
  * `description` (String, optional, max 500 characters)
  * `assignedTo` (ObjectId, optional, **must belong to `project.members` if provided**)
  * `dueDate` (Date, required)
  * `priority` (String, optional, enum: `low`, `medium`, `high`, default: `medium`)
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Task created successfully",
    "data": {
      "task": {
        "_id": "671aa4000000000000000030",
        "project": "671aa2000000000000000010",
        "title": "Configure ESP32 Firmware",
        "description": "Flash ESP32 microcontroller with FreeRTOS and establish MQTT broker handshake.",
        "assignedTo": "671aa1000000000000000002",
        "createdBy": "671aa1000000000000000001",
        "dueDate": "2026-11-15T00:00:00.000Z",
        "priority": "high",
        "status": "todo",
        "completedAt": null,
        "createdAt": "2026-10-25T13:50:00.000Z"
      },
      "updatedPulseScore": 0
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format or `assignedTo` user is not a member of the project team.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: User is not a project member or leader.
  * `404 Not Found`: Project not found.
  * `422 Unprocessable Entity`: Missing `title`, invalid `dueDate`, or priority enum mismatch.

---

#### `GET /api/projects/:projectId/tasks` (List Tasks)
Retrieves all tasks for a project.
* **Authentication:** Authenticated
* **Authorization:** Project Leader, Project Members, or Assigned Supervisor.
* **Path Parameters:**
  * `projectId` (String, required, valid MongoDB ObjectId)
* **Query Parameters:**
  * `status` (String, optional, enum: `todo`, `in_progress`, `done`)
  * `assignedTo` (String, optional, User ID)
  * `priority` (String, optional, enum: `low`, `medium`, `high`)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Tasks retrieved successfully",
    "data": {
      "tasks": [
        {
          "_id": "671aa4000000000000000030",
          "title": "Configure ESP32 Firmware",
          "description": "Flash ESP32 microcontroller...",
          "assignedTo": {
            "_id": "671aa1000000000000000002",
            "name": "Maria Garcia",
            "email": "maria.g@university.edu"
          },
          "createdBy": "671aa1000000000000000001",
          "dueDate": "2026-11-15T00:00:00.000Z",
          "priority": "high",
          "status": "todo",
          "completedAt": null
        }
      ]
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is not a project member, leader, or assigned supervisor.
  * `404 Not Found`: Project not found.

---

#### `PATCH /api/tasks/:taskId` (Update Task / Status)
Updates task details or transitions progress status. Automatically recalculates `project.pulseScore`.
* **Authentication:** Authenticated
* **Authorization:** Project Leader or Project Members.
* **Path Parameters:**
  * `taskId` (String, required, MongoDB ObjectId)
* **Validation & Status Transition Rules:**
  * `assignedTo`: If updated, must belong to `project.members` or be `null`.
  * If `status` transitions to `'done'`, the backend stamps `completedAt = new Date()`.
  * If `status` moves out of `'done'` back to `'todo'` or `'in_progress'`, `completedAt` is reset to `null`.
  * Backend calls `recalculatePulse(projectId)` and saves the updated score on the `Project` document.
* **Request Body (Partial Update):**
  ```json
  {
    "status": "done"
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Task updated successfully",
    "data": {
      "task": {
        "_id": "671aa4000000000000000030",
        "title": "Configure ESP32 Firmware",
        "status": "done",
        "completedAt": "2026-10-25T13:55:00.000Z"
      },
      "updatedPulseScore": 100
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format or assigned user is not a project member.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is not a project member or leader.
  * `404 Not Found`: Task not found.
  * `422 Unprocessable Entity`: Validation failure on updated fields or enum values.

---

#### `DELETE /api/tasks/:taskId` (Delete Task)
Removes a task. Automatically triggers recalculation of `project.pulseScore`.
* **Authentication:** Authenticated
* **Authorization:** Task creator (`task.createdBy.equals(req.user._id)`) or Project Leader (`project.leader.equals(req.user._id)`).
* **Path Parameters:**
  * `taskId` (String, required, valid MongoDB ObjectId)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Task deleted successfully",
    "data": {
      "deletedTaskId": "671aa4000000000000000030",
      "updatedPulseScore": 0
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is neither the task creator nor the Project Leader.
  * `404 Not Found`: Task not found.

---

### 3.3 Project Pulse Endpoint

#### `GET /api/projects/:projectId/pulse` (Retrieve Pulse Breakdown)
Returns the live calculation breakdown of the project's health metric based strictly on real task data.
* **Authentication:** Authenticated (Any)
* **Authorization:** None.
* **Path Parameters:**
  * `projectId` (String, required)
* **Mathematical Calculation:**
  $$\text{Completion Rate} = \frac{\text{Completed Tasks}}{\text{Total Tasks}} \times 100$$
  $$\text{Overdue Penalty} = \text{Overdue Incomplete Tasks} \times 10$$
  $$\text{Project Pulse} = \max\left(0, \min\left(100, \operatorname{round}(\text{Completion Rate} - \text{Overdue Penalty})\right)\right)$$
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Project pulse retrieved successfully",
    "data": {
      "pulseScore": 80,
      "statusLabel": "On Track",
      "badgeColor": "green",
      "metrics": {
        "totalTasks": 5,
        "completedTasks": 4,
        "completionRate": 80,
        "overdueIncompleteTasks": 0,
        "overduePenalty": 0
      },
      "explanation": "Calculated as max(0, min(100, round(completionRate - overduePenalty)))"
    },
    "errors": null
  }
  ```
* **Edge Case Response (0 Tasks):**
  ```json
  {
    "success": true,
    "message": "Project pulse retrieved successfully",
    "data": {
      "pulseScore": 0,
      "statusLabel": "No Tasks Yet",
      "badgeColor": "gray",
      "metrics": {
        "totalTasks": 0,
        "completedTasks": 0,
        "completionRate": 0,
        "overdueIncompleteTasks": 0,
        "overduePenalty": 0
      },
      "explanation": "No tasks created yet. Create tasks with deadlines to track Project Pulse."
    },
    "errors": null
  }
  ```
* **Edge Case Response (Tasks Present with Score of Zero):**
  ```json
  {
    "success": true,
    "message": "Project pulse retrieved successfully",
    "data": {
      "pulseScore": 0,
      "statusLabel": "At Risk",
      "badgeColor": "red",
      "metrics": {
        "totalTasks": 4,
        "completedTasks": 0,
        "completionRate": 0,
        "overdueIncompleteTasks": 2,
        "overduePenalty": 20
      },
      "explanation": "Calculated as max(0, min(100, round(completionRate - overduePenalty))). Score is 0% with active tasks present."
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `404 Not Found`: Project not found.

---

## 4. Stage 3: Supervision & Communication

Stage 3 completes the academic mentorship workflow with supervisor discovery, supervision requests, external resource sharing, discussion comments, and deliverable reviews.

---

### 4.1 Supervisor Directory

#### `GET /api/supervisors` (List & Search Supervisors)
Lists faculty supervisors available for project mentorship.
* **Authentication:** Authenticated (Any)
* **Authorization:** None.
* **Query Parameters:**
  * `search` (String, optional, matches name or research interests)
  * `department` (String, optional)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Supervisors retrieved successfully",
    "data": {
      "supervisors": [
        {
          "_id": "671aa5000000000000000050",
          "name": "Dr. Sarah Chen",
          "email": "sarah.chen@university.edu",
          "department": "Computer",
          "designation": "Associate Professor",
          "researchInterests": ["Embedded Systems", "IoT", "Edge AI"],
          "officeLocation": "Tech Tower Lab 402",
          "maxCapacity": 5,
          "activeProjectsCount": 2,
          "isAvailable": true
        }
      ]
    },
    "errors": null
  }
  ```
* **Error Response:**
  * `401 Unauthorized`: Not logged in.

---

#### `GET /api/supervisors/:id` (Get Supervisor Profile)
Returns detailed supervisor profile and active project workload.
* **Authentication:** Authenticated (Any)
* **Authorization:** None.
* **Path Parameters:**
  * `id` (String, required, valid MongoDB ObjectId)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Supervisor profile retrieved",
    "data": {
      "supervisor": {
        "_id": "671aa5000000000000000050",
        "name": "Dr. Sarah Chen",
        "email": "sarah.chen@university.edu",
        "department": "Computer",
        "designation": "Associate Professor",
        "researchInterests": ["Embedded Systems", "IoT", "Edge AI"],
        "officeLocation": "Tech Tower Lab 402",
        "maxCapacity": 5,
        "activeProjectsCount": 2
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `404 Not Found`: Supervisor not found.

---

### 4.2 Supervision Requests

#### `POST /api/projects/:projectId/supervision-requests` (Send Supervision Request)
Allows the Project Leader to invite a faculty supervisor to advise the project.
* **Authentication:** Authenticated (`student` only)
* **Authorization:** **Project Leader only** (`project.leader === req.user._id`).
* **Validation & Business Rules:**
  * Project must not already have an assigned supervisor (`project.supervisor === null`).
  * Project may only have **one pending supervision request at a time** (enforces single active request constraint).
  * Target supervisor must exist and have `accountType: 'supervisor'`.
* **Path Parameters:**
  * `projectId` (String, required, valid MongoDB ObjectId)
* **Request Body:**
  ```json
  {
    "supervisorId": "671aa5000000000000000050",
    "proposalMessage": "Our project focuses on IoT sensor nodes for campus power monitoring. We would appreciate your guidance on low-power mesh networking."
  }
  ```
  * `supervisorId` (ObjectId, required)
  * `proposalMessage` (String, required, 20–1000 characters)
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Supervision request submitted to faculty supervisor",
    "data": {
      "request": {
        "_id": "671aa6000000000000000060",
        "project": "671aa2000000000000000010",
        "supervisor": "671aa5000000000000000050",
        "proposalMessage": "Our project focuses on IoT sensor nodes...",
        "status": "pending",
        "feedback": null,
        "createdAt": "2026-10-25T14:00:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format, project already has an assigned supervisor, or invalid supervisor ID.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is not the Project Leader.
  * `404 Not Found`: Project or supervisor not found.
  * `409 Conflict`: Project already has an active `pending` supervision request.
  * `422 Unprocessable Entity`: Validation failure on `proposalMessage` length.

---

#### `GET /api/supervisors/my-requests` (List Incoming Supervision Requests)
Lists pending and historical supervision proposals sent to the logged-in supervisor.
* **Authentication:** Authenticated (`supervisor` only)
* **Authorization:** Supervisor account required.
* **Query Parameters:**
  * `status` (String, optional, enum: `pending`, `accepted`, `declined`, default: `pending`)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Supervision requests retrieved",
    "data": {
      "requests": [
        {
          "_id": "671aa6000000000000000060",
          "project": {
            "_id": "671aa2000000000000000010",
            "title": "Smart Campus Energy Monitor",
            "abstract": "An IoT-enabled embedded sensor system...",
            "domain": "Computer",
            "leader": {
              "name": "Alex Johnson",
              "email": "alex.j@university.edu"
            }
          },
          "proposalMessage": "Our project focuses on IoT sensor nodes...",
          "status": "pending",
          "createdAt": "2026-10-25T14:00:00.000Z"
        }
      ]
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Authenticated user is not a supervisor.

---

#### `PATCH /api/supervision-requests/:requestId/accept` (Accept Supervision Request)
Accepts a supervision request and links the project to the supervisor.
* **Authentication:** Authenticated (`supervisor` only)
* **Authorization:** **Targeted supervisor exclusively** (`request.supervisor === req.user._id`).
* **Path Parameters:**
  * `requestId` (String, required, valid MongoDB ObjectId)
* **Validation & Business Rules:**
  * Request must exist and have `status: 'pending'`.
  * **Capacity Guard:** Checks that supervisor's current active project load is less than their `maxCapacity`. Returns HTTP 400 if capacity is exceeded.
  * Updates request `status = 'accepted'` and `reviewedAt = new Date()`.
  * Sets `project.supervisor = supervisorId`.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Supervision request accepted. Project linked to supervisor.",
    "data": {
      "requestId": "671aa6000000000000000060",
      "status": "accepted",
      "projectId": "671aa2000000000000000010",
      "assignedSupervisor": "671aa5000000000000000050"
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format, request is not `pending`, or supervisor has reached `maxCapacity`.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Logged-in supervisor is not the recipient of this request.
  * `404 Not Found`: Request not found.

---

#### `PATCH /api/supervision-requests/:requestId/decline` (Decline Supervision Request)
Declines a supervision request with optional feedback notes.
* **Authentication:** Authenticated (`supervisor` only)
* **Authorization:** Targeted supervisor exclusively.
* **Path Parameters:**
  * `requestId` (String, required, valid MongoDB ObjectId)
* **Request Body:**
  ```json
  {
    "feedback": "My project advising capacity is currently full for the IoT domain this semester."
  }
  ```
  * `feedback` (String, optional, max 500 characters)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Supervision request declined",
    "data": {
      "requestId": "671aa6000000000000000060",
      "status": "declined",
      "feedback": "My project advising capacity is currently full for the IoT domain this semester."
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format or request is not `pending`.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Logged-in supervisor is not the recipient of this request.
  * `404 Not Found`: Request not found.
  * `422 Unprocessable Entity`: Feedback string exceeds 500 characters.

---

### 4.3 Discussion Comments

#### `POST /api/projects/:projectId/comments` (Post Comment)
Adds a message to the project discussion feed.
* **Authentication:** Authenticated
* **Authorization:** Project Leader, Project Members, or Assigned Supervisor.
* **Path Parameters:**
  * `projectId` (String, required, valid MongoDB ObjectId)
* **Request Body:**
  ```json
  {
    "content": "Meeting scheduled for Thursday at 2:00 PM in Lab 4 to test ADC calibration.",
    "isPinned": false
  }
  ```
  * `content` (String, required, 1–2000 characters)
  * `isPinned` (Boolean, optional, default: `false`; only Leader or Supervisor can toggle `true`)
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Comment posted successfully",
    "data": {
      "comment": {
        "_id": "671aa7000000000000000070",
        "project": "671aa2000000000000000010",
        "author": {
          "_id": "671aa1000000000000000001",
          "name": "Alex Johnson",
          "accountType": "student"
        },
        "content": "Meeting scheduled for Thursday at 2:00 PM in Lab 4 to test ADC calibration.",
        "isPinned": false,
        "createdAt": "2026-10-25T14:10:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is not a project member, leader, or assigned supervisor.
  * `404 Not Found`: Project not found.
  * `422 Unprocessable Entity`: Missing `content` or content exceeds 2000 characters.

---

#### `GET /api/projects/:projectId/comments` (List Comments)
Returns all discussion comments for a project, with pinned comments sorted to the top.
* **Authentication:** Authenticated
* **Authorization:** Project Leader, Project Members, or Assigned Supervisor.
* **Path Parameters:**
  * `projectId` (String, required, valid MongoDB ObjectId)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Comments retrieved successfully",
    "data": {
      "comments": [
        {
          "_id": "671aa7000000000000000070",
          "author": {
            "_id": "671aa1000000000000000001",
            "name": "Alex Johnson",
            "accountType": "student"
          },
          "content": "Meeting scheduled for Thursday...",
          "isPinned": false,
          "createdAt": "2026-10-25T14:10:00.000Z"
        }
      ]
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is not a project member, leader, or assigned supervisor.
  * `404 Not Found`: Project not found.

---

#### `DELETE /api/comments/:commentId` (Delete Comment)
Deletes a comment.
* **Authentication:** Authenticated
* **Authorization:** Comment author or Project Leader.
* **Path Parameters:**
  * `commentId` (String, required, valid MongoDB ObjectId)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Comment deleted",
    "data": {
      "deletedCommentId": "671aa7000000000000000070"
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is neither the author of the comment nor the Project Leader.
  * `404 Not Found`: Comment not found.

---

### 4.4 Validated External Document Links

#### `POST /api/projects/:projectId/documents` (Add Document Link)
Stores an external document resource link (Google Drive, GitHub, Overleaf, Figma). **No file uploads are accepted.**
* **Authentication:** Authenticated
* **Authorization:** Project Leader or Project Members.
* **Path Parameters:**
  * `projectId` (String, required, valid MongoDB ObjectId)
* **Request Body:**
  ```json
  {
    "title": "System Architecture & Circuit Schematic",
    "url": "https://drive.google.com/file/d/1a2b3c4d5e/view",
    "category": "design_diagram",
    "description": "Eagle schematic and pinout diagram for ESP32 and INA219 current sensors."
  }
  ```
  * `title` (String, required, 2–100 characters)
  * `url` (String, required, must begin with `http://` or `https://`)
  * `category` (String, required, enum: `['specification', 'code_repository', 'design_diagram', 'report', 'presentation', 'other']`)
  * `description` (String, optional, max 300 characters)
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Document resource link added successfully",
    "data": {
      "document": {
        "_id": "671aa8000000000000000080",
        "project": "671aa2000000000000000010",
        "title": "System Architecture & Circuit Schematic",
        "url": "https://drive.google.com/file/d/1a2b3c4d5e/view",
        "category": "design_diagram",
        "description": "Eagle schematic and pinout diagram for ESP32 and INA219 current sensors.",
        "addedBy": "671aa1000000000000000001",
        "createdAt": "2026-10-25T14:15:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is not a project member or leader.
  * `404 Not Found`: Project not found.
  * `422 Unprocessable Entity`: Invalid URL format (e.g., `javascript:`, malformed string) or invalid category enum.

---

#### `GET /api/projects/:projectId/documents` (List Document Links)
Retrieves all external resource links for a project.
* **Authentication:** Authenticated
* **Authorization:** Team members, Leader, or Assigned Supervisor.
* **Path Parameters:**
  * `projectId` (String, required, valid MongoDB ObjectId)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Document links retrieved successfully",
    "data": {
      "documents": [
        {
          "_id": "671aa8000000000000000080",
          "title": "System Architecture & Circuit Schematic",
          "url": "https://drive.google.com/file/d/1a2b3c4d5e/view",
          "category": "design_diagram",
          "description": "Eagle schematic...",
          "addedBy": {
            "_id": "671aa1000000000000000001",
            "name": "Alex Johnson"
          },
          "createdAt": "2026-10-25T14:15:00.000Z"
        }
      ]
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is not a team member, leader, or assigned supervisor.
  * `404 Not Found`: Project not found.

---

#### `PATCH /api/documents/:documentId` (Update Document Link)
Updates an existing external document link. Only the original contributor or the Project Leader is authorized.
* **Authentication:** Authenticated
* **Authorization:** Contributor who added the link (`document.addedBy.equals(req.user._id)`) or Project Leader (`project.leader.equals(req.user._id)`).
* **Path Parameters:**
  * `documentId` (String, required, valid MongoDB ObjectId)
* **Permitted Request Body Fields:**
  ```json
  {
    "title": "System Architecture & Circuit Schematic (v2)",
    "url": "https://drive.google.com/file/d/1a2b3c4d5e_updated/view",
    "category": "design_diagram",
    "description": "Updated Eagle schematic and pinout diagram with INA219 shunt calibration."
  }
  ```
  * `title` (String, optional, 2–100 characters)
  * `url` (String, optional, must begin with `http://` or `https://`)
  * `category` (String, optional, enum: `['specification', 'code_repository', 'design_diagram', 'report', 'presentation', 'other']`)
  * `description` (String, optional, max 300 characters)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Document resource link updated successfully",
    "data": {
      "document": {
        "_id": "671aa8000000000000000080",
        "project": "671aa2000000000000000010",
        "title": "System Architecture & Circuit Schematic (v2)",
        "url": "https://drive.google.com/file/d/1a2b3c4d5e_updated/view",
        "category": "design_diagram",
        "description": "Updated Eagle schematic and pinout diagram with INA219 shunt calibration.",
        "addedBy": "671aa1000000000000000001",
        "createdAt": "2026-10-25T14:15:00.000Z",
        "updatedAt": "2026-10-25T14:20:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is neither the contributor who added the link nor the Project Leader.
  * `404 Not Found`: Document resource not found.
  * `422 Unprocessable Entity`: Invalid URL format (e.g., `javascript:`, malformed string) or invalid category enum.

---

#### `DELETE /api/documents/:documentId` (Remove Document Link)
Removes an external document reference.
* **Authentication:** Authenticated
* **Authorization:** Contributor who added the link (`document.addedBy.equals(req.user._id)`) or Project Leader (`project.leader.equals(req.user._id)`).
* **Path Parameters:**
  * `documentId` (String, required, valid MongoDB ObjectId)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Document link removed",
    "data": {
      "deletedDocumentId": "671aa8000000000000000080"
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is neither the contributor who added the link nor the Project Leader.
  * `404 Not Found`: Document link not found.

---

### 4.5 Deliverable Submissions & Supervisor Review

#### `POST /api/projects/:projectId/submissions` (Create Submission)
Allows the Project Leader to submit a formal deliverable for supervisor evaluation.
* **Authentication:** Authenticated (`student` only)
* **Authorization:** **Project Leader only** (`project.leader === req.user._id`).
* **Validation & Business Rules:**
  * Project must have an assigned supervisor (`project.supervisor !== null`).
  * `deliverableUrl` must start with `http://` or `https://`.
* **Path Parameters:**
  * `projectId` (String, required, valid MongoDB ObjectId)
* **Request Body:**
  ```json
  {
    "title": "Interim Progress Report & Hardware Prototype Demo",
    "deliverableUrl": "https://docs.google.com/document/d/1XyZ987/edit?usp=sharing",
    "notes": "Includes complete circuit schematics, bill of materials, and YouTube link to power test demo."
  }
  ```
  * `title` (String, required, 2–120 characters)
  * `deliverableUrl` (String, required, valid HTTP/HTTPS URL)
  * `notes` (String, optional, max 800 characters)
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Deliverable submitted for supervisor review",
    "data": {
      "submission": {
        "_id": "671aa9000000000000000090",
        "project": "671aa2000000000000000010",
        "title": "Interim Progress Report & Hardware Prototype Demo",
        "deliverableUrl": "https://docs.google.com/document/d/1XyZ987/edit?usp=sharing",
        "notes": "Includes complete circuit schematics...",
        "submittedBy": "671aa1000000000000000001",
        "status": "submitted",
        "supervisorFeedback": null,
        "reviewedAt": null,
        "createdAt": "2026-10-25T14:20:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format or project has no assigned supervisor to review the deliverable.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is not the Project Leader.
  * `404 Not Found`: Project not found.
  * `422 Unprocessable Entity`: Invalid URL format or title length out of bounds.

---

#### `GET /api/projects/:projectId/submissions` (List Submissions)
Lists all deliverable submissions for a project.
* **Authentication:** Authenticated
* **Authorization:** Team members, Leader, or Assigned Supervisor.
* **Path Parameters:**
  * `projectId` (String, required, valid MongoDB ObjectId)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Submissions retrieved successfully",
    "data": {
      "submissions": [
        {
          "_id": "671aa9000000000000000090",
          "title": "Interim Progress Report & Hardware Prototype Demo",
          "deliverableUrl": "https://docs.google.com/document/d/1XyZ987/edit?usp=sharing",
          "notes": "Includes complete circuit schematics...",
          "status": "submitted",
          "supervisorFeedback": null,
          "reviewedAt": null,
          "createdAt": "2026-10-25T14:20:00.000Z"
        }
      ]
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Requester is not a team member, leader, or assigned supervisor.
  * `404 Not Found`: Project not found.

---

#### `PATCH /api/submissions/:submissionId/review` (Supervisor Review & Feedback)
Allows the assigned faculty supervisor to evaluate a submission and record feedback.
* **Authentication:** Authenticated (`supervisor` only)
* **Authorization:** **Assigned Supervisor of the project exclusively** (`project.supervisor === req.user._id`).
* **Path Parameters:**
  * `submissionId` (String, required, valid MongoDB ObjectId)
* **Validation & Business Rules:**
  * Submission must exist.
  * `status` must be either `'approved'` or `'revisions_requested'`.
  * `supervisorFeedback` is required (5–1500 characters).
  * Backend sets `reviewedAt = new Date()`.
* **Request Body:**
  ```json
  {
    "status": "revisions_requested",
    "supervisorFeedback": "The hardware sensor data calibration is sound. However, Section 3.2 must include a power dissipation budget table before approval."
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Submission review recorded successfully",
    "data": {
      "submission": {
        "_id": "671aa9000000000000000090",
        "title": "Interim Progress Report & Hardware Prototype Demo",
        "status": "revisions_requested",
        "supervisorFeedback": "The hardware sensor data calibration is sound. However, Section 3.2 must include a power dissipation budget table before approval.",
        "reviewedAt": "2026-10-25T14:25:00.000Z"
      }
    },
    "errors": null
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Invalid ObjectId format or invalid status value.
  * `401 Unauthorized`: Not logged in.
  * `403 Forbidden`: Logged-in user is not the assigned supervisor of the project.
  * `404 Not Found`: Submission not found.
  * `422 Unprocessable Entity`: Missing or empty `supervisorFeedback` (length $< 5$ or $> 1500$ characters).

---

## 5. Endpoints Summary & Verification Matrix

| # | HTTP Method | Endpoint Path | Stage | Required Role | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `GET` | `/api/health` | **Stage 1** | Public | System health check |
| **2** | `POST` | `/api/auth/register` | **Stage 1** | Public | Register student account |
| **3** | `POST` | `/api/auth/login` | **Stage 1** | Public | Login & set HttpOnly cookie |
| **4** | `POST` | `/api/auth/logout` | **Stage 1** | Authenticated | Logout & clear cookie |
| **5** | `GET` | `/api/auth/me` | **Stage 1** | Authenticated | Get current user session |
| **6** | `POST` | `/api/projects` | **Stage 1** | Student | Create project |
| **7** | `GET` | `/api/projects` | **Stage 1** | Public | List, search, filter, sort projects |
| **8** | `GET` | `/api/projects/:id` | **Stage 1** | Public / Auth | Get project details (public vs private workspace) |
| **9** | `PATCH`| `/api/projects/:id` | **Stage 1** | Project Leader | Update project metadata |
| **10** | `DELETE`| `/api/projects/:id` | **Stage 1** | Project Leader | Delete project (child-before-parent) |
| **11** | `POST` | `/api/projects/:projectId/join-requests` | **Stage 2** | Student | Submit team join request |
| **12** | `GET` | `/api/projects/:projectId/join-requests` | **Stage 2** | Project Leader | List pending join requests |
| **13** | `PATCH`| `/api/membership-requests/:requestId/approve` | **Stage 2** | Project Leader | Approve request & add member |
| **14** | `PATCH`| `/api/membership-requests/:requestId/reject` | **Stage 2** | Project Leader | Reject join request |
| **15** | `PATCH`| `/api/membership-requests/:requestId/cancel` | **Stage 2** | Applicant Student | Cancel own join request |
| **16** | `DELETE`| `/api/projects/:projectId/members/:userId` | **Stage 2** | Project Leader | Remove team member |
| **17** | `POST` | `/api/projects/:projectId/tasks` | **Stage 2** | Leader / Member | Create task (stamped with createdBy) & update pulse |
| **18** | `GET` | `/api/projects/:projectId/tasks` | **Stage 2** | Team / Supervisor | List tasks for project |
| **19** | `PATCH`| `/api/tasks/:taskId` | **Stage 2** | Leader / Member | Update task & recalculate pulse |
| **20** | `DELETE`| `/api/tasks/:taskId` | **Stage 2** | Creator / Leader | Delete task & recalculate pulse |
| **21** | `GET` | `/api/projects/:projectId/pulse` | **Stage 2** | Authenticated | Get detailed Project Pulse breakdown |
| **22** | `GET` | `/api/supervisors` | **Stage 3** | Authenticated | Search supervisor directory |
| **23** | `GET` | `/api/supervisors/:id` | **Stage 3** | Authenticated | Get supervisor profile |
| **24** | `POST` | `/api/projects/:projectId/supervision-requests` | **Stage 3** | Project Leader | Send supervision proposal |
| **25** | `GET` | `/api/supervisors/my-requests` | **Stage 3** | Supervisor | List incoming supervision requests |
| **26** | `PATCH`| `/api/supervision-requests/:requestId/accept` | **Stage 3** | Target Supervisor | Accept supervision request |
| **27** | `PATCH`| `/api/supervision-requests/:requestId/decline` | **Stage 3** | Target Supervisor | Decline supervision request |
| **28** | `POST` | `/api/projects/:projectId/comments` | **Stage 3** | Team / Supervisor | Post discussion comment |
| **29** | `GET` | `/api/projects/:projectId/comments` | **Stage 3** | Team / Supervisor | List discussion comments |
| **30** | `DELETE`| `/api/comments/:commentId` | **Stage 3** | Author / Leader | Delete discussion comment |
| **31** | `POST` | `/api/projects/:projectId/documents` | **Stage 3** | Leader / Member | Add validated external link |
| **32** | `GET` | `/api/projects/:projectId/documents` | **Stage 3** | Team / Supervisor | List document resource links |
| **33** | `PATCH`| `/api/documents/:documentId` | **Stage 3** | Contributor / Leader| Edit external document link |
| **34** | `DELETE`| `/api/documents/:documentId` | **Stage 3** | Contributor / Leader| Remove document link |
| **35** | `POST` | `/api/projects/:projectId/submissions` | **Stage 3** | Project Leader | Submit deliverable for review |
| **36** | `GET` | `/api/projects/:projectId/submissions` | **Stage 3** | Team / Supervisor | List deliverable submissions |
| **37** | `PATCH`| `/api/submissions/:submissionId/review` | **Stage 3** | Assigned Supervisor | Review deliverable & leave feedback |

---

## 6. Document Consistency & Cross-Specification Verification

### 6.1 Verified Alignments Across Documentation Suite
The following structural conventions have been audited and verified across `docs/PROJECT_SPEC.md`, `docs/DATA_MODEL.md`, and `docs/API_CONTRACT.md`:

1. **Standardized Response Envelope:** All 37 endpoints strictly implement the four-key envelope `{ success, message, data, errors }`, using explicit `null` values for `data` or `errors` as appropriate.
2. **Project Update Method (`PATCH /api/projects/:id`):** Standardized exclusively on `PATCH` across all three documents. All conflicting references to `PUT` have been excised.
3. **Authentication via `HttpOnly` Cookie:** JWT transmission is standardized on the `HttpOnly` cookie named `token` (`SameSite=Strict`, `secure` in production) to mitigate XSS token theft and protect against CSRF attacks. Storing JWTs in browser `localStorage` or `sessionStorage` is forbidden across all specifications. Automated test harnesses retain an optional secondary fallback checking `Authorization: Bearer <token>`.
4. **Task Schema & Creator Authorization:** The `Task` schema includes a required `createdBy` reference to the `User` model. Creation endpoints record `createdBy`, task listings return it, and task deletion is strictly authorized for the task creator or the Project Leader (`403 Forbidden` otherwise).
5. **Project-Detail Privacy Separation:** Public project details (`GET /api/projects/:id`) omit members' email addresses, student IDs, and private contact info to protect student privacy. Private workspace views are limited strictly to authorized project members, the project leader, and the assigned faculty supervisor.
6. **Document-Link Editing Endpoint:** Added `PATCH /api/documents/:documentId` with schema validation and authorization for the original contributor or the Project Leader, ensuring consistent write/edit/delete permission symmetry.
7. **Consistent HTTP Status Codes & Error Structures:** Standardized duplicate emails and duplicate active state conflicts to `409 Conflict`, input schema validation failures to `422 Unprocessable Entity`, authorization guards to `403 Forbidden`, invalid ID formats and business rule violations to `400 Bad Request`, and missing resources to `404 Not Found`.
8. **Project Pulse & Zero-Score Behavior:** Retained the mathematical formula $\max(0, \min(100, \operatorname{round}(\text{Completion Rate} - \text{Overdue Penalty})))$. When a project has 0 tasks, its pulse is $0\%$ labeled `"No Tasks Yet"` (Gray). When a project has tasks but its calculated score is zero, its pulse is $0\%$ labeled `"At Risk"` (Red).
9. **Milestone Architecture:** Confirmed the consolidated design utilizing `Task` deadlines for operational milestones and `Submission` records for formal supervisor deliverable reviews, avoiding an extraneous `Milestone` collection.
10. **Deletion Strategy:** Retained the child-before-parent deletion order for project deletion in multi-collection stages, preventing orphaned child records on partial failure.

### 6.2 Resolution of Prior Document Discrepancies
All previous discrepancies identified between earlier drafts have been resolved:
* **`PATCH` vs `PUT`:** Fully standardized on `PATCH /api/projects/:id`.
* **Cookie vs Header Auth:** Fully standardized on the `token` `HttpOnly` session cookie with strict SameSite handling and no client-side JWT storage.
* **Milestone Entity Granularity:** Standardized on the simplified Task and Submission design across all three specifications.
