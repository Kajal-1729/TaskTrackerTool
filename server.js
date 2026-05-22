const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");

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

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, "[]\n", "utf8");
  }
}

function readTasks() {
  ensureDataFile();
  const raw = fs.readFileSync(TASKS_FILE, "utf8").trim();
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeTasks(tasks) {
  ensureDataFile();
  fs.writeFileSync(TASKS_FILE, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
}

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
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });

    req.on("error", reject);
  });
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

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

async function handleApi(req, res, url) {
  const tasks = readTasks();
  const taskIdMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  const toggleMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/toggle$/);

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    sendJson(res, 200, sortTasks(tasks));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    const body = await readBody(req);
    const input = normalizeTaskInput(body);

    if (!input.title) {
      sendError(res, 400, "Task title is required.");
      return;
    }

    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      ...input,
      completed: false,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };

    const updatedTasks = [task, ...tasks];
    writeTasks(updatedTasks);
    sendJson(res, 201, task);
    return;
  }

  if (req.method === "PUT" && taskIdMatch) {
    const id = decodeURIComponent(taskIdMatch[1]);
    const index = tasks.findIndex((task) => task.id === id);

    if (index === -1) {
      sendError(res, 404, "Task not found.");
      return;
    }

    const body = await readBody(req);
    const input = normalizeTaskInput(body);

    if (!input.title) {
      sendError(res, 400, "Task title is required.");
      return;
    }

    const task = {
      ...tasks[index],
      ...input,
      updatedAt: new Date().toISOString()
    };

    tasks[index] = task;
    writeTasks(tasks);
    sendJson(res, 200, task);
    return;
  }

  if (req.method === "PATCH" && toggleMatch) {
    const id = decodeURIComponent(toggleMatch[1]);
    const index = tasks.findIndex((task) => task.id === id);

    if (index === -1) {
      sendError(res, 404, "Task not found.");
      return;
    }

    const isCompleted = !tasks[index].completed;
    const task = {
      ...tasks[index],
      completed: isCompleted,
      updatedAt: new Date().toISOString(),
      completedAt: isCompleted ? new Date().toISOString() : null
    };

    tasks[index] = task;
    writeTasks(tasks);
    sendJson(res, 200, task);
    return;
  }

  if (req.method === "DELETE" && taskIdMatch) {
    const id = decodeURIComponent(taskIdMatch[1]);
    const filteredTasks = tasks.filter((task) => task.id !== id);

    if (filteredTasks.length === tasks.length) {
      sendError(res, 404, "Task not found.");
      return;
    }

    writeTasks(filteredTasks);
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
    sendError(res, 400, error.message || "Something went wrong.");
  }
});

ensureDataFile();
server.listen(PORT, () => {
  console.log(`Task Manager is running at http://localhost:${PORT}`);
});
