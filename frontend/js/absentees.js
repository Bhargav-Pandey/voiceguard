/* Absentees page: list, view message, send / resend notifications */

document.addEventListener("DOMContentLoaded", () => {
  initProtectedPage();
  document.getElementById("date").value = todayISO();
  loadSubjects();
  loadAbsentees();

  document.getElementById("loadBtn").addEventListener("click", loadAbsentees);
  document.getElementById("date").addEventListener("change", loadAbsentees);
});

async function loadSubjects() {
  try {
    const data = await apiGet("/subjects");
    const select = document.getElementById("subject");
    data.items.forEach((s) => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = `${s.code} — ${s.name}`;
      select.appendChild(option);
    });
    const preset = getQueryParam("subject_id");
    if (preset) select.value = preset;
  } catch { /* non-fatal */ }
}

async function loadAbsentees() {
  const body = document.getElementById("absenteesBody");
  body.innerHTML = `<tr><td colspan="8" class="loading">Loading…</td></tr>`;

  const params = new URLSearchParams();
  const date = document.getElementById("date").value;
  const subject = document.getElementById("subject").value;
  if (date) params.set("date", date);
  if (subject) params.set("subject_id", subject);
  document.getElementById("subtitle").textContent =
    "Absent students for " + (date ? formatDate(date) : "all dates");

  try {
    const data = await apiGet("/attendance/absentees?" + params);
    if (!data.items.length) {
      body.innerHTML = `<tr><td colspan="8" class="empty-state">No absentees for this date. 🎉</td></tr>`;
      return;
    }
    body.innerHTML = data.items.map(renderRow).join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderRow(item) {
  const notifId = item.notification_id;
  const status = item.notification_status;
  const actions = [];
  actions.push(`<button class="btn btn-sm btn-secondary" onclick="viewMessage(${notifId ?? "null"}, '${escapeHtml(item.roll_number)}')">View Message</button>`);
  if (notifId && status === "Pending") {
    actions.push(`<button class="btn btn-sm btn-primary" onclick="resend(${notifId}, this)">Send</button>`);
  } else if (notifId && (status === "Failed" || status === "Simulated Sent")) {
    actions.push(`<button class="btn btn-sm btn-secondary" onclick="resend(${notifId}, this)">Resend</button>`);
  } else if (!notifId) {
    actions.push(`<button class="btn btn-sm btn-primary" onclick="generateFor('${item.date}', ${item.lecture_number})">Send</button>`);
  }
  return `
    <tr>
      <td>${escapeHtml(item.roll_number)}</td>
      <td>${escapeHtml(item.student_name)}</td>
      <td>${escapeHtml(item.subject_code)}</td>
      <td>${formatDate(item.date)}</td>
      <td>#${item.lecture_number}</td>
      <td>${escapeHtml(item.parent_name)}<br/><span class="text-muted">${escapeHtml(item.parent_mobile)}</span></td>
      <td>${statusBadge(status)}</td>
      <td class="text-right">${actions.join(" ")}</td>
    </tr>`;
}

/* View the stored notification message (or a preview if none exists). */
async function viewMessage(notifId, rollNumber) {
  if (!notifId) {
    openModal(
      "Notification message",
      `<p>No notification has been generated yet for roll ${escapeHtml(rollNumber)}.</p>
       <p class="text-muted">Use "Send" to generate one from the attendance record.</p>`
    );
    return;
  }
  try {
    const log = await apiGet(`/notifications/${notifId}`);
    const body = `
      <p><strong>${escapeHtml(log.subject_code)} — ${escapeHtml(log.subject_name)}</strong>, Lecture ${log.lecture_number}, ${formatDate(log.date)}</p>
      <p>To: <strong>${escapeHtml(log.parent_name)}</strong> (${escapeHtml(log.parent_mobile)}) · ${statusBadge(log.status)}</p>
      <hr style="border:none;border-top:1px solid var(--border);margin:12px 0" />
      <div>${escapeHtml(log.message).replace(/\n/g, "<br/>")}</div>`;
    const actions =
      log.status === "Pending" || log.status === "Failed"
        ? `<button class="btn btn-primary" onclick="closeModal();resend(${log.id})">Resend</button>`
        : "";
    openModal("Notification message", body, actions);
  } catch (err) {
    openModal("Error", `<p>${escapeHtml(err.message)}</p>`);
  }
}

/* Resend (or send) an existing notification. */
async function resend(notifId, btn) {
  if (btn) { btn.disabled = true; }
  try {
    const result = await apiPost(`/notifications/${notifId}/resend`, {});
    statusBadge; // no-op to keep linter calm about the helper
    openModal(
      "Delivery result",
      `<p>Status: ${statusBadge(result.status)}</p>
       <p class="text-muted">In demo mode, messages are marked "Simulated Sent" and are not really delivered.</p>`
    );
    loadAbsentees();
  } catch (err) {
    openModal("Cannot resend", `<p>${escapeHtml(err.message)}</p>`);
    if (btn) btn.disabled = false;
  }
}

/* Generate notifications for every absentee of one lecture. */
async function generateFor(dateStr, lectureNumber) {
  try {
    // Find the lecture id for this date/number, then trigger generation via resend-safe confirm.
    const lectures = await apiGet(`/attendance/lectures?date=${dateStr}`);
    const lecture = lectures.items.find((l) => l.lecture_number === Number(lectureNumber));
    if (!lecture) throw new Error("Lecture not found");
    const result = await apiPost("/notifications/generate", { lecture_id: lecture.id });
    openModal(
      "Notifications generated",
      `<p>Generated: <strong>${result.generated}</strong><br/>
       Simulated Sent: <strong>${result.simulated_sent}</strong><br/>
       Failed: <strong>${result.failed}</strong><br/>
       Skipped (already notified): <strong>${result.skipped_existing}</strong></p>`
    );
    loadAbsentees();
  } catch (err) {
    openModal("Error", `<p>${escapeHtml(err.message)}</p>`);
  }
}
