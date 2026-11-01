# ProjectForge – Engineering Project Collaboration Platform

ProjectForge is a web application developed for the EE4207 Web Application Development mini-project using the MERN stack.

The main purpose of this application is to help engineering students organize their academic projects in one place. Students can create projects, find team members, manage tasks and request guidance from academic supervisors.

The application has separate accounts for students and supervisors. Students can work as project leaders or team members, while supervisors can manage requests from student project teams.

## Live Website

**ProjectForge:** https://projectforge-tau.vercel.app

## Technologies Used

### Frontend
- React.js
- Vite
- HTML, CSS and JavaScript

### Backend
- Node.js
- Express.js

### Database
- MongoDB Atlas
- Mongoose

### Authentication
- JSON Web Tokens (JWT)
- bcryptjs for password hashing
- HttpOnly cookies

### Deployment
- Vercel – Frontend and backend
- MongoDB Atlas – Cloud database
- GitHub – Version control

## Main Features

### 1. Student Accounts
- Register and log in as a student.
- View available engineering projects.
- Search, filter and sort projects.
- Apply to join projects with available team positions.
- View projects and tasks after joining a team.

### 2. Project Leaders
- Create new engineering projects.
- View, edit and delete their own projects.
- Review and approve or reject team membership requests.
- Manage project members.
- Create tasks, assign them to members and set deadlines.
- Mark tasks as completed.
- View project progress and the Project Pulse score.
- Send supervision requests to academic supervisors.

### 3. Academic Supervisors
- Log in using a supervisor account.
- View supervision requests from project leaders.
- Accept or decline supervision requests.
- View projects under their supervision.
- Manage supervision based on their available capacity.

### 4. Project Management
ProjectForge supports Create, Read, Update and Delete (CRUD) operations for projects.

Project details are stored in MongoDB, so changes remain saved even after refreshing the page or logging in again.

The application also includes a task checklist and a Project Pulse score. Task Completion Progress shows the percentage of completed tasks, while Project Pulse also considers overdue tasks.

## User Authentication

ProjectForge uses JWT authentication for student and supervisor login. Passwords are stored using bcrypt hashing, and login sessions are maintained using HttpOnly cookies.

Students can register through the website. Supervisor accounts are created separately through an administrative script.

Access permissions are based on the user's role. For example, only a project leader can edit or delete their project.

## Project Structure

```text
ProjectForge/
├── api/                 # Vercel backend entry point
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   └── pages/
│   └── package.json
├── server/
│   ├── scripts/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   └── routes/
│   └── package.json
├── docs/
├── vercel.json
└── README.md
```

## Database

ProjectForge uses MongoDB Atlas to store application data.

The main database collections are:

- **Users:** Student and supervisor account information.
- **Projects:** Project details, leaders, members and supervisors.
- **Tasks:** Project tasks, deadlines, priorities and completion status.
- **MembershipRequests:** Requests from students who want to join projects.
- **SupervisionRequests:** Requests sent to academic supervisors.

Mongoose is used to define the database models and manage relationships between these records.

## Running the Project Locally

### 1. Clone the Repository

```bash
git clone https://github.com/sanudadaksina-coder/ProjectForge.git
cd ProjectForge
```

### 2. Install Dependencies

Run the following commands from the main project directory:

```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 3. Configure the Backend

Create a `.env` file inside the `server` directory. You can use `server/.env.example` as a guide.

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
CLIENT_ORIGIN=http://localhost:5173
```

Configure a working MongoDB connection and keep the actual credentials private.

### 4. Start the Backend

Open a terminal in the main project directory and run:

```bash
npm --prefix server run dev
```

The backend normally runs at:

http://localhost:5000

### 5. Start the Frontend

Open another terminal in the main project directory and run:

```bash
npm --prefix client run dev
```

The frontend normally runs at:

http://localhost:5173

The frontend communicates with the backend through REST API requests. The Vite development server forwards API requests to the local backend.

## Deployment

ProjectForge is deployed using Vercel and MongoDB Atlas.

- The React frontend is hosted on Vercel.
- The Express backend runs as a Vercel Serverless Function.
- MongoDB Atlas stores the application data.
- The frontend and backend use the same live website address.
- The source code is maintained on GitHub.

## Project Information

**Project Name:** ProjectForge

**Module:** EE4207 – Web Application Development

**Project Type:** Undergraduate Mini Project

**Department:** Electrical and Information Engineering

**University:** University of Ruhuna

**Technology:** MERN Stack

**Version:** 1.0

**Status:** Developed and Deployed