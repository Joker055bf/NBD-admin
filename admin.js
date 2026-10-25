const firebaseConfig = window.firebaseConfig || {};
const firebaseReady = typeof firebase !== "undefined"
  && Object.values(firebaseConfig).every((value) => typeof value === "string" && value.trim());
const auth = firebaseReady ? firebase.auth() : null;
const db = firebaseReady ? firebase.firestore() : null;
const loginPanel = document.getElementById("adminLoginPanel");
const dashboard = document.getElementById("adminDashboard");
const toast = document.getElementById("adminToast");
const adminAuthDomain = "admin.nbda-1ee36.firebaseapp.com";
let signedInAdmin = null;
let signedInProfile = null;
let currentRole = null;
let leaderTeam = null;
let leaderMembers = [];
let leaderInitiatives = [];
let leaderParticipants = [];
let editingInitiativeRequestId = null;
let toastTimer;

const roleLabels = {
  admin: "المؤسس",
  leader: "قائد الفريق",
  staff: "إدارة العمل التطوعي",
  executive: "الإدارة التنفيذية"
};

const roleDescriptions = {
  admin: "إدارة المنصة وجميع مساراتها.",
  leader: "إدارة فريقك ومبادراته وتقاريره.",
  staff: "إدارة الفرق ومراجعة المبادرات والتقارير والساعات.",
  executive: "متابعة الأداء العام وإدارة رتب المستخدمين المحددة."
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 4000);
}

function errorMessage(error) {
  const messages = {
    "auth/invalid-credential": "بيانات الدخول غير صحيحة.",
    "auth/invalid-email": "اسم المستخدم غير صالح.",
    "auth/configuration-not-found": "تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في Firebase Authentication. فعّل Email/Password من إعدادات تسجيل الدخول في Firebase Console.",
    "auth/too-many-requests": "محاولات كثيرة. حاول بعد قليل.",
    "auth/network-request-failed": "تعذر الاتصال. تحقق من الإنترنت.",
    "permission-denied": "رفضت قواعد Firestore العملية. تحقق من دور المسؤول والقواعد المنشورة.",
    "firestore/permission-denied": "رفضت قواعد Firestore العملية. تحقق من دور المسؤول والقواعد المنشورة."
  };
  return messages[error.code] || error.message || "حدث خطأ غير متوقع.";
}

async function verifyAdmin(user) {
  const profile = await db.collection("adminAccounts").doc(user.uid).get();
  if (profile.exists && profile.data().role === "admin") {
    signedInProfile = profile.data();
    currentRole = "admin";
  } else {
    const volunteerProfile = await db.collection("volunteers").doc(user.uid).get();
    if (!volunteerProfile.exists || !["leader", "staff", "executive"].includes(volunteerProfile.data().role)) {
      await auth.signOut();
      loginPanel.hidden = false;
      dashboard.hidden = true;
      showToast("هذا الحساب لا يملك صلاحية دخول بوابة الإدارة. استخدم الموقع العام إذا كنت متطوعًا.");
      return false;
    }
    signedInProfile = volunteerProfile.data();
    currentRole = signedInProfile.role;
  }
  if (!currentRole) {
    await auth.signOut();
    loginPanel.hidden = false;
    dashboard.hidden = true;
    return false;
  }
  signedInAdmin = user;
  document.getElementById("adminSessionName").textContent = signedInProfile.displayName || user.email;
  document.getElementById("dashboardRoleLabel").textContent = roleLabels[currentRole];
  document.getElementById("dashboardRoleDescription").textContent = roleDescriptions[currentRole];
  document.querySelectorAll("[data-role-panel]").forEach((panel) => {
    const allowedRoles = panel.dataset.rolePanel.split(/\s+/);
    panel.hidden = currentRole === "admin"
      ? !allowedRoles.some((role) => ["admin", "staff", "executive"].includes(role))
      : !allowedRoles.includes(currentRole);
  });
  loginPanel.hidden = true;
  dashboard.hidden = false;
  await loadDashboard();
  return true;
}

document.getElementById("adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!firebaseReady) {
    showToast("أضف إعدادات Firebase إلى firebase-config.js أولًا.");
    return;
  }
  const loginName = document.getElementById("adminUsername").value.trim();
  const email = loginName.toLowerCase() === "yasser"
    ? `yasser@${adminAuthDomain}`
    : loginName;
  if (loginName.toLowerCase() !== "yasser" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("أدخل Yasser لحساب المؤسس أو البريد الإلكتروني المسجل للحساب.");
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, document.getElementById("adminPassword").value);
  } catch (error) {
    showToast(errorMessage(error));
  }
});

document.getElementById("adminLogoutButton").addEventListener("click", async () => {
  try {
    await auth.signOut();
    signedInAdmin = null;
    signedInProfile = null;
    currentRole = null;
    dashboard.hidden = true;
    loginPanel.hidden = false;
    document.getElementById("adminLoginForm").reset();
  } catch (error) {
    showToast(errorMessage(error));
  }
});

async function loadDashboard() {
  if (!signedInAdmin) return;
  try {
    if (currentRole === "admin") {
      await Promise.all([loadFounderDashboard(), loadStaffDashboard(), loadExecutiveDashboard()]);
    } else if (currentRole === "leader") {
      await loadLeaderDashboard();
    } else if (currentRole === "staff") {
      await loadStaffDashboard();
    } else if (currentRole === "executive") {
      await loadExecutiveDashboard();
    }
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function loadFounderDashboard() {
  const [volunteersSnapshot, administratorsSnapshot, initiativesSnapshot, requestsSnapshot] = await Promise.all([
    db.collection("volunteers").get(),
    db.collection("adminAccounts").get(),
    db.collection("initiatives").orderBy("date", "desc").get(),
    db.collection("participationRequests").orderBy("createdAt", "desc").get()
  ]);
  document.getElementById("adminVolunteerCount").textContent = String(volunteersSnapshot.size);
  document.getElementById("adminInitiativeCount").textContent = String(initiativesSnapshot.size);
  document.getElementById("adminRequestCount").textContent = String(
    requestsSnapshot.docs.filter((item) => item.data().status === "pending").length
  );
  renderUsers(volunteersSnapshot.docs, administratorsSnapshot.docs);
  renderInitiatives(initiativesSnapshot.docs);
  renderRequests(requestsSnapshot.docs);
}
function renderUsers(volunteers, administrators) {
  const rows = document.getElementById("adminUserRows");
  rows.replaceChildren();
  const accounts = [
    ...volunteers.map((document) => ({ document, collection: "volunteers" })),
    ...administrators.map((document) => ({ document, collection: "adminAccounts" }))
  ].filter(({ document }) => document.id !== signedInAdmin.uid);
  document.getElementById("usersEmpty").hidden = accounts.length > 0;
  accounts.forEach(({ document: userDocument, collection }) => {
    const user = userDocument.data();
    const row = document.createElement("tr");
    const name = document.createElement("td");
    name.textContent = user.displayName || "متطوع";
    const email = document.createElement("td");
    email.textContent = user.email || "";
    const roleCell = document.createElement("td");
    if (collection === "adminAccounts") {
      roleCell.textContent = "مؤسس النظام";
      const actionCell = document.createElement("td");
      actionCell.textContent = "صلاحية ثابتة";
      [name, email, roleCell, actionCell].forEach((cell) => row.append(cell));
      rows.append(row);
      return;
    }

    const role = document.createElement("select");
    role.className = "user-role-select";
    role.setAttribute("aria-label", `صلاحية ${user.displayName || user.email}`);
    const roles = [
      ["volunteer", "متطوع", "المشاركة في الفرص المنشورة فقط."],
      ["leader", "قائد الفريق", "صلاحيات الفريق المرتبط به فقط."],
      ["staff", "إدارة العمل التطوعي", "إدارة الفرق ومراجعة المبادرات والتقارير والشهادات والساعات."],
      ["executive", "الإدارة التنفيذية", "الاطلاع العام وإدارة المستخدمين والرتب، دون صلاحية إنشاء مؤسس."]
    ];
    roles.forEach(([value, label, description]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.title = description;
      option.selected = user.role === value;
      role.append(option);
    });
    roleCell.append(role);
    const teamId = document.createElement("input");
    teamId.className = "dialog-input";
    teamId.type = "text";
    teamId.value = user.teamId || "";
    teamId.placeholder = "معرّف الفريق لقائد الفريق";
    teamId.setAttribute("aria-label", `معرّف فريق ${user.displayName || user.email}`);
    teamId.hidden = user.role !== "leader";
    role.addEventListener("change", () => {
      teamId.hidden = role.value !== "leader";
    });
    roleCell.append(teamId);
    const actionCell = document.createElement("td");
    const save = document.createElement("button");
    save.type = "button";
    save.className = "role-save-button";
    save.textContent = "حفظ";
    save.addEventListener("click", async () => {
      try {
        const newRole = role.value;
        const changes = { role: newRole };
        if (newRole === "leader") {
          if (!teamId.value.trim()) {
            showToast("اربط قائد الفريق بمعرّف فريق موجود قبل حفظ الرتبة.");
            return;
          }
          changes.teamId = teamId.value.trim();
        } else if (user.teamId) {
          changes.teamId = firebase.firestore.FieldValue.delete();
        }
        await userDocument.ref.update(changes);
        showToast(`تم تحديث صلاحية ${user.displayName || user.email}.`);
        await loadDashboard();
      } catch (error) {
        showToast(errorMessage(error));
      }
    });
    actionCell.append(save);
    [name, email, roleCell, actionCell].forEach((cell) => row.append(cell));
    rows.append(row);
  });
}

function renderInitiatives(initiatives) {
  const rows = document.getElementById("adminInitiativeRows");
  rows.replaceChildren();
  document.getElementById("initiativesEmpty").hidden = initiatives.length > 0;
  initiatives.forEach((item) => {
    const initiative = item.data();
    const row = document.createElement("tr");
    const title = document.createElement("td");
    title.textContent = initiative.title || "مبادرة";
    const date = document.createElement("td");
    date.textContent = initiative.date || "—";
    const status = document.createElement("td");
    status.textContent = initiative.status === "open" ? "التسجيل مفتوح" : "مغلقة";
    const publishedCell = document.createElement("td");
    const published = document.createElement("input");
    published.type = "checkbox";
    published.checked = initiative.published === true;
    published.setAttribute("aria-label", `نشر ${initiative.title}`);
    published.addEventListener("change", async () => {
      try {
        await db.collection("initiatives").doc(item.id).update({ published: published.checked });
        showToast(published.checked ? "ظهرت المبادرة في الموقع العام." : "تم إخفاء المبادرة من الموقع العام.");
      } catch (error) {
        published.checked = !published.checked;
        showToast(errorMessage(error));
      }
    });
    publishedCell.append(published);
    [title, date, status, publishedCell].forEach((cell) => row.append(cell));
    rows.append(row);
  });
}

function renderRequests(requests) {
  const rows = document.getElementById("participationRows");
  rows.replaceChildren();
  document.getElementById("requestsEmpty").hidden = requests.length > 0;
  requests.forEach((item) => {
    const request = item.data();
    const row = document.createElement("tr");
    const volunteer = document.createElement("td");
    volunteer.textContent = request.volunteerName || request.volunteerEmail || "متطوع";
    const initiative = document.createElement("td");
    initiative.textContent = request.initiativeName || "مبادرة";
    const status = document.createElement("td");
    status.textContent = request.status === "pending" ? "قيد المراجعة" : request.status === "accepted" ? "مقبول" : "مرفوض";
    const action = document.createElement("td");
    if (request.status === "pending") {
      const select = document.createElement("select");
      select.className = "user-role-select";
      select.setAttribute("aria-label", "قرار طلب المشاركة");
      [["accepted", "قبول"], ["rejected", "رفض"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.append(option);
      });
      const save = document.createElement("button");
      save.type = "button";
      save.className = "role-save-button";
      save.textContent = "اعتماد";
      save.addEventListener("click", async () => {
        try {
          await db.collection("participationRequests").doc(item.id).update({ status: select.value });
          showToast("تم تحديث حالة طلب المشاركة.");
          await loadDashboard();
        } catch (error) {
          showToast(errorMessage(error));
        }
      });
      action.append(select, save);
    } else {
      action.textContent = "—";
    }
    [volunteer, initiative, status, action].forEach((cell) => row.append(cell));
    rows.append(row);
  });
}

function rowCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value == null || value === "" ? "—" : String(value);
  row.append(cell);
  return cell;
}

function appendAttachmentLinks(cell, urls) {
  (Array.isArray(urls) ? urls : []).forEach((value, index) => {
    if (typeof value !== "string" || !/^https:\/\//i.test(value)) return;
    const link = document.createElement("a");
    link.href = value;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `مرفق ${index + 1}`;
    cell.append(link);
  });
  if (!cell.childElementCount) cell.textContent = "—";
}

function readAttachmentUrls(formData) {
  const value = String(formData.get("attachmentUrl") || "").trim();
  if (!value) return [];
  if (!/^https:\/\//i.test(value)) throw new Error("يجب أن يبدأ رابط المرفق بـ https://");
  return [value];
}

function setSelectOptions(select, items, emptyLabel) {
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = emptyLabel;
  placeholder.disabled = true;
  placeholder.selected = true;
  select.append(placeholder);
  items.forEach(({ id, label }) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    select.append(option);
  });
  select.disabled = items.length === 0;
}

function timestampLabel(value) {
  if (!value || typeof value.toDate !== "function") return "—";
  return value.toDate().toLocaleDateString("ar-SA");
}

function roleStatusLabel(status) {
  return ({
    pending: "قيد المراجعة",
    approved: "معتمد",
    rejected: "مرفوض",
    revision_requested: "مطلوب تعديل",
    in_progress: "جارٍ التنفيذ",
    closed: "مغلق",
    open: "التسجيل مفتوح",
    submitted: "مرسل",
    reviewed: "تمت المراجعة",
    accepted: "مقبول"
  })[status] || status || "—";
}

async function loadLeaderDashboard() {
  const teamId = signedInProfile.teamId;
  if (!teamId) {
    showToast("لا يوجد فريق مرتبط بحسابك. اطلب من الإدارة ربط حسابك بفريقك.");
    return;
  }
  const teamSnapshot = await db.collection("teams").doc(teamId).get();
  if (!teamSnapshot.exists || teamSnapshot.data().leaderUid !== signedInAdmin.uid) {
    showToast("تعذر التحقق من قيادة الفريق المرتبط بحسابك. تواصل مع إدارة المنصة.");
    return;
  }
  leaderTeam = { id: teamId, ...teamSnapshot.data() };
  const [members, joinRequests, initiativeRequests, initiatives, reports] = await Promise.all([
    db.collection("volunteers").where("teamId", "==", teamId).get(),
    db.collection("teamJoinRequests").where("teamId", "==", teamId).get(),
    db.collection("initiativeRequests").where("leaderUid", "==", signedInAdmin.uid).get(),
    db.collection("initiatives").where("teamId", "==", teamId).get(),
    db.collection("reports").where("teamId", "==", teamId).get()
  ]);
  leaderMembers = members.docs;
  leaderInitiatives = initiatives.docs;
  const acceptedParticipationRequests = await Promise.all(initiatives.docs.map((initiative) =>
    db.collection("participationRequests")
      .where("initiativeId", "==", initiative.id)
      .get()
  ));
  leaderParticipants = acceptedParticipationRequests.flatMap((snapshot) =>
    snapshot.docs.filter((request) => request.data().status === "accepted")
  );
  document.getElementById("leaderTeamName").textContent = leaderTeam.name || "فريقي";
  document.getElementById("leaderTeamDescription").textContent =
    `${leaderTeam.description || "بيانات الفريق وأعضاؤه وطلباته."} معرّف الفريق: ${teamId}`;
  document.getElementById("leaderMemberCount").textContent = String(members.size);
  document.getElementById("leaderJoinRequestCount").textContent = String(
    joinRequests.docs.filter((request) => request.data().status === "pending").length
  );
  renderLeaderMembers(members.docs);
  renderLeaderJoinRequests(joinRequests.docs);
  renderLeaderInitiativeRequests(initiativeRequests.docs);
  renderLeaderInitiatives(initiatives.docs);
  renderLeaderReports(reports.docs);
  const participantOptions = leaderParticipants.map((request) => ({
    id: request.id,
    label: `${request.data().volunteerName || request.data().volunteerEmail} — ${
      initiatives.docs.find((item) => item.id === request.data().initiativeId)?.data().title || "مبادرة"
    }`
  }));
  const memberOptions = members.docs.map((member) => ({ id: member.id, label: member.data().displayName || member.data().email || member.id }));
  const initiativeOptions = initiatives.docs.map((item) => ({ id: item.id, label: item.data().title || item.id }));
  setSelectOptions(document.getElementById("leaderNotificationRecipient"), memberOptions, "اختر متطوعًا");
  setSelectOptions(document.getElementById("leaderCertificateParticipant"), participantOptions, "اختر مشاركًا معتمدًا");
  setSelectOptions(document.getElementById("leaderReportInitiative"), initiativeOptions, "اختر مبادرة");
}

function renderLeaderMembers(members) {
  const rows = document.getElementById("leaderMemberRows");
  rows.replaceChildren();
  document.getElementById("leaderMembersEmpty").hidden = members.length > 0;
  members.forEach((member) => {
    const user = member.data();
    const row = document.createElement("tr");
    rowCell(row, user.displayName);
    rowCell(row, user.email);
    rowCell(row, member.id);
    rows.append(row);
  });
}

function renderLeaderJoinRequests(requests) {
  const rows = document.getElementById("leaderJoinRequestRows");
  rows.replaceChildren();
  document.getElementById("leaderJoinRequestsEmpty").hidden = requests.length > 0;
  requests.forEach((item) => {
    const request = item.data();
    const row = document.createElement("tr");
    rowCell(row, request.volunteerName);
    rowCell(row, timestampLabel(request.createdAt));
    rowCell(row, roleStatusLabel(request.status));
    const action = document.createElement("td");
    if (request.status === "pending") {
      [["accepted", "قبول"], ["rejected", "رفض"]].forEach(([status, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "role-save-button";
        button.textContent = label;
        button.addEventListener("click", () => decideTeamJoinRequest(item, status));
        action.append(button);
      });
    } else {
      action.textContent = "—";
    }
    row.append(action);
    rows.append(row);
  });
}

async function decideTeamJoinRequest(requestDocument, status) {
  const request = requestDocument.data();
  try {
    const batch = db.batch();
    if (status === "accepted") {
      batch.update(db.collection("volunteers").doc(request.volunteerUid), { teamId: leaderTeam.id });
    }
    batch.update(requestDocument.ref, { status });
    await batch.commit();
    showToast(status === "accepted" ? "تم قبول المتطوع وإضافته إلى الفريق." : "تم رفض طلب الانضمام.");
    await loadLeaderDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  }
}

function renderLeaderInitiativeRequests(requests) {
  const rows = document.getElementById("leaderInitiativeRequestRows");
  rows.replaceChildren();
  document.getElementById("leaderInitiativeRequestsEmpty").hidden = requests.length > 0;
  requests.forEach((item) => {
    const request = item.data();
    const row = document.createElement("tr");
    rowCell(row, request.title);
    rowCell(row, `${request.date || "—"} ${request.time || ""}`);
    rowCell(row, roleStatusLabel(request.status));
    rowCell(row, request.reviewNote);
    const action = document.createElement("td");
    if (request.status === "revision_requested") {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "role-save-button";
      edit.textContent = "تعديل وإعادة الإرسال";
      edit.addEventListener("click", () => prepareInitiativeRevision(item));
      action.append(edit);
    } else {
      action.textContent = "—";
    }
    row.append(action);
    rows.append(row);
  });
}

function prepareInitiativeRevision(item) {
  const form = document.getElementById("leaderInitiativeRequestForm");
  const request = item.data();
  ["title", "description", "date", "time", "location", "requiredVolunteers", "hours"].forEach((name) => {
    form.elements[name].value = request[name] || "";
  });
  form.elements.tasks.value = Array.isArray(request.tasks) ? request.tasks.join("\n") : request.tasks || "";
  form.elements.attachmentUrl.value = request.attachments?.[0] || "";
  editingInitiativeRequestId = item.id;
  form.querySelector("button[type=submit]").textContent = "حفظ التعديل وإعادة الإرسال";
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderLeaderInitiatives(initiatives) {
  const rows = document.getElementById("leaderInitiativesRows");
  rows.replaceChildren();
  document.getElementById("leaderInitiativesEmpty").hidden = initiatives.length > 0;
  initiatives.forEach((item) => {
    const initiative = item.data();
    const row = document.createElement("tr");
    rowCell(row, initiative.title);
    rowCell(row, initiative.date);
    rowCell(row, roleStatusLabel(initiative.status));
    const action = document.createElement("td");
    let nextStatus = null;
    let label = "";
    if (initiative.status === "approved") {
      nextStatus = "open";
      label = "بدء المبادرة";
    } else if (initiative.status === "open") {
      nextStatus = "closed";
      label = "إغلاق المبادرة";
    }
    if (nextStatus) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "role-save-button";
      button.textContent = label;
      button.addEventListener("click", async () => {
        try {
          await item.ref.update({
            status: nextStatus,
            published: nextStatus === "open"
          });
          showToast(nextStatus === "open" ? "بدأت المبادرة وظهرت للمتطوعين." : "تم إغلاق المبادرة.");
          await loadLeaderDashboard();
        } catch (error) {
          showToast(errorMessage(error));
        }
      });
      action.append(button);
    } else {
      action.textContent = "—";
    }
    row.append(action);
    rows.append(row);
  });
}

function renderLeaderReports(reports) {
  const rows = document.getElementById("leaderReportRows");
  rows.replaceChildren();
  document.getElementById("leaderReportsEmpty").hidden = reports.length > 0;
  reports.forEach((item) => {
    const report = item.data();
    const initiative = leaderInitiatives.find((entry) => entry.id === report.initiativeId);
    const row = document.createElement("tr");
    rowCell(row, initiative ? initiative.data().title : report.initiativeId);
    rowCell(row, roleStatusLabel(report.status));
    rowCell(row, report.reviewNote);
    const attachments = document.createElement("td");
    appendAttachmentLinks(attachments, report.attachments);
    row.append(attachments);
    rows.append(row);
  });
}

async function loadStaffDashboard() {
  const [teams, requests, reports, volunteers, certificates, initiatives] = await Promise.all([
    db.collection("teams").orderBy("name").get(),
    db.collection("initiativeRequests").orderBy("createdAt", "desc").get(),
    db.collection("reports").orderBy("createdAt", "desc").get(),
    db.collection("volunteers").orderBy("displayName").get(),
    db.collection("certificates").orderBy("createdAt", "desc").get(),
    db.collection("initiatives").get()
  ]);
  staffInitiatives = initiatives.docs;
  renderStaffTeams(teams.docs);
  renderStaffInitiativeRequests(requests.docs);
  renderStaffReports(reports.docs);
  renderStaffVolunteers(volunteers.docs);
  renderStaffCertificates(certificates.docs);
}

function renderStaffTeams(teams) {
  const rows = document.getElementById("staffTeamRows");
  rows.replaceChildren();
  document.getElementById("staffTeamsEmpty").hidden = teams.length > 0;
  teams.forEach((item) => {
    const team = item.data();
    const row = document.createElement("tr");
    rowCell(row, team.name);
    rowCell(row, item.id);
    rowCell(row, team.leaderUid);
    rowCell(row, team.description);
    const action = document.createElement("td");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "role-save-button";
    edit.textContent = "تعديل";
    edit.addEventListener("click", async () => {
      const name = window.prompt("اسم الفريق", team.name || "");
      if (name === null) return;
      const leaderUid = window.prompt("معرّف حساب القائد", team.leaderUid || "");
      if (leaderUid === null) return;
      const description = window.prompt("وصف الفريق", team.description || "");
      if (description === null) return;
      try {
        await item.ref.update({
          name: name.trim(),
          leaderUid: leaderUid.trim(),
          description: description.trim()
        });
        showToast("تم تحديث بيانات الفريق.");
        await loadStaffDashboard();
      } catch (error) {
        showToast(errorMessage(error));
      }
    });
    action.append(edit);
    row.append(action);
    rows.append(row);
  });
}

function renderStaffInitiativeRequests(requests) {
  const rows = document.getElementById("staffInitiativeRequestRows");
  rows.replaceChildren();
  document.getElementById("staffInitiativeRequestsEmpty").hidden = requests.length > 0;
  requests.forEach((item) => {
    const request = item.data();
    const row = document.createElement("tr");
    const summary = document.createElement("td");
    summary.textContent = `${request.title || "مبادرة"} — ${request.teamName || request.teamId}`;
    row.append(summary);
    rowCell(row, `${request.date || "—"} ${request.time || ""}\n${request.location || ""}`);
    const attachmentCell = document.createElement("td");
    appendAttachmentLinks(attachmentCell, request.attachments);
    row.append(attachmentCell);
    rowCell(row, roleStatusLabel(request.status));
    const noteCell = document.createElement("td");
    const note = document.createElement("input");
    note.className = "dialog-input";
    note.value = request.reviewNote || "";
    note.maxLength = 2000;
    note.setAttribute("aria-label", `ملاحظة مراجعة ${request.title || ""}`);
    noteCell.append(note);
    row.append(noteCell);
    const action = document.createElement("td");
    if (["pending", "revision_requested"].includes(request.status)) {
      [["approved", "اعتماد"], ["rejected", "رفض"], ["revision_requested", "إعادة للتعديل"]].forEach(([status, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "role-save-button";
        button.textContent = label;
        button.addEventListener("click", () => reviewInitiativeRequest(item, status, note.value));
        action.append(button);
      });
    } else if (request.status === "approved") {
      const alreadyCreated = staffInitiatives.some((initiative) => initiative.data().approvedRequestId === item.id);
      if (!alreadyCreated) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "role-save-button";
        button.textContent = "إنشاء فرصة";
        button.addEventListener("click", () => createApprovedInitiative(item));
        action.append(button);
      } else {
        action.textContent = "تم إنشاء الفرصة";
      }
    } else {
      action.textContent = "—";
    }
    row.append(action);
    rows.append(row);
  });
}

let staffInitiatives = [];

async function reviewInitiativeRequest(item, status, reviewNote) {
  try {
    await item.ref.update({
      status,
      reviewedBy: signedInAdmin.uid,
      reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reviewNote: reviewNote.trim()
    });
    showToast("تم حفظ قرار مراجعة الطلب.");
    await loadStaffDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function createApprovedInitiative(item) {
  const request = item.data();
  try {
    const existing = await db.collection("initiatives").where("approvedRequestId", "==", item.id).limit(1).get();
    if (!existing.empty) {
      showToast("تم إنشاء فرصة لهذا الطلب سابقًا.");
      await loadStaffDashboard();
      return;
    }
    await db.collection("initiatives").add({
      title: request.title,
      description: request.description,
      category: "مبادرة فريق",
      date: request.date,
      location: request.location,
      hours: request.hours,
      status: "approved",
      published: false,
      createdBy: signedInAdmin.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      teamId: request.teamId,
      teamName: request.teamName,
      leaderUid: request.leaderUid,
      requiredVolunteers: request.requiredVolunteers,
      tasks: request.tasks,
      attachments: request.attachments || [],
      approvedRequestId: item.id
    });
    showToast("تم إنشاء الفرصة؛ يستطيع قائد الفريق بدءها لنشرها للمتطوعين.");
    await loadStaffDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  }
}

function renderStaffReports(reports) {
  const rows = document.getElementById("staffReportRows");
  rows.replaceChildren();
  document.getElementById("staffReportsEmpty").hidden = reports.length > 0;
  reports.forEach((item) => {
    const report = item.data();
    const row = document.createElement("tr");
    rowCell(row, report.teamId);
    rowCell(row, report.initiativeId);
    rowCell(row, report.content);
    const attachments = document.createElement("td");
    appendAttachmentLinks(attachments, report.attachments);
    row.append(attachments);
    rowCell(row, roleStatusLabel(report.status));
    const noteCell = document.createElement("td");
    const note = document.createElement("input");
    note.className = "dialog-input";
    note.value = report.reviewNote || "";
    note.maxLength = 2000;
    noteCell.append(note);
    row.append(noteCell);
    const action = document.createElement("td");
    if (report.status === "submitted") {
      [["reviewed", "تمت المراجعة"], ["revision_requested", "إعادة للتعديل"]].forEach(([status, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "role-save-button";
        button.textContent = label;
        button.addEventListener("click", async () => {
          try {
            await item.ref.update({
              status,
              reviewNote: note.value.trim(),
              reviewedBy: signedInAdmin.uid,
              reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast("تم تحديث حالة التقرير.");
            await loadStaffDashboard();
          } catch (error) {
            showToast(errorMessage(error));
          }
        });
        action.append(button);
      });
    } else {
      action.textContent = "—";
    }
    row.append(action);
    rows.append(row);
  });
}

function renderStaffVolunteers(volunteers) {
  const rows = document.getElementById("staffVolunteerRows");
  rows.replaceChildren();
  document.getElementById("staffVolunteersEmpty").hidden = volunteers.length > 0;
  volunteers.forEach((item) => {
    const user = item.data();
    const row = document.createElement("tr");
    rowCell(row, user.displayName);
    rowCell(row, user.email);
    rowCell(row, item.id);
    rowCell(row, user.teamId);
    rowCell(row, roleLabels[user.role] || "متطوع");
    rows.append(row);
  });
}

function renderStaffCertificates(certificates) {
  const rows = document.getElementById("staffCertificateRows");
  rows.replaceChildren();
  document.getElementById("staffCertificatesEmpty").hidden = certificates.length > 0;
  certificates.forEach((item) => {
    const certificate = item.data();
    const row = document.createElement("tr");
    rowCell(row, certificate.volunteerUid);
    rowCell(row, certificate.initiativeId);
    rowCell(row, certificate.hours);
    rowCell(row, certificate.certificateNumber || certificate.certificateUrl);
    const action = document.createElement("td");
    const hours = document.createElement("input");
    hours.className = "dialog-input";
    hours.type = "number";
    hours.min = "1";
    hours.max = "24";
    hours.value = certificate.hours;
    hours.setAttribute("aria-label", "تحديث الساعات التطوعية");
    const save = document.createElement("button");
    save.type = "button";
    save.className = "role-save-button";
    save.textContent = "حفظ الساعات";
    save.addEventListener("click", async () => {
      try {
        const value = Number(hours.value);
        if (!Number.isFinite(value) || value <= 0 || value > 24) {
          showToast("أدخل عدد ساعات صحيحًا من 1 إلى 24.");
          return;
        }
        await item.ref.update({ hours: value });
        showToast("تم تحديث الساعات.");
        await loadStaffDashboard();
      } catch (error) {
        showToast(errorMessage(error));
      }
    });
    action.append(hours, save);
    row.append(action);
    rows.append(row);
  });
}

async function loadExecutiveDashboard() {
  const [teams, volunteers, initiatives, reports, participationRequests, certificates, initiativeRequests] = await Promise.all([
    db.collection("teams").orderBy("name").get(),
    db.collection("volunteers").orderBy("displayName").get(),
    db.collection("initiatives").orderBy("date", "desc").get(),
    db.collection("reports").orderBy("createdAt", "desc").get(),
    db.collection("participationRequests").get(),
    db.collection("certificates").orderBy("createdAt", "desc").get(),
    db.collection("initiativeRequests").get()
  ]);
  document.getElementById("executiveTeamCount").textContent = String(teams.size);
  document.getElementById("executiveVolunteerCount").textContent = String(volunteers.size);
  document.getElementById("executiveInitiativeCount").textContent = String(initiatives.size);
  document.getElementById("executiveReportCount").textContent = String(reports.size);
  renderExecutiveTeams(teams.docs, volunteers.docs);
  renderExecutiveInitiatives(initiatives.docs, participationRequests.docs);
  renderExecutiveReports(reports.docs);
  renderExecutiveCertificates(certificates.docs, volunteers.docs, initiatives.docs);
  renderExecutiveInitiativeRequests(initiativeRequests.docs);
  renderExecutiveUsers(volunteers.docs);
}

function renderExecutiveTeams(teams, volunteers) {
  const rows = document.getElementById("executiveTeamRows");
  rows.replaceChildren();
  const countByTeam = new Map();
  volunteers.forEach((item) => {
    const teamId = item.data().teamId;
    if (teamId) countByTeam.set(teamId, (countByTeam.get(teamId) || 0) + 1);
  });
  teams.forEach((item) => {
    const team = item.data();
    const row = document.createElement("tr");
    rowCell(row, team.name);
    rowCell(row, team.leaderUid);
    rowCell(row, countByTeam.get(item.id) || 0);
    rows.append(row);
  });
}

function renderExecutiveInitiatives(initiatives, participationRequests) {
  const rows = document.getElementById("executiveInitiativeRows");
  rows.replaceChildren();
  initiatives.forEach((item) => {
    const initiative = item.data();
    const row = document.createElement("tr");
    rowCell(row, initiative.title);
    rowCell(row, initiative.teamName || initiative.teamId);
    rowCell(row, participationRequests.filter((request) => request.data().initiativeId === item.id
      && request.data().status === "accepted").length);
    rowCell(row, roleStatusLabel(initiative.status));
    rowCell(row, initiative.date);
    const attachments = document.createElement("td");
    appendAttachmentLinks(attachments, initiative.attachments);
    row.append(attachments);
    rows.append(row);
  });
}

function renderExecutiveCertificates(certificates, volunteers, initiatives) {
  const rows = document.getElementById("executiveCertificateRows");
  rows.replaceChildren();
  certificates.forEach((item) => {
    const certificate = item.data();
    const volunteer = volunteers.find((profile) => profile.id === certificate.volunteerUid);
    const initiative = initiatives.find((entry) => entry.id === certificate.initiativeId);
    const row = document.createElement("tr");
    rowCell(row, volunteer?.data().displayName || certificate.volunteerUid);
    rowCell(row, initiative?.data().title || certificate.initiativeId);
    rowCell(row, certificate.hours);
    const certificateCell = rowCell(row, certificate.certificateNumber);
    if (typeof certificate.certificateUrl === "string" && /^https:\/\//i.test(certificate.certificateUrl)) {
      const link = document.createElement("a");
      link.href = certificate.certificateUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "عرض";
      certificateCell.append(document.createTextNode(" "), link);
    }
    rows.append(row);
  });
}

function renderExecutiveReports(reports) {
  const rows = document.getElementById("executiveReportRows");
  rows.replaceChildren();
  reports.forEach((item) => {
    const report = item.data();
    const row = document.createElement("tr");
    rowCell(row, report.teamId);
    rowCell(row, report.initiativeId);
    rowCell(row, report.content);
    const attachments = document.createElement("td");
    appendAttachmentLinks(attachments, report.attachments);
    row.append(attachments);
    rowCell(row, roleStatusLabel(report.status));
    rows.append(row);
  });
}

function renderExecutiveInitiativeRequests(requests) {
  const rows = document.getElementById("executiveInitiativeRequestRows");
  rows.replaceChildren();
  requests.forEach((item) => {
    const request = item.data();
    const row = document.createElement("tr");
    rowCell(row, request.title);
    rowCell(row, request.teamName || request.teamId);
    rowCell(row, roleStatusLabel(request.status));
    rowCell(row, request.reviewNote);
    const attachments = document.createElement("td");
    appendAttachmentLinks(attachments, request.attachments);
    row.append(attachments);
    rows.append(row);
  });
}

function renderExecutiveUsers(volunteers) {
  const rows = document.getElementById("executiveUserRows");
  rows.replaceChildren();
  document.getElementById("executiveUsersEmpty").hidden = volunteers.length > 0;
  volunteers.forEach((item) => {
    const user = item.data();
    const row = document.createElement("tr");
    rowCell(row, user.displayName);
    rowCell(row, user.email);
    rowCell(row, item.id);
    rowCell(row, user.teamId);
    const roleCell = document.createElement("td");
    const role = document.createElement("select");
    role.className = "user-role-select";
    role.setAttribute("aria-label", `رتبة ${user.displayName || user.email}`);
    [["volunteer", "متطوع"], ["leader", "قائد الفريق"], ["staff", "إدارة العمل التطوعي"], ["executive", "الإدارة التنفيذية"]]
      .forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = user.role === value;
        role.append(option);
      });
    roleCell.append(role);
    const teamId = document.createElement("input");
    teamId.className = "dialog-input";
    teamId.placeholder = "معرّف الفريق للقائد";
    teamId.value = user.teamId || "";
    teamId.hidden = user.role !== "leader";
    role.addEventListener("change", () => { teamId.hidden = role.value !== "leader"; });
    roleCell.append(teamId);
    row.append(roleCell);
    const action = document.createElement("td");
    const save = document.createElement("button");
    save.type = "button";
    save.className = "role-save-button";
    save.textContent = "حفظ";
    save.addEventListener("click", async () => {
      try {
        const changes = { role: role.value };
        if (role.value === "leader") {
          if (!teamId.value.trim()) {
            showToast("أدخل معرّف فريق موجود قبل تعيين قائد الفريق.");
            return;
          }
          changes.teamId = teamId.value.trim();
        } else if (user.teamId) {
          changes.teamId = firebase.firestore.FieldValue.delete();
        }
        await item.ref.update(changes);
        showToast("تم تحديث رتبة المستخدم.");
        await loadExecutiveDashboard();
      } catch (error) {
        showToast(errorMessage(error));
      }
    });
    action.append(save);
    row.append(action);
    rows.append(row);
  });
}

document.getElementById("initiativeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!signedInAdmin || currentRole !== "admin") return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await db.collection("initiatives").add({
      title: document.getElementById("initiativeTitle").value.trim(),
      description: document.getElementById("initiativeDescription").value.trim(),
      category: document.getElementById("initiativeCategory").value.trim(),
      date: document.getElementById("initiativeDate").value,
      location: document.getElementById("initiativeLocation").value.trim(),
      hours: Number(document.getElementById("initiativeHours").value),
      status: "open",
      published: true,
      createdBy: signedInAdmin.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    event.currentTarget.reset();
    showToast("تم نشر المبادرة على الموقع العام.");
    await loadDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.getElementById("leaderAddMemberForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const volunteerUid = document.getElementById("leaderMemberUid").value.trim();
  if (!leaderTeam || !volunteerUid) return;
  button.disabled = true;
  try {
    await db.collection("volunteers").doc(volunteerUid).update({ teamId: leaderTeam.id });
    form.reset();
    showToast("تمت إضافة المتطوع إلى الفريق.");
    await loadLeaderDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.getElementById("leaderInitiativeRequestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!leaderTeam) return;
  const button = form.querySelector("button[type=submit]");
  const data = new FormData(form);
  const tasks = String(data.get("tasks")).split(/\r?\n/).map((task) => task.trim()).filter(Boolean);
  let attachments;
  try {
    attachments = readAttachmentUrls(data);
  } catch (error) {
    showToast(error.message);
    return;
  }
  const requestData = {
    title: String(data.get("title")).trim(),
    description: String(data.get("description")).trim(),
    teamId: leaderTeam.id,
    teamName: leaderTeam.name,
    leaderUid: signedInAdmin.uid,
    leaderName: signedInProfile.displayName || signedInAdmin.email,
    date: String(data.get("date")),
    time: String(data.get("time")),
    location: String(data.get("location")).trim(),
    requiredVolunteers: Number(data.get("requiredVolunteers")),
    tasks,
    hours: Number(data.get("hours")),
    attachments
  };
  button.disabled = true;
  try {
    if (editingInitiativeRequestId) {
      await db.collection("initiativeRequests").doc(editingInitiativeRequestId).update({
        ...requestData,
        status: "pending"
      });
      editingInitiativeRequestId = null;
      button.textContent = "إرسال الطلب";
      showToast("تم إرسال التعديلات للمراجعة.");
    } else {
      await db.collection("initiativeRequests").add({
        ...requestData,
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("تم إرسال طلب المبادرة لإدارة العمل التطوعي.");
    }
    form.reset();
    await loadLeaderDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.getElementById("leaderNotificationForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!leaderTeam) return;
  const data = new FormData(form);
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await db.collection("notifications").add({
      teamId: leaderTeam.id,
      createdBy: signedInAdmin.uid,
      recipientUid: String(data.get("recipientUid")),
      message: String(data.get("message")).trim(),
      type: String(data.get("type")),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    form.reset();
    showToast("تم إرسال التنبيه.");
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.getElementById("leaderReportForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!leaderTeam) return;
  const data = new FormData(form);
  let attachments;
  try {
    attachments = readAttachmentUrls(data);
  } catch (error) {
    showToast(error.message);
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await db.collection("reports").add({
      teamId: leaderTeam.id,
      initiativeId: String(data.get("initiativeId")),
      createdBy: signedInAdmin.uid,
      content: String(data.get("content")).trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: "submitted",
      attachments
    });
    form.reset();
    showToast("تم إرسال التقرير للمراجعة.");
    await loadLeaderDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.getElementById("leaderCertificateForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!leaderTeam) return;
  const data = new FormData(form);
  const participationRequest = leaderParticipants.find((request) => request.id === String(data.get("participationRequestId")));
  if (!participationRequest) {
    showToast("اختر مشاركًا معتمدًا من القائمة.");
    return;
  }
  const participantData = participationRequest.data();
  const certificate = {
    teamId: leaderTeam.id,
    volunteerUid: participantData.volunteerUid,
    initiativeId: participantData.initiativeId,
    participationRequestId: participationRequest.id,
    issuedBy: signedInAdmin.uid,
    hours: Number(data.get("hours")),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  const certificateNumber = String(data.get("certificateNumber")).trim();
  const certificateUrl = String(data.get("certificateUrl")).trim();
  if (certificateNumber) certificate.certificateNumber = certificateNumber;
  if (certificateUrl) certificate.certificateUrl = certificateUrl;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await db.collection("certificates").add(certificate);
    form.reset();
    showToast("تم إصدار الشهادة وتسجيل الساعات.");
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.getElementById("staffTeamForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const team = {
      name: String(data.get("name")).trim(),
      leaderUid: String(data.get("leaderUid")).trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const description = String(data.get("description")).trim();
    if (description) team.description = description;
    const reference = await db.collection("teams").add(team);
    form.reset();
    showToast(`تم إنشاء الفريق. معرّفه: ${reference.id}`);
    await loadStaffDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

if (!firebaseReady) {
  showToast("أضف إعدادات Firebase إلى firebase-config.js لتفعيل تسجيل الدخول.");
} else {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      signedInAdmin = null;
      signedInProfile = null;
      currentRole = null;
      loginPanel.hidden = false;
      dashboard.hidden = true;
      return;
    }
    try {
      await verifyAdmin(user);
    } catch (error) {
      showToast(errorMessage(error));
    }
  });
}
