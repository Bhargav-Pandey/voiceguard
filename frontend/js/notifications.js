/* Notifications page: history with filters and message viewer */

document.addEventListener("DOMContentLoaded", () => {
  initProtectedPage();
  loadRecords();

  document.getElementById("applyBtn").addEventListener("click", loadRecords);
  document.getElementById("search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadRecords();
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    ["search", "status", "startDate", "endDate"].forEach(
      (id) => (document.getElementById(id).value = "")
    );
    loadRecords();
  });
  document.getElementById("exportBtn").addEventListener("click", () => {
    location.href = "/api/reports/notifications";
  });
});

function buildParams() {
  const params = new URLSearchParams();
  const search = document.getElementById("search").value.trim();
  const status = document.getElementById("status").value;
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (start) params.set("start_date", start);
  if (end) params.set("end_date", end);
  return params;
}

async function loadRecords() {
  const body = document.getElementById("notifBody");
  body.innerHTML = `<tr><td colspan="9" class="loading">Loading…</td></tr>`;
  try {
    const data = await apiGet("/notifications?" + buildParams());
    if (!data.items.length) {
      body.innerHTML = `<tr><td colspan="9" class="empty-state">No notifications yet. Upload attendance to generate them.</td></tr>`;
      return;
    }
    body.innerHTML = data.items
      .map(
        (n) => `
        <tr>
          <td>${escapeHtml(n.student_name)} <span class="text-muted">(#${escapeHtml(n.subject_code)} L${n.lecture_number})</span></td>
          <td>${escapeHtml(n.parent_name)}<br/><span class="text-muted">${escapeHtml(n.parent_mobile)}</span></td>
          <td>${escapeHtml(n.subject_code)}</td>
          <td>${formatDate(n.date)}</td>
          <td>#${n.lecture_number}</td>
          <td>${escapeHtml(n.channel)}</td>
          <td>${statusBadge(n.status)}</td>
          <td>${formatDateTime(n.sent_at) || "—"}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-secondary" onclick="viewMessage(${n.id})">View</button>
          </td>
        </tr>`
      )
      .join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="9" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function viewMessage(id) {
  try {
    const log = await apiGet(`/notifications/${id}`);
    const body = `
      <p><strong>${escapeHtml(log.subject_code)} — ${escapeHtml(log.subject_name)}</strong>, Lecture ${log.lecture_number}, ${formatDate(log.date)}</p>
      <p>To: <strong>${escapeHtml(log.parent_name)}</strong> (${escapeHtml(log.parent_mobile)}) · ${statusBadge(log.status)}</p>
      ${log.failure_reason ? `<div class="alert alert-error">Failure reason: ${escapeHtml(log.failure_reason)}</div>` : ""}
      <hr style="border:none;border-top:1px solid var(--border);margin:12px 0" />
      <div>${escapeHtml(log.message).replace(/\n/g, "<br/>")}</div>
      <p class="text-muted mt-2" style="font-size:13px">
        Created: ${formatDateTime(log.created_at) || "—"} · Sent: ${formatDateTime(log.sent_at) || "—"}
      </p>`;
    openModal("Notification message", body);
  } catch (err) {
    openModal("Error", `<p>${escapeHtml(err.message)}</p>`);
  }
}
