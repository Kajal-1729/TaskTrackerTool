const state = {
  user: null,
  tasks: [],
  sharedLists: [],
  currentView: "personal",
  currentSharedListId: "",
  filters: {
    search: "",
    status: "all",
    priority: "all"
  },
  editingId: null
};

const elements = {
  authShell: document.querySelector("#authShell"),
  appShell: document.querySelector("#appShell"),
  loginForm: document.querySelector("#loginForm"),
  registerForm: document.querySelector("#registerForm"),
  loginTab: document.querySelector("#loginTab"),
  registerTab: document.querySelector("#registerTab"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  registerName: document.querySelector("#registerName"),
  registerEmail: document.querySelector("#registerEmail"),
  registerPassword: document.querySelector("#registerPassword"),
  logoutButton: document.querySelector("#logoutButton"),
  currentUserName: document.querySelector("#currentUserName"),
  currentUserEmail: document.querySelector("#currentUserEmail"),
  workspaceSubtitle: document.querySelector("#workspaceSubtitle"),
  personalModeButton: document.querySelector("#personalModeButton"),
  sharedModeButton: document.querySelector("#sharedModeButton"),
  sharedTools: document.querySelector("#sharedTools"),
  sharedListSelect: document.querySelector("#sharedListSelect"),
  createSharedForm: document.querySelector("#createSharedForm"),
  joinSharedForm: document.querySelector("#joinSharedForm"),
  sharedListName: document.querySelector("#sharedListName"),
  joinCode: document.querySelector("#joinCode"),
  activeAccessCode: document.querySelector("#activeAccessCode"),
  sharedAccess: document.querySelector("#sharedAccess"),
  formContext: document.querySelector("#formContext"),
  boardContext: document.querySelector("#boardContext"),
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
  themeToggle: document.querySelector("#themeToggle"),
  themeToggleText: document.querySelector("#themeToggleText"),
  authThemeToggle: document.querySelector("#authThemeToggle"),
  authThemeToggleText: document.querySelector("#authThemeToggleText"),
  toast: document.querySelector("#toast")
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
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
  }, 2600);
}

function getPreferredTheme() {
  const savedTheme = localStorage.getItem("taskTrackerTheme");
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";

  document.documentElement.dataset.theme = theme;

  for (const button of [elements.themeToggle, elements.authThemeToggle]) {
    if (!button) continue;
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  }

  for (const label of [elements.themeToggleText, elements.authThemeToggleText]) {
    if (label) label.textContent = isDark ? "Light mode" : "Dark mode";
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme || getPreferredTheme();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";

  localStorage.setItem("taskTrackerTheme", nextTheme);
  applyTheme(nextTheme);
  showToast(`${nextTheme === "dark" ? "Dark" : "Light"} mode enabled.`);
}

function showAuth() {
  elements.authShell.hidden = false;
  elements.appShell.hidden = true;
}

function showApp() {
  elements.authShell.hidden = true;
  elements.appShell.hidden = false;
  elements.currentUserName.textContent = state.user.name;
  elements.currentUserEmail.textContent = state.user.email;
}

function setAuthTab(tab) {
  const isRegister = tab === "register";
  elements.loginForm.hidden = isRegister;
  elements.registerForm.hidden = !isRegister;
  elements.loginTab.classList.toggle("active", !isRegister);
  elements.registerTab.classList.toggle("active", isRegister);
}

function getActiveSharedList() {
  return state.sharedLists.find((list) => list.id === state.currentSharedListId) || null;
}

function updateModeUi() {
  const isShared = state.currentView === "shared";
  const activeList = getActiveSharedList();

  elements.personalModeButton.classList.toggle("active", !isShared);
  elements.sharedModeButton.classList.toggle("active", isShared);
  elements.sharedTools.hidden = !isShared;
  elements.sharedAccess.hidden = !isShared || !activeList;
  elements.activeAccessCode.textContent = activeList ? activeList.accessCode : "";
  elements.formContext.textContent = isShared ? "Shared task" : "Personal task";
  elements.boardContext.textContent = isShared ? "Shared list" : "Personal list";
  elements.workspaceSubtitle.textContent = isShared
    ? "Everyone with access to this shared list can add and complete tasks."
    : "Your personal tasks are visible only to you.";

  elements.sharedListSelect.innerHTML = state.sharedLists.length
    ? state.sharedLists
        .map((list) => `<option value="${escapeHtml(list.id)}">${escapeHtml(list.name)}</option>`)
        .join("")
    : `<option value="">No shared lists yet</option>`;
  elements.sharedListSelect.value = state.currentSharedListId;
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
        ${task.completed ? "&#10003;" : ""}
      </button>
      <div class="task-content">
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        ${description}
        <div class="task-meta">
          <span class="meta-pill ${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>
          <span class="meta-pill">${assignee}</span>
          <span class="meta-pill">${formatDate(task.dueDate)}</span>
          <span class="meta-pill">${task.completed ? "Completed" : "Pending"}</span>
          <span class="meta-pill">${task.sharedListId ? "Shared" : "Personal"}</span>
        </div>
      </div>
      <div class="task-actions">
        <button type="button" data-action="edit" data-id="${escapeHtml(task.id)}" title="Edit task" aria-label="Edit task">&#9998;</button>
        <button type="button" data-action="delete" data-id="${escapeHtml(task.id)}" title="Delete task" aria-label="Delete task">&times;</button>
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
    priority: elements.priority.value,
    view: state.currentView,
    sharedListId: state.currentView === "shared" ? state.currentSharedListId : ""
  };
}

async function loadSharedLists() {
  state.sharedLists = await request("/api/shared-lists");

  if (!state.sharedLists.length) {
    state.currentSharedListId = "";
  } else if (!state.currentSharedListId || !state.sharedLists.some((list) => list.id === state.currentSharedListId)) {
    state.currentSharedListId = state.sharedLists[0].id;
  }

  updateModeUi();
}

async function loadTasks() {
  if (state.currentView === "shared") {
    if (!state.currentSharedListId) {
      state.tasks = [];
      renderTasks();
      return;
    }

    const params = new URLSearchParams({
      view: "shared",
      sharedListId: state.currentSharedListId
    });
    state.tasks = await request(`/api/tasks?${params}`);
  } else {
    state.tasks = await request("/api/tasks?view=personal");
  }

  renderTasks();
}

async function refreshWorkspace() {
  if (!state.user) return;
  await loadSharedLists();
  await loadTasks();
}

async function handleSubmit(event) {
  event.preventDefault();

  const payload = getFormPayload();
  if (!payload.title) {
    showToast("Please enter a task title.");
    elements.title.focus();
    return;
  }

  if (state.currentView === "shared" && !state.currentSharedListId) {
    showToast("Create or join a shared list first.");
    return;
  }

  if (state.editingId) {
    await request(`/api/tasks/${encodeURIComponent(state.editingId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    showToast("Task updated.");
  } else {
    await request("/api/tasks", {
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
    await request(`/api/tasks/${encodeURIComponent(id)}/toggle`, { method: "PATCH" });
    showToast(task.completed ? "Task reopened." : "Task completed.");
    await loadTasks();
    return;
  }

  if (action === "delete") {
    const confirmed = window.confirm(`Delete "${task.title}"?`);
    if (!confirmed) return;

    await request(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (state.editingId === id) resetForm();
    showToast("Task deleted.");
    await loadTasks();
  }
}

async function login(email, password) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  state.user = result.user;
  showApp();
  await refreshWorkspace();
}

async function register(name, email, password) {
  const result = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password })
  });
  state.user = result.user;
  showApp();
  await refreshWorkspace();
}

async function logout() {
  await request("/api/auth/logout", { method: "POST" });
  state.user = null;
  state.tasks = [];
  state.sharedLists = [];
  state.currentView = "personal";
  state.currentSharedListId = "";
  resetForm();
  showAuth();
}

async function switchView(view) {
  state.currentView = view;
  resetForm();
  updateModeUi();
  await loadTasks();
}

async function initializeAuth() {
  const result = await request("/api/auth/me");
  state.user = result.user;

  if (!state.user) {
    showAuth();
    return;
  }

  showApp();
  await refreshWorkspace();
}

function bindEvents() {
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.authThemeToggle.addEventListener("click", toggleTheme);

  elements.loginTab.addEventListener("click", () => setAuthTab("login"));
  elements.registerTab.addEventListener("click", () => setAuthTab("register"));

  elements.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    login(elements.loginEmail.value, elements.loginPassword.value).catch((error) => showToast(error.message));
  });

  elements.registerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    register(elements.registerName.value, elements.registerEmail.value, elements.registerPassword.value).catch((error) =>
      showToast(error.message)
    );
  });

  elements.logoutButton.addEventListener("click", () => {
    logout().catch((error) => showToast(error.message));
  });

  elements.personalModeButton.addEventListener("click", () => {
    switchView("personal").catch((error) => showToast(error.message));
  });

  elements.sharedModeButton.addEventListener("click", () => {
    switchView("shared").catch((error) => showToast(error.message));
  });

  elements.sharedListSelect.addEventListener("change", (event) => {
    state.currentSharedListId = event.target.value;
    resetForm();
    updateModeUi();
    loadTasks().catch((error) => showToast(error.message));
  });

  elements.createSharedForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.sharedListName.value.trim();
    if (!name) {
      showToast("Enter a shared list name.");
      return;
    }

    request("/api/shared-lists", {
      method: "POST",
      body: JSON.stringify({ name })
    })
      .then(async (list) => {
        elements.sharedListName.value = "";
        state.currentView = "shared";
        state.currentSharedListId = list.id;
        showToast("Shared list created.");
        await refreshWorkspace();
      })
      .catch((error) => showToast(error.message));
  });

  elements.joinSharedForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const accessCode = elements.joinCode.value.trim();
    if (!accessCode) {
      showToast("Enter an access code.");
      return;
    }

    request("/api/shared-lists/join", {
      method: "POST",
      body: JSON.stringify({ accessCode })
    })
      .then(async (list) => {
        elements.joinCode.value = "";
        state.currentView = "shared";
        state.currentSharedListId = list.id;
        showToast("Joined shared list.");
        await refreshWorkspace();
      })
      .catch((error) => showToast(error.message));
  });

  elements.taskForm.addEventListener("submit", (event) => {
    handleSubmit(event).catch((error) => showToast(error.message));
  });

  elements.cancelEditButton.addEventListener("click", resetForm);

  elements.taskList.addEventListener("click", (event) => {
    handleTaskClick(event).catch((error) => showToast(error.message));
  });

  elements.refreshButton.addEventListener("click", () => {
    refreshWorkspace()
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

applyTheme(getPreferredTheme());
bindEvents();
initializeAuth().catch((error) => {
  showAuth();
  showToast(error.message);
});
