# Deploy The Task Manager

This project is a Node.js web service, so deploy it as a web service rather than as a static site.

## Render Deployment With PostgreSQL

This application now stores tasks in PostgreSQL instead of the web service's local filesystem. This prevents tasks from disappearing every time the app service redeploys.

### Connect A Database To Your Existing Render App

1. Go to `https://dashboard.render.com`.
2. Click **New** and choose **Postgres**.
3. Give the database a name, such as `task-manager-db`, choose the same region as your web service, select your desired plan, and create it.
4. When the database is ready, copy its **Internal Database URL** from the database connection details.
5. Open your existing `task-manager-tool` web service in Render.
6. Go to **Environment** and add this environment variable:

| Key | Value |
| --- | --- |
| `DATABASE_URL` | The Render Postgres **Internal Database URL** |

7. Save the environment variable.
8. In the service, choose **Manual Deploy** and deploy the latest commit.
9. When the deployment finishes, open:

```text
https://YOUR-RENDER-APP-URL/api/health
```

Successful database connection returns:

```json
{
  "status": "ok",
  "database": "connected"
}
```

### Blueprint Setup For A New Deployment

The repository includes `render.yaml`. When used to create a new Render Blueprint deployment, it provisions:

- A Node.js web service
- A PostgreSQL database
- A `DATABASE_URL` connection from the service to the database

### Build Settings

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |

## Local Check Before Deploy

For local development, set a PostgreSQL connection string before running the server:

```powershell
$env:DATABASE_URL = "postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE"
$env:DATABASE_SSL = "true"
npm install
npm start
```

Use `DATABASE_SSL=true` when connecting through Render's external database URL. The Render web service should use its same-region internal database URL.

Open:

```text
http://localhost:3000
```

If the local app works, it is ready to deploy.

## Existing JSON Tasks

Tasks that were previously stored inside the Render web service's temporary JSON file are not automatically copied into PostgreSQL. After this update is deployed, new tasks will be saved in PostgreSQL and remain available across redeployments.
