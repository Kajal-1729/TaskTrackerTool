const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATABASE_URL = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false
});

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        const contentType = req.headers["content-type"] || "";

        if (contentType.includes("application/x-www-form-urlencoded")) {
          resolve(Object.fromEntries(new URLSearchParams(body)));
          return;
        }

        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid request body."));
      }
    });

    req.on("error", reject);
  });
}

function isFormSubmission(req) {
  const contentType = req.headers["content-type"] || "";
  return contentType.includes("application/x-www-form-urlencoded");
}

function normalizeTaskInput(input) {
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const assignee = String(input.assignee || "").trim();
  const dueDate = String(input.dueDate || "").trim();
  const allowedPriorities = new Set(["low", "medium", "high"]);
  const priority = allowedPriorities.has(input.priority) ? input.priority : "medium";

  return {
    title,
    description,
    assignee,
    dueDate,
    priority
  };
}

function mapTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assignee: row.assignee,
    priority: row.priority,
    dueDate: row.due_date instanceof Date ? row.due_date.toISOString().slice(0, 10) : row.due_date || "",
    completed: row.completed,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null
  };
}

function isValidTaskId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

async function initializeDatabase() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Connect a Render Postgres database before starting the app.");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY,
      title VARCHAR(90) NOT NULL,
      description VARCHAR(400) NOT NULL DEFAULT '',
      assignee VARCHAR(60) NOT NULL DEFAULT '',
      priority VARCHAR(10) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high')),
      due_date DATE,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);
}

async function handleApi(req, res, url) {
  const taskIdMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  const toggleMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/toggle$/);

  if (req.method === "GET" && url.pathname === "/api/health") {
    await pool.query("SELECT 1");
    sendJson(res, 200, { status: "ok", database: "connected" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    const result = await pool.query("SELECT * FROM tasks ORDER BY completed ASC, updated_at DESC");
    sendJson(res, 200, result.rows.map(mapTask));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    const body = await readBody(req);
    const input = normalizeTaskInput(body);

    if (!input.title) {
      sendError(res, 400, "Task title is required.");
      return;
    }

    const result = await pool.query(
      `INSERT INTO tasks (id, title, description, assignee, priority, due_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [randomUUID(), input.title, input.description, input.assignee, input.priority, input.dueDate || null]
    );
    const task = mapTask(result.rows[0]);

    if (isFormSubmission(req)) {
      res.writeHead(303, { Location: "/" });
      res.end();
      return;
    }

    sendJson(res, 201, task);
    return;
  }

  if (req.method === "PUT" && taskIdMatch) {
    const id = decodeURIComponent(taskIdMatch[1]);

    if (!isValidTaskId(id)) {
      sendError(res, 404, "Task not found.");
      return;
    }

    const body = await readBody(req);
    const input = normalizeTaskInput(body);

    if (!input.title) {
      sendError(res, 400, "Task title is required.");
      return;
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = $2,
           description = $3,
           assignee = $4,
           priority = $5,
           due_date = $6,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, input.title, input.description, input.assignee, input.priority, input.dueDate || null]
    );

    if (result.rowCount === 0) {
      sendError(res, 404, "Task not found.");
      return;
    }

    const task = mapTask(result.rows[0]);
    sendJson(res, 200, task);
    return;
  }

  if (req.method === "PATCH" && toggleMatch) {
    const id = decodeURIComponent(toggleMatch[1]);

    if (!isValidTaskId(id)) {
      sendError(res, 404, "Task not found.");
      return;
    }

    const result = await pool.query(
      `UPDATE tasks
       SET completed = NOT completed,
           updated_at = NOW(),
           completed_at = CASE WHEN NOT completed THEN NOW() ELSE NULL END
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      sendError(res, 404, "Task not found.");
      return;
    }

    const task = mapTask(result.rows[0]);
    sendJson(res, 200, task);
    return;
  }

  if (req.method === "DELETE" && taskIdMatch) {
    const id = decodeURIComponent(taskIdMatch[1]);

    if (!isValidTaskId(id)) {
      sendError(res, 404, "Task not found.");
      return;
    }

    const result = await pool.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      sendError(res, 404, "Task not found.");
      return;
    }

    sendJson(res, 200, { success: true });
    return;
  }

  sendError(res, 404, "API endpoint not found.");
}

function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Forbidden.");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        fs.readFile(path.join(PUBLIC_DIR, "index.html"), (indexErr, indexContent) => {
          if (indexErr) {
            sendError(res, 404, "File not found.");
            return;
          }

          res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
          res.end(indexContent);
        });
        return;
      }

      sendError(res, 500, "Unable to read file.");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(req, res, url);
  } catch (error) {
    const clientErrors = new Set(["Request body is too large.", "Invalid request body."]);

    if (clientErrors.has(error.message)) {
      sendError(res, 400, error.message);
      return;
    }

    console.error("Request failed:", error.message);
    sendError(res, 500, "Unable to complete request.");
  }
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error.message);
});

initializeDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Task Manager is running at http://localhost:${PORT}`);
    });
  })
  .catch(async (error) => {
    console.error(`Unable to start Task Manager: ${error.message}`);
    await pool.end();
    process.exit(1);
  });
