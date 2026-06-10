# Task Manager Web Application Workflow

## 1. Project Idea

The application is a task manager tool where users can add tasks, edit previously added tasks, mark tasks as completed, reopen completed tasks, and track progress. A task can represent daily work, future assigned work, personal goals, project activities, reminders, or any item that needs follow-up.

## 2. How To Start

### Step 1: Understand The Goal

The goal is to build a web application with a clean user interface and practical task-tracking functionality. The first version should focus on core task operations before adding advanced features like login, teams, notifications, or analytics.

### Step 2: Choose The Tech Stack

This starter project uses:

- Frontend: HTML, CSS, and JavaScript
- Backend: Node.js HTTP server
- Storage: PostgreSQL database

PostgreSQL allows shared task data to survive web-service redeployments and restarts. In Render, the app connects through a `DATABASE_URL` environment variable.

### Step 3: Build The Minimum Viable Product

The first version should include:

- Register and login
- Personal task workspace
- Shared task workspace
- Shared list access code
- Create task
- View task list
- Edit task
- Mark task as completed
- Reopen completed task
- Delete task
- Search and filter task list
- Show task progress summary

### Step 4: Run The App

Set `DATABASE_URL` to your PostgreSQL connection string, then from the project folder:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## 3. User Workflow

1. User opens the task manager dashboard.
2. User registers or logs in.
3. User lands in the personal task workspace.
4. User can add, edit, complete, reopen, delete, search, and filter personal tasks.
5. User can switch to the shared workspace.
6. User can create a shared list and copy its access code.
7. Another user can register or log in and join the shared list with the access code.
8. Any user with shared access can add, edit, complete, reopen, delete, search, and filter tasks in that shared list.
9. The backend validates the session and checks shared-list membership before returning or changing shared tasks.

## 4. Functional Requirements

Functional requirements describe what the system must do.

| ID | Requirement | Description |
| --- | --- | --- |
| FR-01 | Add Task | User can create a task with title, description, assignee, priority, and due date. |
| FR-02 | View Tasks | User can see all tasks in a readable task list. |
| FR-03 | Edit Task | User can update an existing task. |
| FR-04 | Complete Task | User can mark a task as completed. |
| FR-05 | Reopen Task | User can reopen a completed task. |
| FR-06 | Delete Task | User can remove a task. |
| FR-07 | Search Tasks | User can search tasks by title, description, or assignee. |
| FR-08 | Filter Tasks | User can filter tasks by status and priority. |
| FR-09 | Progress Summary | User can view total, completed, pending, and completion percentage. |
| FR-10 | Data Persistence | Tasks are stored in PostgreSQL and remain saved after browser refresh, service restart, or redeployment. |
| FR-11 | Validation | Task title is required before saving. |
| FR-12 | API Access | Frontend communicates with backend through REST API endpoints. |
| FR-13 | Register | New users can create an account with name, email, and password. |
| FR-14 | Login | Existing users can log in and receive a secure session cookie. |
| FR-15 | Logout | Users can end their session. |
| FR-16 | Personal Task Privacy | Personal tasks are visible only to their owner. |
| FR-17 | Shared Lists | Users can create shared task lists. |
| FR-18 | Shared Access | Users can join a shared list using an access code. |
| FR-19 | Shared Collaboration | Members of a shared list can add and complete shared tasks. |

## 5. Non-Functional Requirements

Non-functional requirements describe how well the system should work.

| ID | Requirement | Description |
| --- | --- | --- |
| NFR-01 | Usability | Interface should be simple, clear, responsive, and easy to use. |
| NFR-02 | Performance | Task operations should feel fast for normal personal or small-team usage. |
| NFR-03 | Reliability | Tasks should not disappear after page refresh or redeployment because data is saved in PostgreSQL. |
| NFR-04 | Maintainability | Code should be organized into frontend, backend, deployment configuration, and documentation areas. |
| NFR-05 | Scalability | The database-backed storage should support moving to larger hosted PostgreSQL plans later. |
| NFR-06 | Security | Backend should validate input and avoid exposing unnecessary local files. |
| NFR-07 | Accessibility | UI should support keyboard usage, visible labels, good contrast, and readable focus states. |
| NFR-08 | Responsiveness | Layout should work on desktop, tablet, and mobile screen sizes. |
| NFR-09 | Compatibility | App should run in modern browsers and Node.js 18 or newer. |
| NFR-10 | Recoverability | The backend should automatically create the required `tasks` database table when connected. |
| NFR-11 | Authentication Security | Passwords should be stored as salted slow hashes, not plaintext. |
| NFR-12 | Session Security | Sessions should use HttpOnly cookies and expire automatically. |

## 6. Task Data Model

Each task contains:

```json
{
  "id": "unique-task-id",
  "title": "Prepare project report",
  "description": "Finish the first draft and send it for review.",
  "assignee": "Kajal",
  "priority": "high",
  "dueDate": "2026-05-30",
  "completed": false,
  "createdAt": "2026-05-22T10:00:00.000Z",
  "updatedAt": "2026-05-22T10:00:00.000Z",
  "completedAt": null
}
```

Users, sessions, shared lists, and shared-list memberships are also stored in PostgreSQL.

## 7. Backend API Workflow

### Fetch All Tasks

```text
GET /api/tasks?view=personal
```

Returns personal tasks for the signed-in user.

### Fetch Shared Tasks

```text
GET /api/tasks?view=shared&sharedListId=:id
```

Returns tasks for a shared list only when the signed-in user is a member.

### Health Check

```text
GET /api/health
```

Returns database connectivity status for deployment verification.

### Create Task

```text
POST /api/tasks
```

Request body:

```json
{
  "title": "New task",
  "description": "Task details",
  "assignee": "Team member",
  "priority": "medium",
  "dueDate": "2026-06-01"
}
```

For shared tasks, include:

```json
{
  "view": "shared",
  "sharedListId": "shared-list-id"
}
```

### Update Task

```text
PUT /api/tasks/:id
```

Updates editable task fields.

### Complete Or Reopen Task

```text
PATCH /api/tasks/:id/toggle
```

Switches the task between completed and pending.

### Delete Task

```text
DELETE /api/tasks/:id
```

Removes a task permanently.

## 8. Auth And Shared List API

### Register

```text
POST /api/auth/register
```

### Login

```text
POST /api/auth/login
```

### Logout

```text
POST /api/auth/logout
```

### Current User

```text
GET /api/auth/me
```

### Create Shared List

```text
POST /api/shared-lists
```

### Join Shared List

```text
POST /api/shared-lists/join
```

## 9. Suggested Future Improvements

- Email verification
- Password reset flow
- Roles for shared list owners and members
- Comments on tasks
- Attachments
- Reminder notifications
- Drag-and-drop task ordering
- Kanban board view
- Authentication and per-user task visibility
- Role-based permissions
- Activity history

## 10. Acceptance Criteria

The first version is complete when:

- User can register.
- User can log in and log out.
- User can see only their personal tasks.
- User can create and join a shared list.
- Shared list members can add and complete shared tasks.
- User can add a task.
- User can edit a task.
- User can complete and reopen a task.
- User can delete a task.
- Task data remains after refresh.
- UI shows progress statistics.
- Search and filters work correctly.
- App runs locally with `npm start`.
