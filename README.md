# Task Manager Tool

A full-stack task manager web application for tracking current work, completed work, and future assigned tasks.

## Features

- Add a task with title, description, assignee, due date, and priority.
- Edit any existing task.
- Mark tasks as completed or reopen them.
- Delete tasks.
- Register and log in with a personal account.
- Keep personal tasks private to the signed-in user.
- Create shared task lists with an access code.
- Join shared lists and collaborate on shared tasks.
- Search and filter tasks by status and priority.
- View progress statistics.
- Persist tasks in PostgreSQL so saved work survives web-service redeploys.

## How To Start

1. Install [Node.js](https://nodejs.org/) version 18 or newer.
2. Create a PostgreSQL database.
3. Set the `DATABASE_URL` environment variable to its connection string.
4. Open a terminal in this project folder and run:

```bash
npm install
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
│   └── tasks.json (legacy backup, not live storage)
├── package.json
└── server.js
```

## API Summary

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Log in |
| `POST` | `/api/auth/logout` | Log out |
| `GET` | `/api/auth/me` | Fetch current session user |
| `GET` | `/api/shared-lists` | Fetch shared lists for the user |
| `POST` | `/api/shared-lists` | Create a shared list |
| `POST` | `/api/shared-lists/join` | Join a shared list by access code |
| `GET` | `/api/tasks` | Fetch personal or shared tasks |
| `GET` | `/api/health` | Confirm the database is connected |
| `POST` | `/api/tasks` | Create a task |
| `PUT` | `/api/tasks/:id` | Update a task |
| `PATCH` | `/api/tasks/:id/toggle` | Complete or reopen a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |

More detail is available in [docs/task-manager-workflow.md](docs/task-manager-workflow.md).

## Deploy

Deployment instructions are available in [DEPLOYMENT.md](DEPLOYMENT.md).
