# Task Manager Tool

A full-stack task manager web application for tracking current work, completed work, and future assigned tasks.

## Features

- Add a task with title, description, assignee, due date, and priority.
- Edit any existing task.
- Mark tasks as completed or reopen them.
- Delete tasks.
- Search and filter tasks by status and priority.
- View progress statistics.
- Persist tasks in `data/tasks.json`.

## How To Start

1. Install [Node.js](https://nodejs.org/) version 18 or newer.
2. Open a terminal in this project folder.
3. Run:

```bash
npm start
```

4. Open:

```text
http://localhost:3000
```

## Project Structure

```text
.
├── docs/
│   └── task-manager-workflow.md
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── data/
│   └── tasks.json
├── package.json
└── server.js
```

## API Summary

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks` | Fetch all tasks |
| `POST` | `/api/tasks` | Create a task |
| `PUT` | `/api/tasks/:id` | Update a task |
| `PATCH` | `/api/tasks/:id/toggle` | Complete or reopen a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |

More detail is available in [docs/task-manager-workflow.md](docs/task-manager-workflow.md).

## Deploy

Deployment instructions are available in [DEPLOYMENT.md](DEPLOYMENT.md).
