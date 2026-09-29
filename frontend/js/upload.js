/* Upload workflow: validate -> preview -> confirm -> result */

let previewPayload = null;
let subjects = [];

document.addEventListener("DOMContentLoaded", () => {
  initProtectedPage();
  document.getElementById("date").value = todayISO();
  loadSubjects();

  document.getElementById("uploadForm").addEventListener("submit", validateUpload);
  document.getElementById("confirmBtn").addEventListener("click", confirmImport);
  document.getElementById("cancelBtn").addEventListener("click", resetToStep1);
  document.getElementById("uploadAnotherBtn").addEventListener("click", resetToStep1);
});

async function loadSubjects() {
  try {
    const data = await apiGet("/subjects");
    subjects = data.items;
    const select = document.getElementById("subject");
    select.innerHTML =
      '<option value="">Select subject…</option>' +
      subjects
        .map((s) => `<option value="${s.id}">${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>`)
        .join("");
  } catch (err) {
    showAlert("#uploadAlert", "Could not load subjects: " + err.message);
  }
}

async function validateUpload(e) {
  e.preventDefault();
  clearAlert("#uploadAlert");

  const form = e.target;
  const fileInput = document.getElementById("file");
  if (!fileInput.files.length) {
    showAlert("#uploadAlert", "Please choose an Excel file.");
    return;
  }

  const btn = document.getElementById("validateBtn");
  btn.disabled = true;
  btn.textContent = "Validating…";

  try {
    const body = new FormData();
    body.append("file", fileInput.files[0]);
    body.append("subject_id", document.getElementById("subject").value);
    body.append("date", document.getElementById("date").value);
    body.append("lecture_number", document.getElementById("lectureNumber").value);
    body.append("start_time", document.getElementById("startTime").value);
    body.append("end_time", document.getElementById("endTime").value);

    previewPayload = await apiFetch("/attendance/upload", { method: "POST", body });
    renderPreview();
  } catch (err) {
    showAlert("#uploadAlert", err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Validate & Preview";
  }
}

function renderPreview() {
  const s = previewPayload.summary;
  const summaryHtml = `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
      <div class="stat-card"><div class="stat-label">Total Rows</div><div class="stat-value">${s.total_rows}</div></div>
      <div class="stat-card tone-success"><div class="stat-label">Valid Rows</div><div class="stat-value">${s.valid_rows}</div></div>
      <div class="stat-card tone-primary"><div class="stat-label">Present</div><div class="stat-value">${s.present}</div></div>
      <div class="stat-card tone-danger"><div class="stat-label">Absent</div><div class="stat-value">${s.absent}</div></div>
      <div class="stat-card tone-warning"><div class="stat-label">Errors</div><div class="stat-value">${s.error_rows}</div></div>
    </div>`;

  // Row-level validation errors
  const errorsBox = document.getElementById("previewErrors");
  if (previewPayload.errors.length) {
    errorsBox.innerHTML =
      "<strong>Validation errors (these rows will be skipped):</strong><br>" +
      previewPayload.errors
        .map((e) => `Row ${e.row}: ${escapeHtml(e.error)}`)
        .join("<br>");
    errorsBox.classList.remove("hidden");
  } else {
    errorsBox.classList.add("hidden");
  }

  // Students not found in the database
  const unknownBox = document.getElementById("unknownStudents");
  if (previewPayload.invalid_students.length) {
    unknownBox.className = "alert alert-info";
    unknownBox.innerHTML =
      "<strong>Not found in student database (will be skipped):</strong><br>" +
      previewPayload.invalid_students
        .map((u) => `Row ${u.row}: Roll ${escapeHtml(u.roll_number)} — ${escapeHtml(u.student_name)}`)
        .join("<br>");
    unknownBox.classList.remove("hidden");
  } else {
    unknownBox.classList.add("hidden");
  }

  document.getElementById("previewSummary").innerHTML = summaryHtml;
  document.getElementById("previewBody").innerHTML = previewPayload.valid_rows
    .map(
      (r) => `
      <tr>
        <td>${r.row}</td>
        <td>${escapeHtml(r.roll_number)}</td>
        <td>${escapeHtml(r.student_name)}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`
    )
    .join("");

  document.getElementById("uploadCard").classList.add("hidden");
  document.getElementById("previewCard").classList.remove("hidden");
  document.getElementById("previewCard").scrollIntoView({ behavior: "smooth" });
}

async function confirmImport() {
  const btn = document.getElementById("confirmBtn");
  btn.disabled = true;
  btn.textContent = "Importing…";

  try {
    const subjectId = document.getElementById("subject").value;
    const result = await apiPost("/attendance/confirm", {
      subject_id: Number(subjectId),
      date: document.getElementById("date").value,
      lecture_number: Number(document.getElementById("lectureNumber").value),
      start_time: document.getElementById("startTime").value,
      end_time: document.getElementById("endTime").value,
      rows: previewPayload.valid_rows,
    });
    renderResult(result);
  } catch (err) {
    showAlert("#uploadAlert", "Import failed: " + err.message);
    document.getElementById("previewCard").classList.add("hidden");
    document.getElementById("uploadCard").classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm Import";
  }
}

function renderResult(result) {
  const notifications = result.notifications || {};
  const invalidCount = result.invalid_students.length;

  document.getElementById("resultSummary").innerHTML = `
    <div class="alert alert-success">Attendance imported.</div>
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
      <div class="stat-card"><div class="stat-label">Stored</div><div class="stat-value">${result.stored}</div></div>
      <div class="stat-card"><div class="stat-label">Updated</div><div class="stat-value">${result.updated}</div></div>
      <div class="stat-card tone-primary"><div class="stat-label">Present</div><div class="stat-value">${result.present}</div></div>
      <div class="stat-card tone-danger"><div class="stat-label">Absent</div><div class="stat-value">${result.absent}</div></div>
      <div class="stat-card tone-warning"><div class="stat-label">Skipped</div><div class="stat-value">${invalidCount}</div></div>
    </div>
    <h2 class="mt-2">Notifications</h2>
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
      <div class="stat-card"><div class="stat-label">Generated</div><div class="stat-value">${notifications.generated ?? 0}</div></div>
      <div class="stat-card tone-success"><div class="stat-label">Simulated Sent</div><div class="stat-value">${notifications.simulated_sent ?? 0}</div></div>
      <div class="stat-card tone-danger"><div class="stat-label">Failed</div><div class="stat-value">${notifications.failed ?? 0}</div></div>
      <div class="stat-card tone-warning"><div class="stat-label">Skipped (already notified)</div><div class="stat-value">${notifications.skipped_existing ?? 0}</div></div>
    </div>`;

  const dateStr = document.getElementById("date").value;
  const subjectId = document.getElementById("subject").value;
  document.getElementById("resultAbsenteesLink").href =
    `/absentees.html?date=${dateStr}&subject_id=${subjectId}`;
  document.getElementById("resultNotificationsLink").href = "/notifications.html";
  document.getElementById("resultReportLink").href = `/api/reports/daily?date=${dateStr}`;

  document.getElementById("previewCard").classList.add("hidden");
  document.getElementById("resultCard").classList.remove("hidden");
  document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" });
}

function resetToStep1() {
  previewPayload = null;
  document.getElementById("resultCard").classList.add("hidden");
  document.getElementById("previewCard").classList.add("hidden");
  document.getElementById("uploadCard").classList.remove("hidden");
  document.getElementById("uploadForm").reset();
  document.getElementById("date").value = todayISO();
  clearAlert("#uploadAlert");
}
