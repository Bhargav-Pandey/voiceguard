/* Attendance records: filters, table, student history modal */

document.addEventListener("DOMContentLoaded", () => {
  initProtectedPage();
  loadSubjects();
  loadRecords();

  document.getElementById("applyBtn").addEventListener("click", loadRecords);
  document.getElementById("search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadRecords();
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    ["search", "subject", "status", "startDate", "endDate"].forEach(
      (id) => (document.getElementById(id).value = "")
    );
    loadRecords();
  });
  document.getElementById("exportBtn").addEventListener("click", () => {
    location.href = "/api/reports/overall";
  });
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
  } catch { /* non-fatal */ }
}

function buildParams() {
  const params = new URLSearchParams();
  const search = document.getElementById("search").value.trim();
  const subject = document.getElementById("subject").value;
  const status = document.getElementById("status").value;
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  if (search) params.set("search", search);
  if (subject) params.set("subject_id", subject);
  if (status) params.set("status", status);
  if (start) params.set("start_date", start);
  if (end) params.set("end_date", end);
  return params;
}

async function loadRecords() {
  const body = document.getElementById("recordsBody");
  body.innerHTML = `<tr><td colspan="8" class="loading">Loading…</td></tr>`;
  try {
    const data = await apiGet("/attendance?" + buildParams());
    if (!data.items.length) {
      body.innerHTML = `<tr><td colspan="8" class="empty-state">No attendance records found.</td></tr>`;
      return;
    }
    body.innerHTML = data.items
      .map(
        (r) => `
        <tr>
          <td>${escapeHtml(r.roll_number)}</td>
          <td>${escapeHtml(r.student_name)}</td>
          <td>${escapeHtml(r.subject_code)} — ${escapeHtml(r.subject_name)}</td>
          <td>${formatDate(r.date)}</td>
          <td>#${r.lecture_number}</td>
          <td>${escapeHtml(r.start_time)} – ${escapeHtml(r.end_time)}</td>
          <td>${statusBadge(r.status)}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-secondary" onclick="openHistory(${r.student_id ?? 0}, '${escapeHtml(r.roll_number)}')">History</button>
          </td>
        </tr>`
      )
      .join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
  }
}

/* The /attendance endpoint doesn't return student_id; look it up by roll. */
async function openHistory(studentId, rollNumber) {
  try {
    if (!studentId) {
      const found = await apiGet("/students?search=" + encodeURIComponent(rollNumber));
      if (found.items.length) studentId = found.items[0].id;
    }
    if (!studentId) {
      openModal("Student history", `<p>Student with roll ${escapeHtml(rollNumber)} not found.</p>`);
      return;
    }
    const data = await apiGet(`/students/${studentId}/history`);
    const rows = data.records
      .map(
        (h) => `
        <tr>
          <td>${formatDate(h.date)}</td>
          <td>#${h.lecture_number}</td>
          <td>${escapeHtml(h.subject_code)} — ${escapeHtml(h.subject_name)}</td>
          <td>${statusBadge(h.status)}</td>
        </tr>`
      )
      .join("");
    const body = `
      <p>
        <strong>${escapeHtml(data.student.name)}</strong> (Roll ${escapeHtml(data.student.roll_number)})<br/>
        ${escapeHtml(data.student.branch)}, Sem ${data.student.semester}, Div ${escapeHtml(data.student.division)}
      </p>
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card"><div class="stat-label">Lectures</div><div class="stat-value">${data.total}</div></div>
        <div class="stat-card tone-success"><div class="stat-label">Present</div><div class="stat-value">${data.present}</div></div>
        <div class="stat-card ${data.percentage < 75 ? "tone-danger" : "tone-primary"}">
          <div class="stat-label">Attendance</div><div class="stat-value">${data.percentage}%</div>
        </div>
      </div>
      <div class="table-wrap" style="max-height:320px;overflow-y:auto">
        <table>
          <thead><tr><th>Date</th><th>Lecture</th><th>Subject</th><th>Status</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4" class="empty-state">No records yet.</td></tr>`}</tbody>
        </table>
      </div>`;
    openModal(`Attendance history — ${data.student.name}`, body);
  } catch (err) {
    openModal("Error", `<p>${escapeHtml(err.message)}</p>`);
  }
}
