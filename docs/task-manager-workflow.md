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
- Storage: Local JSON file

This stack is simple for learning and does not require external packages. Later, the JSON file can be replaced with MongoDB, PostgreSQL, MySQL, or another database.

### Step 3: Build The Minimum Viable Product

The first version should include:

- Create task
- View task list
- Edit task
- Mark task as completed
- Reopen completed task
- Delete task
- Search and filter task list
- Show task progress summary

### Step 4: Run The App

From the project folder:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## 3. User Workflow

1. User opens the task manager dashboard.
2. User fills in task details such as title, description, assignee, priority, and due date.
3. User submits the form to create the task.
4. The frontend sends the task data to the backend.
5. The backend validates the task and saves it.
6. The frontend refreshes the task list.
7. User can mark a task complete when work is done.
8. User can edit task details if anything changes.
9. User can use filters and search to find relevant tasks.
10. User can delete tasks that are no longer needed.

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
| FR-10 | Data Persistence | Tasks remain saved after refreshing the browser or restarting the server. |
| FR-11 | Validation | Task title is required before saving. |
| FR-12 | API Access | Frontend communicates with backend through REST API endpoints. |

## 5. Non-Functional Requirements

Non-functional requirements describe how well the system should work.

| ID | Requirement | Description |
| --- | --- | --- |
| NFR-01 | Usability | Interface should be simple, clear, responsive, and easy to use. |
| NFR-02 | Performance | Task operations should feel fast for normal personal or small-team usage. |
| NFR-03 | Reliability | Tasks should not disappear after page refresh because data is saved on the backend. |
| NFR-04 | Maintainability | Code should be organized into frontend, backend, data, and documentation areas. |
| NFR-05 | Scalability | The storage layer should be replaceable with a real database later. |
| NFR-06 | Security | Backend should validate input and avoid exposing unnecessary local files. |
| NFR-07 | Accessibility | UI should support keyboard usage, visible labels, good contrast, and readable focus states. |
| NFR-08 | Responsiveness | Layout should work on desktop, tablet, and mobile screen sizes. |
| NFR-09 | Compatibility | App should run in modern browsers and Node.js 18 or newer. |
| NFR-10 | Recoverability | If the task data file is missing, the server should recreate it automatically. |

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

## 7. Backend API Workflow

### Fetch All Tasks

```text
GET /api/tasks
```

Returns all saved tasks.

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

## 8. Suggested Future Improvements

- User login and personal task ownership
- Team workspace and assigned tasks
- Comments on tasks
- Attachments
- Reminder notifications
- Drag-and-drop task ordering
- Kanban board view
- Real database integration
- Role-based permissions
- Activity history

## 9. Acceptance Criteria

The first version is complete when:

- User can add a task.
- User can edit a task.
- User can complete and reopen a task.
- User can delete a task.
- Task data remains after refresh.
- UI shows progress statistics.
- Search and filters work correctly.
- App runs locally with `npm start`.
