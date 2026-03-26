const API_BASE = window.RBAC_API_BASE || "http://localhost:8001";
let role = null;
let currentUser = null;
let currentPerms = [];
let editThingId = null;

const ROLE_CLASS_MAP = {
  administrator: "role-admin",
  editor: "role-editor",
  viewer: "role-viewer",
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setActiveTab(active) {
  const thingsTab = document.getElementById("thingsTab");
  const auditTab = document.getElementById("auditTab");
  const matrixTab = document.getElementById("matrixTab");
  thingsTab.classList.toggle("active", active === "things");
  auditTab.classList.toggle("active", active === "audit");
  matrixTab.classList.toggle("active", active === "matrix");
}

function showThingsView() {
  document.getElementById("thingsView").classList.remove("hidden");
  document.getElementById("auditView").classList.add("hidden");
  document.getElementById("matrixView").classList.add("hidden");
  setActiveTab("things");
}

async function showAuditView() {
  document.getElementById("thingsView").classList.add("hidden");
  document.getElementById("auditView").classList.remove("hidden");
  document.getElementById("matrixView").classList.add("hidden");
  setActiveTab("audit");
  await loadAudit();
}

function showMatrixView() {
  document.getElementById("thingsView").classList.add("hidden");
  document.getElementById("auditView").classList.add("hidden");
  document.getElementById("matrixView").classList.remove("hidden");
  setActiveTab("matrix");
}

function showError(message) {
  const errorText = document.getElementById("errorText");
  if (!errorText) return;
  errorText.textContent = message;
  errorText.classList.remove("hidden");
}

function clearError() {
  const errorText = document.getElementById("errorText");
  if (!errorText) return;
  errorText.textContent = "";
  errorText.classList.add("hidden");
}

function normalizeRole(userLabel) {
  if (userLabel === "admin") return "administrator";
  return userLabel;
}

function updateRoleBadge() {
  const badge = document.getElementById("currentRoleBadge");
  if (!badge) return;
  const safeRole = role || "viewer";
  badge.textContent = safeRole;
  badge.className = `role-badge ${ROLE_CLASS_MAP[safeRole] || ROLE_CLASS_MAP.viewer}`;
}

function setHealth(online) {
  const health = document.getElementById("healthStatus");
  if (!health) return;

  if (online) {
    health.classList.remove("health-offline");
    health.classList.add("health-online");
    health.innerHTML = '<span class="health-dot"></span>healthy';
    return;
  }

  health.classList.remove("health-online");
  health.classList.add("health-offline");
  health.innerHTML = '<span class="health-dot"></span>disconnected';
}

async function refreshHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const ok = response.ok;
    setHealth(ok);
  } catch {
    setHealth(false);
  }
}

function setTableLoading(tableBodyId, colspan, label) {
  const body = document.getElementById(tableBodyId);
  if (!body) return;
  body.innerHTML = `<tr><td colspan="${colspan}">${label}</td></tr>`;
}

function hideEditSection() {
  editThingId = null;
  document.getElementById("editThingName").value = "";
  document.getElementById("editSection").classList.add("hidden");
}

async function api(path, method = "GET", body = null) {
  const options = { method, headers: {} };
  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new Error(`Cannot reach API at ${API_BASE}. Is backend running?`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

async function login(userLabel) {
  clearError();
  currentUser = userLabel;
  role = normalizeRole(userLabel);
  updateRoleBadge();
  document.getElementById("status").textContent = `Logged in as ${currentUser} (role: ${role})`;

  try {
    await Promise.all([loadPermissions(), loadMatrix(), loadThings(), refreshHealth()]);
    showThingsView();
  } catch (err) {
    showError(err.message);
  }
}

async function loadPermissions() {
  const data = await api(`/permissions?user=${encodeURIComponent(currentUser)}`);
  currentPerms = data.permissions;
  document.getElementById("permText").textContent = `Permissions: ${currentPerms.join(", ")}`;
  renderUI(currentPerms);
}

function renderUI(perms) {
  const createSection = document.getElementById("createSection");
  const auditTab = document.getElementById("auditTab");

  if (!perms.includes("create")) {
    createSection.classList.add("hidden");
  } else {
    createSection.classList.remove("hidden");
  }

  if (role === "administrator") {
    auditTab.classList.remove("hidden-force");
  } else {
    auditTab.classList.add("hidden-force");
    if (document.getElementById("auditView").classList.contains("hidden") === false) {
      showThingsView();
    }
  }
}

async function loadMatrix() {
  setTableLoading("matrixBody", 2, "Loading permissions matrix...");
  const data = await api("/permissions/matrix");
  const matrixBody = document.getElementById("matrixBody");
  matrixBody.innerHTML = "";

  Object.entries(data).forEach(([r, actions]) => {
    const labels = actions
      .map((action) => `<span class="pill">${escapeHtml(action)}</span>`)
      .join(" ");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(r)}</td><td><span class="action-label">${labels}</span></td>`;
    matrixBody.appendChild(tr);
  });

  if (!Object.keys(data).length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="2">No matrix data available.</td>';
    matrixBody.appendChild(tr);
  }
}

async function loadThings() {
  setTableLoading("thingsBody", 5, "Loading things...");
  const rows = await api(`/things?user=${encodeURIComponent(currentUser || "viewer")}`);
  const thingsBody = document.getElementById("thingsBody");
  thingsBody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="5">No rows visible for this role.</td>';
    thingsBody.appendChild(tr);
    hideEditSection();
    return;
  }

  rows.forEach((item) => {
    const isAdmin = role === "administrator";
    const canUpdate = currentPerms.includes("update") && (isAdmin || item.owner === currentUser);
    const canDelete = currentPerms.includes("delete") && (isAdmin || item.owner === currentUser);

    const actions = [];
    if (canUpdate) {
      actions.push(`<button onclick="startUpdateThing(${item.id}, '${encodeURIComponent(item.name)}')">Update</button>`);
    }
    if (canDelete) {
      actions.push(`<button onclick="deleteThing(${item.id})">Delete</button>`);
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${escapeHtml(item.visibility)}</td>
      <td>
        ${actions.length ? `<div class="actions">${actions.join("")}</div>` : "-"}
      </td>
    `;
    thingsBody.appendChild(tr);
  });
}

async function loadAudit() {
  clearError();
  setTableLoading("auditBody", 4, "Loading audit logs...");
  const auditBody = document.getElementById("auditBody");
  auditBody.innerHTML = "";

  if (!currentUser) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="4">Login first to view audit logs.</td>';
    auditBody.appendChild(tr);
    return;
  }

  const limitInput = document.getElementById("auditLimit");
  const rawLimit = Number.parseInt(limitInput.value, 10);
  const safeLimit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, rawLimit)) : 25;
  limitInput.value = String(safeLimit);

  try {
    const rows = await api(`/audit?user=${encodeURIComponent(currentUser)}&limit=${safeLimit}`);

    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="4">No audit events found.</td>';
      auditBody.appendChild(tr);
      return;
    }

    rows.forEach((item) => {
      const eventClass = item.event && item.event.includes("denied") ? "event-pill" : "pill";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.id}</td>
        <td>${escapeHtml(item.actor)}</td>
        <td><span class="${eventClass}">${escapeHtml(item.event)}</span></td>
        <td>${escapeHtml(item.timestamp)}</td>
      `;
      auditBody.appendChild(tr);
    });
  } catch (err) {
    showError(err.message);
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="4">Unable to load audit logs.</td>';
    auditBody.appendChild(tr);
  }
}

async function createThing() {
  clearError();
  const name = document.getElementById("thingName").value.trim();
  const visibility = document.getElementById("thingVisibility").value;
  if (!name) {
    showError("Thing name is required.");
    return;
  }

  try {
    await api(`/things?user=${encodeURIComponent(currentUser)}`, "POST", { name, visibility });
    document.getElementById("thingName").value = "";
    await loadThings();
  } catch (err) {
    showError(err.message);
  }
}

function startUpdateThing(id, encodedName) {
  clearError();
  editThingId = id;
  document.getElementById("editThingName").value = decodeURIComponent(encodedName || "");
  document.getElementById("editSection").classList.remove("hidden");
}

async function saveUpdateThing() {
  clearError();
  if (editThingId == null) {
    showError("Select a row to update first.");
    return;
  }

  const name = document.getElementById("editThingName").value.trim();
  if (!name) {
    showError("Updated thing name is required.");
    return;
  }

  try {
    await api(`/things/${editThingId}?user=${encodeURIComponent(currentUser)}`, "PATCH", { name });
    hideEditSection();
    await loadThings();
  } catch (err) {
    showError(err.message);
  }
}

function cancelUpdateThing() {
  hideEditSection();
}

async function deleteThing(id) {
  clearError();
  try {
    await api(`/things/${id}?user=${encodeURIComponent(currentUser)}`, "DELETE");
    if (editThingId === id) {
      hideEditSection();
    }
    await loadThings();
  } catch (err) {
    showError(err.message);
  }
}

window.login = login;
window.createThing = createThing;
window.startUpdateThing = startUpdateThing;
window.saveUpdateThing = saveUpdateThing;
window.cancelUpdateThing = cancelUpdateThing;
window.deleteThing = deleteThing;
window.showThingsView = showThingsView;
window.showAuditView = showAuditView;
window.showMatrixView = showMatrixView;
window.loadAudit = loadAudit;

refreshHealth();
