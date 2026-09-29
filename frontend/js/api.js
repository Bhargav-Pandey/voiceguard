/* ============================================================
   Shared API client + auth/session + page chrome helpers.
   Loaded by every page before its page-specific script.
   ============================================================ */

const API_BASE = "/api";
const TOKEN_KEY = "aas_token";
const USER_KEY = "aas_user";

/* ---------- Token / session ---------- */

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/* ---------- Low-level fetch ---------- */

async function apiFetch(path, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  if (getToken()) headers["Authorization"] = "Bearer " + getToken();
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(API_BASE + path, { ...options, headers });
  } catch (err) {
    throw new Error("Cannot reach server. Is the backend running?");
  }

  if (response.status === 401) {
    clearSession();
    const returnTo = encodeURIComponent(location.pathname + location.search);
    location.href = "/index.html?returnTo=" + returnTo;
    throw new Error("Session expired. Please sign in again.");
  }

  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  }

  if (!response.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      "Request failed (" + response.status + ")";
    const error = new Error(message);
    error.status = response.status;
    error.details = data && data.details;
    throw error;
  }
  return data;
}

/* Convenience wrappers */
function apiGet(path) { return apiFetch(path); }
function apiPost(path, body) {
  return apiFetch(path, { method: "POST", body: JSON.stringify(body) });
}
function apiPut(path, body) {
  return apiFetch(path, { method: "PUT", body: JSON.stringify(body) });
}
function apiDelete(path) { return apiFetch(path, { method: "DELETE" }); }

/* ---------- Login guard for protected pages ---------- */

function requireLoginPage() {
  if (!getToken()) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    location.href = "/index.html?returnTo=" + returnTo;
  }
}

/* ---------- Shared page chrome (nav + auth header) ---------- */

const NAV_LINKS = [
  { href: "/dashboard.html", label: "Dashboard" },
  { href: "/upload.html", label: "Upload Attendance" },
  { href: "/attendance.html", label: "Attendance Records" },
  { href: "/absentees.html", label: "Absentees" },
  { href: "/notifications.html", label: "Notifications" },
  { href: "/students.html", label: "Students" },
  { href: "/reports.html", label: "Reports" },
];

function renderNav() {
  const nav = document.querySelector(".topbar nav");
  if (!nav) return;
  const here = location.pathname.split("/").pop() || "index.html";
  nav.innerHTML = NAV_LINKS.map(
    (link) =>
      `<a href="${link.href}" class="${here === link.href.split("/").pop() ? "active" : ""}">${link.label}</a>`
  ).join("");
}

function renderUserBox() {
  const box = document.getElementById("userBox");
  if (!box) return;
  const user = getSavedUser();
  if (!user) return;
  box.innerHTML = `
    <span>${escapeHtml(user.full_name)} (${escapeHtml(user.role)})</span>
    <button class="btn btn-sm btn-secondary" id="logoutBtn">Logout</button>`;
  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    location.href = "/index.html";
  });
}

/** Call on every protected page: document.addEventListener("DOMContentLoaded", initPage) */
function initProtectedPage() {
  requireLoginPage();
  renderNav();
  renderUserBox();
}

/* ---------- Small DOM/format helpers ---------- */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function statusBadge(status) {
  const map = {
    Present: "badge-success", Absent: "badge-danger",
    "Simulated Sent": "badge-info", Sent: "badge-success",
    Failed: "badge-danger", Pending: "badge-warning", "Not Sent": "badge-muted",
  };
  const cls = map[status] || "badge-muted";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

/* ---------- Modal ---------- */

function openModal(title, bodyHtml, actionsHtml = "") {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modalOverlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close" onclick="closeModal()" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${actionsHtml ? `<div class="modal-actions">${actionsHtml}</div>` : ""}
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
}

function closeModal() {
  const existing = document.getElementById("modalOverlay");
  if (existing) existing.remove();
}

/* ---------- Simple inline alerts ---------- */

function showAlert(selector, message, kind = "error") {
  const box = document.querySelector(selector);
  if (!box) return;
  box.className = `alert alert-${kind}`;
  box.textContent = message;
  box.classList.remove("hidden");
}

function clearAlert(selector) {
  const box = document.querySelector(selector);
  if (!box) return;
  box.classList.add("hidden");
  box.textContent = "";
}
