/* Dashboard: stats + today's lecture table */

document.addEventListener("DOMContentLoaded", () => {
  initProtectedPage();
  document.getElementById("filterDate").value = todayISO();

  loadSubjects();
  loadDashboard();

  ["filterDate", "filterSubject", "filterSemester", "filterDivision"].forEach((id) =>
    document.getElementById(id).addEventListener("change", loadDashboard)
  );
  document.getElementById("resetFilters").addEventListener("click", () => {
    document.getElementById("filterDate").value = todayISO();
    document.getElementById("filterSubject").value = "";
    document.getElementById("filterSemester").value = "";
    document.getElementById("filterDivision").value = "";
    loadDashboard();
  });
});

async function loadSubjects() {
  try {
    const data = await apiGet("/subjects");
    const select = document.getElementById("filterSubject");
    data.items.forEach((s) => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = `${s.code} — ${s.name}`;
      select.appendChild(option);
    });
  } catch { /* non-fatal */ }
}

function filterParams() {
  const params = new URLSearchParams();
  const date = document.getElementById("filterDate").value;
  const subject = document.getElementById("filterSubject").value;
  const semester = document.getElementById("filterSemester").value;
  const division = document.getElementById("filterDivision").value;
  if (date) params.set("date", date);
  if (subject) params.set("subject_id", subject);
  if (semester) params.set("semester", semester);
  if (division) params.set("division", division);
  return params;
}

async function loadDashboard() {
  clearAlert("#statsAlert");
  try {
    const stats = await apiGet("/attendance/stats?" + filterParams());
    document.getElementById("statStudents").textContent = stats.total_students;
    document.getElementById("statLectures").textContent = stats.lectures_today;
    document.getElementById("statPresent").textContent = stats.present_today;
    document.getElementById("statAbsent").textContent = stats.absent_today;
    document.getElementById("statNotifGen").textContent = stats.notifications_generated;
    document.getElementById("statNotifSent").textContent = stats.notifications_sent;
    document.getElementById("statNotifFailed").textContent = stats.notifications_failed;
    document.getElementById("statAverage").textContent = stats.average_attendance + "%";
    await loadLectures();
  } catch (err) {
    showAlert("#statsAlert", err.message);
  }
}

async function loadLectures() {
  const body = document.getElementById("lecturesBody");
  const params = filterParams();
  params.set("with_counts", "1");
  try {
    const data = await apiGet("/attendance/lectures?" + params);
    if (!data.items.length) {
      body.innerHTML = `<tr><td colspan="6" class="empty-state">No lectures found for this date.</td></tr>`;
      return;
    }
    body.innerHTML = data.items
      .map(
        (l) => `
        <tr>
          <td>${escapeHtml(l.subject_code)} — ${escapeHtml(l.subject_name)}</td>
          <td>#${l.lecture_number}</td>
          <td>${escapeHtml(l.start_time)} – ${escapeHtml(l.end_time)}</td>
          <td>${l.present_count}</td>
          <td>${l.absent_count}</td>
          <td class="text-right">
            <a class="btn btn-sm btn-secondary" href="/absentees.html?date=${l.date}&subject_id=${l.subject_id}">Absentees</a>
          </td>
        </tr>`
      )
      .join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
  }
}
