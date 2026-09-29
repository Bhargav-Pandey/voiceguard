/* Student management: list, add/edit modal, deactivate */

document.addEventListener("DOMContentLoaded", () => {
  initProtectedPage();
  loadStudents();

  document.getElementById("applyBtn").addEventListener("click", loadStudents);
  document.getElementById("search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadStudents();
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    ["search", "semester", "division"].forEach((id) => (document.getElementById(id).value = ""));
    loadStudents();
  });
  document.getElementById("addStudentBtn").addEventListener("click", () => openEditor(null));
});

async function loadStudents() {
  const body = document.getElementById("studentsBody");
  body.innerHTML = `<tr><td colspan="9" class="loading">Loading…</td></tr>`;

  const params = new URLSearchParams();
  const search = document.getElementById("search").value.trim();
  const semester = document.getElementById("semester").value;
  const division = document.getElementById("division").value;
  if (search) params.set("search", search);
  if (semester) params.set("semester", semester);
  if (division) params.set("division", division);

  try {
    const data = await apiGet("/students?" + params);
    if (!data.items.length) {
      body.innerHTML = `<tr><td colspan="9" class="empty-state">No students found. Add one to get started.</td></tr>`;
      return;
    }
    body.innerHTML = data.items
      .map(
        (s) => `
        <tr>
          <td>${escapeHtml(s.roll_number)}</td>
          <td>${escapeHtml(s.name)}</td>
          <td>${escapeHtml(s.branch)}</td>
          <td>${s.semester}</td>
          <td>${escapeHtml(s.division)}</td>
          <td>${escapeHtml(s.parent_name)}</td>
          <td>${escapeHtml(s.parent_mobile)}</td>
          <td>${s.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-secondary" onclick='openEditor(${JSON.stringify(s)})'>Edit</button>
            ${s.is_active ? `<button class="btn btn-sm btn-danger" onclick="deactivate(${s.id}, '${escapeHtml(s.name)}')">Deactivate</button>` : ""}
          </td>
        </tr>`
      )
      .join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="9" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
  }
}

function openEditor(student) {
  const isEdit = !!student;
  const s = student || {
    roll_number: "", name: "", branch: "", semester: 1, division: "A",
    parent_name: "", parent_mobile: "", parent_email: "",
  };
  const body = `
    <form id="studentForm">
      <div class="form-grid">
        <div class="field"><label>Roll No</label><input name="roll_number" value="${escapeHtml(s.roll_number)}" required /></div>
        <div class="field"><label>Full Name</label><input name="name" value="${escapeHtml(s.name)}" required /></div>
        <div class="field"><label>Branch</label><input name="branch" value="${escapeHtml(s.branch)}" required /></div>
        <div class="field"><label>Semester</label>
          <select name="semester">
            ${[1,2,3,4,5,6,7,8].map((n) => `<option value="${n}" ${n === s.semester ? "selected" : ""}>${n}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Division</label>
          <select name="division">
            ${["A","B","C"].map((d) => `<option value="${d}" ${d === s.division ? "selected" : ""}>${d}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Parent/Guardian Name</label><input name="parent_name" value="${escapeHtml(s.parent_name)}" required /></div>
        <div class="field"><label>Parent Mobile</label><input name="parent_mobile" value="${escapeHtml(s.parent_mobile)}" required placeholder="10-15 digits" /></div>
        <div class="field"><label>Parent Email (optional)</label><input name="parent_email" type="email" value="${escapeHtml(s.parent_email || "")}" /></div>
      </div>
      <div class="alert alert-error hidden mt-2" id="editorAlert"></div>
    </form>`;
  const actions = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" id="saveStudentBtn">${isEdit ? "Save Changes" : "Add Student"}</button>`;
  openModal(isEdit ? `Edit student — ${s.name}` : "Add student", body, actions);

  document.getElementById("saveStudentBtn").addEventListener("click", async () => {
    const form = document.getElementById("studentForm");
    const payload = Object.fromEntries(new FormData(form));
    payload.semester = Number(payload.semester);
    try {
      if (isEdit) {
        await apiPut("/students/" + student.id, payload);
      } else {
        await apiPost("/students", payload);
      }
      closeModal();
      loadStudents();
    } catch (err) {
      showAlert("#editorAlert", err.message);
    }
  });
}

async function deactivate(id, name) {
  if (!confirm(`Deactivate ${name}? Their attendance history is kept.`)) return;
  try {
    await apiDelete("/students/" + id);
    loadStudents();
  } catch (err) {
    alert(err.message);
  }
}
