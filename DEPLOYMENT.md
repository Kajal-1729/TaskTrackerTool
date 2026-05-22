# Deploy The Task Manager

This project is a Node.js web service, so deploy it as a web service rather than as a static site.

## Recommended Free Option: Render

Render supports free Node.js web services. Free services can sleep after inactivity and their local filesystem is temporary, so this is good for a demo or student project. For production, replace `data/tasks.json` with a database.

### Steps

1. Push this project to a GitHub repository.
2. Go to `https://dashboard.render.com`.
3. Sign in or create a Render account.
4. Click **New**.
5. Choose **Web Service**.
6. Connect your GitHub repository.
7. Select the repository for this project.
8. Use these settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |

9. Click **Deploy Web Service**.
10. After deployment finishes, Render gives you a public URL like:

```text
https://task-manager-tool.onrender.com
```

That URL can be shared with other people.

## Alternative Free Option: Koyeb

Koyeb can deploy Node.js apps from GitHub.

### Steps

1. Push this project to GitHub.
2. Go to `https://app.koyeb.com`.
3. Create a web service.
4. Select GitHub as the deployment source.
5. Choose this project repository and branch.
6. Use the Node.js buildpack.
7. Keep the start command as:

```bash
npm start
```

8. Deploy the service.
9. Koyeb gives a public URL ending with:

```text
.koyeb.app
```

## Important Data Note

The current app stores tasks in `data/tasks.json`. On free hosting platforms, local file changes may be lost when the service restarts, sleeps, or redeploys.

For a real shared task manager, use a hosted database such as:

- Render Postgres
- Supabase Postgres
- Neon Postgres
- MongoDB Atlas

## Local Check Before Deploy

Run:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

If the local app works, it is ready to deploy.
