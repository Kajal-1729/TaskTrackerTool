const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const { Pool } = require("pg");

const { randomBytes, randomUUID, timingSafeEqual } = crypto;
const scryptAsync = promisify(crypto.scrypt);

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATABASE_URL = process.env.DATABASE_URL;
const SESSION_COOKIE = "tt_session";
const SESSION_DAYS = 7;
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const PASSWORD_KEY_LENGTH = 64;

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

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
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

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf("=");
        return [decodeURIComponent(cookie.slice(0, index)), decodeURIComponent(cookie.slice(index + 1))];
      })
  );
}

function isSecureRequest(req) {
  return req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
}

function sessionCookie(token, req) {
  const secure = isSecureRequest(req) ? "; Secure" : "";
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearSessionCookie(req) {
  const secure = isSecureRequest(req) ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    ownerId: row.owner_id || null,
    sharedListId: row.shared_list_id || null,
    createdBy: row.created_by || null
  };
}

function mapSharedList(row) {
  return {
    id: row.id,
    name: row.name,
    accessCode: row.access_code,
    role: row.role || "member",
    createdAt: new Date(row.created_at).toISOString()
  };
}

function isValidUuid(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function createAccessCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derived.toString("base64url")}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, n, r, p, salt, hash] = String(storedHash || "").split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const derived = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024
  });
  const expected = Buffer.from(hash, "base64url");

  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, tokenHash, expiresAt]
  );

  return token;
}

async function getCurrentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const result = await pool.query(
    `SELECT users.id, users.name, users.email
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1
       AND sessions.expires_at > NOW()`,
    [hashSessionToken(token)]
  );

  return result.rows[0] || null;
}

async function requireUser(req, res) {
  const user = await getCurrentUser(req);
  if (!user) {
    sendError(res, 401, "Please log in to continue.");
    return null;
  }
  return user;
}

async function ensureSharedAccess(sharedListId, userId) {
  if (!isValidUuid(sharedListId)) return false;

  const result = await pool.query(
    `SELECT 1
     FROM shared_list_members
     WHERE shared_list_id = $1 AND user_id = $2`,
    [sharedListId, userId]
  );

  return result.rowCount > 0;
}

async function initializeDatabase() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Connect a Render Postgres database before starting the app.");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared_lists (
      id UUID PRIMARY KEY,
      name VARCHAR(90) NOT NULL,
      access_code VARCHAR(16) NOT NULL UNIQUE,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared_list_members (
      shared_list_id UUID NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (shared_list_id, user_id)
    )
  `);

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

  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE");
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS shared_list_id UUID REFERENCES shared_lists(id) ON DELETE CASCADE");
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON tasks(owner_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_tasks_shared_list_id ON tasks(shared_list_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)");
}

async function handleAuth(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const user = await getCurrentUser(req);
    sendJson(res, 200, { user: user ? publicUser(user) : null });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!name || name.length > 80) {
      sendError(res, 400, "Please enter your name.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendError(res, 400, "Please enter a valid email address.");
      return;
    }

    if (password.length < 8 || password.length > 128) {
      sendError(res, 400, "Password must be between 8 and 128 characters.");
      return;
    }

    const passwordHash = await hashPassword(password);

    try {
      const result = await pool.query(
        `INSERT INTO users (id, name, email, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email`,
        [randomUUID(), name, email, passwordHash]
      );
      const token = await createSession(result.rows[0].id);
      sendJson(res, 201, { user: publicUser(result.rows[0]) }, { "Set-Cookie": sessionCookie(token, req) });
    } catch (error) {
      if (error.code === "23505") {
        sendError(res, 409, "An account with this email already exists.");
        return;
      }
      throw error;
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const result = await pool.query("SELECT id, name, email, password_hash FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      sendError(res, 401, "Email or password is incorrect.");
      return;
    }

    const token = await createSession(user.id);
    sendJson(res, 200, { user: publicUser(user) }, { "Set-Cookie": sessionCookie(token, req) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) {
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashSessionToken(token)]);
    }
    sendJson(res, 200, { success: true }, { "Set-Cookie": clearSessionCookie(req) });
    return;
  }

  sendError(res, 404, "Auth endpoint not found.");
}

async function handleSharedLists(req, res, url) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === "GET" && url.pathname === "/api/shared-lists") {
    const result = await pool.query(
      `SELECT shared_lists.*, shared_list_members.role
       FROM shared_lists
       JOIN shared_list_members ON shared_list_members.shared_list_id = shared_lists.id
       WHERE shared_list_members.user_id = $1
       ORDER BY shared_lists.created_at DESC`,
      [user.id]
    );
    sendJson(res, 200, result.rows.map(mapSharedList));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/shared-lists") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();

    if (!name || name.length > 90) {
      sendError(res, 400, "Please enter a shared list name.");
      return;
    }

    let sharedList;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const result = await pool.query(
          `INSERT INTO shared_lists (id, name, access_code, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [randomUUID(), name, createAccessCode(), user.id]
        );
        sharedList = result.rows[0];
        break;
      } catch (error) {
        if (error.code !== "23505") throw error;
      }
    }

    if (!sharedList) {
      sendError(res, 500, "Unable to create a unique access code.");
      return;
    }

    await pool.query(
      `INSERT INTO shared_list_members (shared_list_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [sharedList.id, user.id]
    );

    sendJson(res, 201, mapSharedList({ ...sharedList, role: "owner" }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/shared-lists/join") {
    const body = await readBody(req);
    const accessCode = String(body.accessCode || "").trim().toUpperCase();

    if (!accessCode) {
      sendError(res, 400, "Please enter an access code.");
      return;
    }

    const listResult = await pool.query("SELECT * FROM shared_lists WHERE access_code = $1", [accessCode]);
    const sharedList = listResult.rows[0];

    if (!sharedList) {
      sendError(res, 404, "Shared list not found.");
      return;
    }

    await pool.query(
      `INSERT INTO shared_list_members (shared_list_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (shared_list_id, user_id) DO NOTHING`,
      [sharedList.id, user.id]
    );

    sendJson(res, 200, mapSharedList({ ...sharedList, role: "member" }));
    return;
  }

  sendError(res, 404, "Shared list endpoint not found.");
}

async function handleTasks(req, res, url) {
  const user = await requireUser(req, res);
  if (!user) return;

  const taskIdMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  const toggleMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/toggle$/);

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    const view = url.searchParams.get("view") || "personal";
    const sharedListId = url.searchParams.get("sharedListId") || "";

    if (view === "shared") {
      if (!(await ensureSharedAccess(sharedListId, user.id))) {
        sendError(res, 403, "You do not have access to this shared list.");
        return;
      }

      const result = await pool.query(
        `SELECT * FROM tasks
         WHERE shared_list_id = $1
         ORDER BY completed ASC, updated_at DESC`,
        [sharedListId]
      );
      sendJson(res, 200, result.rows.map(mapTask));
      return;
    }

    const result = await pool.query(
      `SELECT * FROM tasks
       WHERE owner_id = $1 AND shared_list_id IS NULL
       ORDER BY completed ASC, updated_at DESC`,
      [user.id]
    );
    sendJson(res, 200, result.rows.map(mapTask));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    const body = await readBody(req);
    const input = normalizeTaskInput(body);
    const view = body.view === "shared" ? "shared" : "personal";
    const sharedListId = String(body.sharedListId || "").trim();

    if (!input.title) {
      sendError(res, 400, "Task title is required.");
      return;
    }

    if (view === "shared" && !(await ensureSharedAccess(sharedListId, user.id))) {
      sendError(res, 403, "You do not have access to this shared list.");
      return;
    }

    const result = await pool.query(
      `INSERT INTO tasks (id, title, description, assignee, priority, due_date, owner_id, shared_list_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        randomUUID(),
        input.title,
        input.description,
        input.assignee,
        input.priority,
        input.dueDate || null,
        view === "personal" ? user.id : null,
        view === "shared" ? sharedListId : null,
        user.id
      ]
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
    const body = await readBody(req);
    const input = normalizeTaskInput(body);

    if (!isValidUuid(id)) {
      sendError(res, 404, "Task not found.");
      return;
    }

    if (!input.title) {
      sendError(res, 400, "Task title is required.");
      return;
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = $3,
           description = $4,
           assignee = $5,
           priority = $6,
           due_date = $7,
           updated_at = NOW()
       WHERE id = $1
         AND (
           owner_id = $2 OR EXISTS (
             SELECT 1 FROM shared_list_members
             WHERE shared_list_members.shared_list_id = tasks.shared_list_id
               AND shared_list_members.user_id = $2
           )
         )
       RETURNING *`,
      [id, user.id, input.title, input.description, input.assignee, input.priority, input.dueDate || null]
    );

    if (result.rowCount === 0) {
      sendError(res, 404, "Task not found.");
      return;
    }

    sendJson(res, 200, mapTask(result.rows[0]));
    return;
  }

  if (req.method === "PATCH" && toggleMatch) {
    const id = decodeURIComponent(toggleMatch[1]);

    if (!isValidUuid(id)) {
      sendError(res, 404, "Task not found.");
      return;
    }

    const result = await pool.query(
      `UPDATE tasks
       SET completed = NOT completed,
           updated_at = NOW(),
           completed_at = CASE WHEN NOT completed THEN NOW() ELSE NULL END
       WHERE id = $1
         AND (
           owner_id = $2 OR EXISTS (
             SELECT 1 FROM shared_list_members
             WHERE shared_list_members.shared_list_id = tasks.shared_list_id
               AND shared_list_members.user_id = $2
           )
         )
       RETURNING *`,
      [id, user.id]
    );

    if (result.rowCount === 0) {
      sendError(res, 404, "Task not found.");
      return;
    }

    sendJson(res, 200, mapTask(result.rows[0]));
    return;
  }

  if (req.method === "DELETE" && taskIdMatch) {
    const id = decodeURIComponent(taskIdMatch[1]);

    if (!isValidUuid(id)) {
      sendError(res, 404, "Task not found.");
      return;
    }

    const result = await pool.query(
      `DELETE FROM tasks
       WHERE id = $1
         AND (
           owner_id = $2 OR EXISTS (
             SELECT 1 FROM shared_list_members
             WHERE shared_list_members.shared_list_id = tasks.shared_list_id
               AND shared_list_members.user_id = $2
           )
         )
       RETURNING id`,
      [id, user.id]
    );

    if (result.rowCount === 0) {
      sendError(res, 404, "Task not found.");
      return;
    }

    sendJson(res, 200, { success: true });
    return;
  }

  sendError(res, 404, "Task endpoint not found.");
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    await pool.query("SELECT 1");
    sendJson(res, 200, { status: "ok", database: "connected" });
    return;
  }

  if (url.pathname.startsWith("/api/auth/")) {
    await handleAuth(req, res, url);
    return;
  }

  if (url.pathname.startsWith("/api/shared-lists")) {
    await handleSharedLists(req, res, url);
    return;
  }

  if (url.pathname.startsWith("/api/tasks")) {
    await handleTasks(req, res, url);
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
