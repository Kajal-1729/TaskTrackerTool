const apiBase = "/api/tasks";

const state = {
  tasks: [],
  filters: {
    search: "",
    status: "all",
    priority: "all"
  },
  editingId: null
};

const elements = {
  taskForm: document.querySelector("#taskForm"),
  taskId: document.querySelector("#taskId"),
  title: document.querySelector("#title"),
  description: document.querySelector("#description"),
  assignee: document.querySelector("#assignee"),
  dueDate: document.querySelector("#dueDate"),
  priority: document.querySelector("#priority"),
  formTitle: document.querySelector("#formTitle"),
  saveButton: document.querySelector("#saveButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  taskList: document.querySelector("#taskList"),
  emptyState: document.querySelector("#emptyState"),
  refreshButton: document.querySelector("#refreshButton"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  priorityFilter: document.querySelector("#priorityFilter"),
  totalCount: document.querySelector("#totalCount"),
  pendingCount: document.querySelector("#pendingCount"),
  completedCount: document.querySelector("#completedCount"),
  highPriorityCount: document.querySelector("#highPriorityCount"),
  progressPercent: document.querySelector("#progressPercent"),
  toast: document.querySelector("#toast")
};

async function request(endpoint = "", options = {}) {
  const response = await fetch(`${apiBase}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString) {
  if (!dateString) return "No due date";
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 2400);
}

function getFilteredTasks() {
  const search = state.filters.search.toLowerCase();

  return state.tasks.filter((task) => {
    const matchesSearch = [task.title, task.description, task.assignee]
      .join(" ")
      .toLowerCase()
      .includes(search);

    const matchesStatus =
      state.filters.status === "all" ||
      (state.filters.status === "completed" && task.completed) ||
      (state.filters.status === "pending" && !task.completed);

    const matchesPriority = state.filters.priority === "all" || task.priority === state.filters.priority;

    return matchesSearch && matchesStatus && matchesPriority;
  });
}

function updateStats() {
  const total = state.tasks.length;
  const completed = state.tasks.filter((task) => task.completed).length;
  const pending = total - completed;
  const highPriority = state.tasks.filter((task) => task.priority === "high" && !task.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  elements.totalCount.textContent = total;
  elements.pendingCount.textContent = pending;
  elements.completedCount.textContent = completed;
  elements.highPriorityCount.textContent = highPriority;
  elements.progressPercent.textContent = `${percent}%`;
}

function taskTemplate(task) {
  const description = task.description
    ? `<p class="task-description">${escapeHtml(task.description)}</p>`
    : `<p class="task-description">No description added.</p>`;

  const assignee = task.assignee ? escapeHtml(task.assignee) : "Unassigned";

  return `
    <article class="task-item priority-${escapeHtml(task.priority)} ${task.completed ? "completed" : ""}">
      <button class="complete-toggle" type="button" data-action="toggle" data-id="${escapeHtml(task.id)}" aria-label="${task.completed ? "Reopen task" : "Complete task"}">
        ${task.completed ? "✓" : ""}
      </button>
      <div class="task-content">
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        ${description}
        <div class="task-meta">
          <span class="meta-pill ${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>
          <span class="meta-pill">${assignee}</span>
          <span class="meta-pill">${formatDate(task.dueDate)}</span>
          <span class="meta-pill">${task.completed ? "Completed" : "Pending"}</span>
        </div>
      </div>
      <div class="task-actions">
        <button type="button" data-action="edit" data-id="${escapeHtml(task.id)}" title="Edit task" aria-label="Edit task">✎</button>
        <button type="button" data-action="delete" data-id="${escapeHtml(task.id)}" title="Delete task" aria-label="Delete task">×</button>
      </div>
    </article>
  `;
}

function renderTasks() {
  const filteredTasks = getFilteredTasks();

  elements.taskList.innerHTML = filteredTasks.map(taskTemplate).join("");
  elements.emptyState.hidden = filteredTasks.length > 0;
  updateStats();
}

function resetForm() {
  state.editingId = null;
  elements.taskForm.reset();
  elements.priority.value = "medium";
  elements.taskId.value = "";
  elements.formTitle.textContent = "Add Task";
  elements.saveButton.textContent = "Save Task";
  elements.cancelEditButton.hidden = true;
}

function fillFormForEdit(task) {
  state.editingId = task.id;
  elements.taskId.value = task.id;
  elements.title.value = task.title;
  elements.description.value = task.description || "";
  elements.assignee.value = task.assignee || "";
  elements.dueDate.value = task.dueDate || "";
  elements.priority.value = task.priority || "medium";
  elements.formTitle.textContent = "Edit Task";
  elements.saveButton.textContent = "Update Task";
  elements.cancelEditButton.hidden = false;
  elements.title.focus();
}

function getFormPayload() {
  return {
    title: elements.title.value.trim(),
    description: elements.description.value.trim(),
    assignee: elements.assignee.value.trim(),
    dueDate: elements.dueDate.value,
    priority: elements.priority.value
  };
}

async function loadTasks() {
  state.tasks = await request();
  renderTasks();
}

async function handleSubmit(event) {
  event.preventDefault();

  const payload = getFormPayload();
  if (!payload.title) {
    showToast("Please enter a task title.");
    elements.title.focus();
    return;
  }

  if (state.editingId) {
    await request(`/${encodeURIComponent(state.editingId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    showToast("Task updated.");
  } else {
    await request("", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showToast("Task added.");
  }

  resetForm();
  await loadTasks();
}

async function handleTaskClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  const task = state.tasks.find((item) => item.id === id);

  if (!task) return;

  if (action === "edit") {
    fillFormForEdit(task);
    return;
  }

  if (action === "toggle") {
    await request(`/${encodeURIComponent(id)}/toggle`, { method: "PATCH" });
    showToast(task.completed ? "Task reopened." : "Task completed.");
    await loadTasks();
    return;
  }

  if (action === "delete") {
    const confirmed = window.confirm(`Delete "${task.title}"?`);
    if (!confirmed) return;

    await request(`/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (state.editingId === id) resetForm();
    showToast("Task deleted.");
    await loadTasks();
  }
}

function bindEvents() {
  elements.taskForm.addEventListener("submit", (event) => {
    handleSubmit(event).catch((error) => showToast(error.message));
  });

  elements.cancelEditButton.addEventListener("click", resetForm);

  elements.taskList.addEventListener("click", (event) => {
    handleTaskClick(event).catch((error) => showToast(error.message));
  });

  elements.refreshButton.addEventListener("click", () => {
    loadTasks()
      .then(() => showToast("Tasks refreshed."))
      .catch((error) => showToast(error.message));
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderTasks();
  });

  elements.statusFilter.addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    renderTasks();
  });

  elements.priorityFilter.addEventListener("change", (event) => {
    state.filters.priority = event.target.value;
    renderTasks();
  });
}

bindEvents();
loadTasks().catch((error) => showToast(error.message));
