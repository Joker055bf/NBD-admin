const firebaseConfig = window.firebaseConfig || {};
const firebaseReady = typeof firebase !== "undefined"
  && Object.values(firebaseConfig).every((value) => typeof value === "string" && value.trim());
const auth = firebaseReady ? firebase.auth() : null;
const db = firebaseReady ? firebase.firestore() : null;
const functions = firebaseReady ? firebase.app().functions("us-central1") : null;
const loginPanel = document.getElementById("adminLoginPanel");
const dashboard = document.getElementById("adminDashboard");
const toast = document.getElementById("adminToast");
let signedInAdmin = null;
let signedInProfile = null;
let currentRole = null;
let leaderTeam = null;
let leaderMembers = [];
let leaderInitiatives = [];
let leaderParticipants = [];
let leaderCertificates = [];
let staffTeams = [];
let staffVolunteers = [];
let staffInitiatives = [];
let editingStaffTeam = null;
let editingInitiativeRequestId = null;
let toastTimer;

document.querySelectorAll(".admin-empty").forEach((element) => {
  element.hidden = true;
});

function labelAdminTableCells() {
  document.querySelectorAll(".admin-table").forEach((table) => {
    const labels = [...table.querySelectorAll("thead th")].map((heading) => heading.textContent.trim());
    table.querySelectorAll("tbody tr").forEach((row) => {
      [...row.cells].forEach((cell, index) => {
        if (labels[index]) cell.dataset.label = labels[index];
      });
    });
  });
}

const adminTableObserver = new MutationObserver(labelAdminTableCells);
document.querySelectorAll(".admin-table tbody").forEach((body) => {
  adminTableObserver.observe(body, { childList: true });
});
labelAdminTableCells();

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

const adminNavigationTargets = {
  admin: {
    initiatives: "#adminInitiativeFormPanel",
    teams: "#staffTeamPanel",
    requests: "#adminRequestsPanel",
    reports: "#staffReportsPanel",
    certificates: "#staffCertificatesPanel"
  },
  leader: {
    initiatives: "#leaderInitiativesPanel",
    teams: "#leaderTeamName",
    requests: "#leaderJoinRequestsPanel",
    reports: "#leaderReportsPanel",
    certificates: "#leaderCertificatesPanel"
  },
  staff: {
    initiatives: "#staffInitiativeRequestsPanel",
    teams: "#staffTeamPanel",
    requests: "#staffInitiativeRequestsPanel",
    reports: "#staffReportsPanel",
    certificates: "#staffCertificatesPanel"
  },
  executive: {
    initiatives: "#executiveInitiativeRows",
    teams: "#executiveTeamRows",
    requests: "#executiveInitiativeRequestRows",
    reports: "#executiveReportRows",
    certificates: "#executiveCertificateRows"
  }
};

function closeAdminMenu() {
  const menu = document.getElementById("adminQuickMenu");
  const toggle = document.getElementById("adminMenuToggle");
  menu.classList.remove("is-open");
  toggle.setAttribute("aria-expanded", "false");
}

document.getElementById("adminMenuToggle").addEventListener("click", () => {
  const menu = document.getElementById("adminQuickMenu");
  const toggle = document.getElementById("adminMenuToggle");
  const opening = !menu.classList.contains("is-open");
  menu.classList.toggle("is-open", opening);
  toggle.setAttribute("aria-expanded", String(opening));
});

function renderAdminNav() {
  const menu = document.getElementById("adminQuickMenu");
  menu.querySelectorAll("[data-admin-section]").forEach((button) => {
    const section = button.dataset.adminSection;
    button.hidden = !(section === "home"
      || section === "profile"
      || Boolean(adminNavigationTargets[currentRole]?.[section]));
    button.classList.toggle("active", section === "home");
  });
}

document.getElementById("adminQuickMenu").addEventListener("click", (event) => {
  const button = event.target.closest("[data-admin-section]");
  if (!button) return;
  const section = button.dataset.adminSection;
  document.querySelectorAll("#adminQuickMenu [data-admin-section]").forEach((item) => {
    item.classList.toggle("active", item === button);
  });
  const profilePanel = document.getElementById("adminProfilePanel");
  if (section === "profile") {
    profilePanel.hidden = false;
    profilePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    profilePanel.hidden = true;
    const selector = section === "home"
      ? ".admin-dashboard-heading"
      : adminNavigationTargets[currentRole]?.[section];
    const target = selector && document.querySelector(selector);
    if (target && !target.closest("[hidden]")) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      showToast("هذا القسم غير متاح في لوحة دورك.");
    }
  }
  closeAdminMenu();
});

function accountProfileCollection() {
  return currentRole === "admin" ? "adminAccounts" : "volunteers";
}

function loadAccountSettings() {
  if (!signedInAdmin || !signedInProfile) return;
  document.getElementById("profileDisplayName").value = signedInProfile.displayName || "";
  document.getElementById("profileEmail").value = signedInAdmin.email || signedInProfile.email || "";
  document.getElementById("profileGender").value = signedInProfile.gender || "";
  document.getElementById("profileNationality").value = signedInProfile.nationality || "";
  document.getElementById("currentAdminUsername").value = signedInProfile.username || "";
  document.getElementById("newAdminUsername").value = signedInProfile.username || "";
}

document.getElementById("adminProfileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!signedInAdmin || !signedInProfile) return;
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const displayName = document.getElementById("profileDisplayName").value.trim();
  const gender = document.getElementById("profileGender").value;
  const nationality = document.getElementById("profileNationality").value.trim();
  if (displayName.length < 2 || displayName.length > 100 || nationality.length > 80) {
    showToast("تحقق من الاسم والجنسية قبل الحفظ.");
    return;
  }
  const changes = {
    displayName,
    email: signedInAdmin.email,
    gender: gender || firebase.firestore.FieldValue.delete(),
    nationality: nationality || firebase.firestore.FieldValue.delete()
  };
  button.disabled = true;
  try {
    await db.collection(accountProfileCollection()).doc(signedInAdmin.uid).update(changes);
    signedInProfile = {
      ...signedInProfile,
      displayName,
      email: signedInAdmin.email,
      gender,
      nationality
    };
    document.getElementById("adminSessionName").textContent = displayName;
    try {
      await signedInAdmin.updateProfile({ displayName });
    } catch (error) {
      showToast(`تم حفظ بيانات الملف الشخصي، لكن تعذر تحديث اسم العرض في الحساب: ${errorMessage(error)}`);
      return;
    }
    showToast("تم حفظ بياناتك الشخصية.");
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

async function reauthenticateAdmin(password) {
  const credential = firebase.auth.EmailAuthProvider.credential(signedInAdmin.email, password);
  await signedInAdmin.reauthenticateWithCredential(credential);
}

document.getElementById("adminUsernameForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!signedInAdmin) return;
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const currentPassword = document.getElementById("currentUsernamePassword").value;
  const newUsername = document.getElementById("newAdminUsername").value.trim();
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(newUsername)) {
    showToast("اسم المستخدم من 3 إلى 32 خانة، ويقبل الأحرف الإنجليزية والأرقام و . و _ و -.");
    return;
  }
  button.disabled = true;
  try {
    await reauthenticateAdmin(currentPassword);
    const result = await functions.httpsCallable("setAccountUsername")({ username: newUsername });
    signedInProfile = { ...signedInProfile, username: result.data.username };
    form.reset();
    document.getElementById("currentAdminUsername").value = result.data.username;
    document.getElementById("newAdminUsername").value = result.data.username;
    showToast("تم تغيير اسم المستخدم بنجاح.");
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.getElementById("adminPasswordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!signedInAdmin) return;
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const currentPassword = document.getElementById("currentPasswordForChange").value;
  const newPassword = document.getElementById("newAdminPassword").value;
  if (newPassword.length < 6) {
    showToast("كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف.");
    return;
  }
  button.disabled = true;
  try {
    await reauthenticateAdmin(currentPassword);
    await signedInAdmin.updatePassword(newPassword);
    form.reset();
    showToast("تم تغيير كلمة المرور بنجاح.");
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

function errorMessage(error) {
  const messages = {
    "auth/invalid-credential": "بيانات الدخول غير صحيحة.",
    "auth/invalid-email": "اسم المستخدم غير صالح.",
    "auth/email-already-in-use": "هذا البريد مستخدم في حساب آخر.",
    "auth/requires-recent-login": "أعد تسجيل الدخول ثم حاول تغيير بيانات الحساب.",
    "auth/credential-already-in-use": "بيانات الدخول مستخدمة في حساب آخر.",
    "auth/wrong-password": "كلمة المرور الحالية غير صحيحة.",
    "auth/weak-password": "كلمة المرور الجديدة ضعيفة.",
    "auth/operation-not-allowed": "إعادة تعيين كلمة المرور غير مفعّلة في إعدادات Firebase Authentication.",
    "auth/configuration-not-found": "تسجيل الدخول بكلمة المرور غير مفعّل في Firebase Authentication. فعّل Email/Password من إعدادات تسجيل الدخول في Firebase Console.",
    "auth/too-many-requests": "محاولات كثيرة. حاول بعد قليل.",
    "auth/network-request-failed": "تعذر الاتصال. تحقق من الإنترنت.",
    "permission-denied": "رفضت قواعد Firestore العملية. تحقق من دور المسؤول والقواعد المنشورة.",
    "firestore/permission-denied": "رفضت قواعد Firestore العملية. تحقق من دور المسؤول والقواعد المنشورة.",
    "functions/already-exists": "اسم المستخدم مستخدم مسبقًا.",
    "functions/unauthenticated": "اسم المستخدم أو كلمة المرور غير صحيحة.",
    "functions/invalid-argument": "تحقق من البيانات المدخلة.",
    "functions/internal": "تعذر إكمال العملية بسبب إعدادات الخادم. تأكد من نشر دوال Firebase وتهيئة أسماء المستخدمين.",
    internal: "تعذر إكمال العملية بسبب إعدادات الخادم. تأكد من نشر دوال Firebase وتهيئة أسماء المستخدمين.",
    "functions/not-found": "خدمة تسجيل الدخول غير منشورة بعد. انشر دوال Firebase ثم حاول مجددًا.",
    "functions/failed-precondition": "لم تكتمل تهيئة الحسابات بعد. تواصل مع إدارة المنصة.",
    "functions/deadline-exceeded": "استغرق الطلب وقتًا أطول من المتوقع. حاول مرة أخرى.",
    "functions/unavailable": "الخدمة غير متاحة مؤقتًا. تحقق من الاتصال وحاول لاحقًا.",
    "functions/permission-denied": "لا تملك صلاحية تنفيذ هذا الإجراء.",
    "functions/resource-exhausted": "تعذر إكمال العملية الآن. تواصل مع إدارة المنصة."
  };
  return messages[error.code] || "حدث خطأ غير متوقع. حاول مرة أخرى أو تواصل مع إدارة المنصة.";
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
  loadAccountSettings();
  document.querySelectorAll("[data-role-panel]").forEach((panel) => {
    const allowedRoles = panel.dataset.rolePanel.split(/\s+/);
    panel.hidden = currentRole === "admin"
      ? !allowedRoles.some((role) => ["admin", "staff", "executive"].includes(role))
      : !allowedRoles.includes(currentRole);
  });
  renderAdminNav();
  loginPanel.hidden = true;
  dashboard.hidden = false;
  await loadDashboard();
  if (currentRole === "admin") {
    try {
      const result = await functions.httpsCallable("backfillAccountUsernames")({});
      if (result.data.updated > 0) {
        showToast(`تم تهيئة أسماء المستخدمين للحسابات الحالية: ${result.data.updated}.`);
        const profile = await db.collection(accountProfileCollection()).doc(signedInAdmin.uid).get();
        if (profile.exists) {
          signedInProfile = profile.data();
          loadAccountSettings();
        }
      }
      if (result.data.skipped > 0) {
        showToast(`توجد حسابات بلا بريد إلكتروني صالح، ولم تُهيّأ أسماؤها: ${result.data.skipped}.`);
      }
    } catch (error) {
      showToast(`تعذر تهيئة أسماء المستخدمين للحسابات الحالية: ${errorMessage(error)}`);
    }
  }
  return true;
}

document.getElementById("adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  if (!firebaseReady) {
    showToast("أضف إعدادات Firebase إلى firebase-config.js أولًا.");
    return;
  }
  const username = document.getElementById("adminUsername").value.trim();
  const password = document.getElementById("adminPassword").value;
  if (!username || !password) {
    showToast("أدخل اسم المستخدم وكلمة المرور.");
    return;
  }
  button.disabled = true;
  button.textContent = "جارٍ التحقق من الحساب...";
  try {
    const email = username.includes("@")
      ? username
      : `${username.toLowerCase()}@admin.nbda-1ee36.firebaseapp.com`;
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = "دخول لوحة التحكم";
  }
});

document.getElementById("adminLogoutButton").addEventListener("click", async () => {
  try {
    await auth.signOut();
    signedInAdmin = null;
    signedInProfile = null;
    currentRole = null;
    document.getElementById("adminProfilePanel").hidden = true;
    closeAdminMenu();
    document.getElementById("adminUsernameForm").reset();
    document.getElementById("adminPasswordForm").reset();
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
  const [volunteersSnapshot, administratorsSnapshot, initiativesSnapshot, requestsSnapshot, teamsSnapshot] = await Promise.all([
    db.collection("volunteers").get(),
    db.collection("adminAccounts").get(),
    db.collection("initiatives").orderBy("date", "desc").get(),
    db.collection("participationRequests").orderBy("createdAt", "desc").get(),
    db.collection("teams").orderBy("name").get()
  ]);
  document.getElementById("adminVolunteerCount").textContent = String(volunteersSnapshot.size);
  document.getElementById("adminInitiativeCount").textContent = String(initiativesSnapshot.size);
  document.getElementById("adminRequestCount").textContent = String(
    requestsSnapshot.docs.filter((item) => item.data().status === "pending").length
  );
  renderUsers(volunteersSnapshot.docs, administratorsSnapshot.docs, teamsSnapshot.docs);
  renderInitiatives(initiativesSnapshot.docs);
  renderRequests(requestsSnapshot.docs);
}
function renderUsers(volunteers, administrators, teams) {
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
    const teamSelect = document.createElement("select");
    teamSelect.className = "dialog-input leader-team-select";
    teamSelect.setAttribute("aria-label", `فريق ${user.displayName || user.email}`);
    const emptyTeamOption = document.createElement("option");
    emptyTeamOption.value = "";
    emptyTeamOption.textContent = teams.length ? "اختر الفريق" : "لا توجد فرق";
    teamSelect.append(emptyTeamOption);
    teams.forEach((team) => {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = team.data().name || "فريق";
      option.selected = user.teamId === team.id;
      teamSelect.append(option);
    });
    teamSelect.hidden = user.role !== "leader";
    teamSelect.disabled = teams.length === 0;
    role.addEventListener("change", () => {
      teamSelect.hidden = role.value !== "leader";
    });
    roleCell.append(teamSelect);
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
          if (!teamSelect.value) {
            showToast(teams.length
              ? "اختر فريقًا موجودًا قبل حفظ رتبة قائد الفريق."
              : "لا توجد فرق بعد. أنشئ فريقًا من قسم الفرق أولًا.");
            return;
          }
          changes.teamId = teamSelect.value;
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
    status.append(statusPill(request.status));
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

function stackedCell(row, primary, secondary) {
  const cell = document.createElement("td");
  const heading = document.createElement("span");
  heading.className = "cell-primary";
  heading.textContent = primary || "—";
  cell.append(heading);
  if (secondary) {
    const sub = document.createElement("span");
    sub.className = "cell-secondary";
    sub.textContent = secondary;
    cell.append(sub);
  }
  row.append(cell);
  return cell;
}

function profileLabel(documents, uid) {
  const profile = documents.find((item) => item.id === uid);
  if (!profile) return "—";
  return profile.data().displayName || profile.data().email || "—";
}

function teamLabel(documents, teamId) {
  const team = documents.find((item) => item.id === teamId);
  return team ? team.data().name || "فريق" : "—";
}

function initiativeLabel(documents, initiativeId) {
  const initiative = documents.find((item) => item.id === initiativeId);
  return initiative ? initiative.data().title || "مبادرة" : "—";
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
  return value.toDate().toLocaleDateString("ar-SA-u-nu-latn", {
    calendar: "gregory",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
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

function statusPill(status) {
  const pill = document.createElement("span");
  pill.className = `status-pill status-${status || "default"}`;
  pill.textContent = roleStatusLabel(status);
  return pill;
}

function statusCell(row, status) {
  const cell = document.createElement("td");
  cell.append(statusPill(status));
  row.append(cell);
  return cell;
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
  const [members, joinRequests, initiativeRequests, initiatives, reports, certificates] = await Promise.all([
    db.collection("volunteers").where("teamId", "==", teamId).get(),
    db.collection("teamJoinRequests").where("teamId", "==", teamId).get(),
    db.collection("initiativeRequests").where("leaderUid", "==", signedInAdmin.uid).get(),
    db.collection("initiatives").where("teamId", "==", teamId).get(),
    db.collection("reports").where("teamId", "==", teamId).get(),
    db.collection("certificates").where("teamId", "==", teamId).get()
  ]);
  leaderMembers = members.docs;
  leaderInitiatives = initiatives.docs;
  leaderCertificates = certificates.docs;
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
    leaderTeam.description || "بيانات الفريق وأعضاؤه وطلباته.";
  document.getElementById("leaderMemberCount").textContent = String(members.size);
  document.getElementById("leaderJoinRequestCount").textContent = String(
    joinRequests.docs.filter((request) => request.data().status === "pending").length
  );
  renderLeaderMembers(members.docs);
  renderLeaderJoinRequests(joinRequests.docs);
  renderLeaderInitiativeRequests(initiativeRequests.docs);
  renderLeaderInitiatives(initiatives.docs);
  renderLeaderReports(reports.docs);
  const issuedParticipationIds = new Set(
    certificates.docs
      .map((document) => document.data().participationRequestId)
      .filter(Boolean)
  );
  const participantOptions = leaderParticipants
    .filter((request) => !issuedParticipationIds.has(request.id))
    .map((request) => ({
      id: request.id,
      label: `${request.data().volunteerName || request.data().volunteerEmail} — ${
        initiatives.docs.find((item) => item.id === request.data().initiativeId)?.data().title || "مبادرة"
      }`
    }));
  const memberOptions = members.docs.map((member) => ({ id: member.id, label: member.data().displayName || member.data().email || member.id }));
  const initiativeOptions = initiatives.docs.map((item) => ({ id: item.id, label: item.data().title || item.id }));
  const certificateEmptyLabel = leaderParticipants.length && participantOptions.length === 0
    ? "صدرت شهادات لجميع المشاركين المعتمدين"
    : "اختر مشاركًا معتمدًا";
  setSelectOptions(document.getElementById("leaderNotificationRecipient"), memberOptions, "اختر متطوعًا");
  setSelectOptions(document.getElementById("leaderCertificateParticipant"), participantOptions, certificateEmptyLabel);
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
    statusCell(row, request.status);
    const action = document.createElement("td");
    if (request.status === "pending") {
      [["accepted", "قبول"], ["rejected", "رفض"]].forEach(([status, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "role-save-button";
        button.textContent = label;
        button.classList.add(status === "rejected" ? "is-danger" : "is-positive");
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
    statusCell(row, request.status);
    rowCell(row, request.reviewNote);
    const action = document.createElement("td");
    if (request.status === "revision_requested") {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "role-save-button is-warning";
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
    statusCell(row, initiative.status);
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
      button.classList.add(nextStatus === "open" ? "is-positive" : "is-warning");
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
    rowCell(row, initiative ? initiative.data().title : "مبادرة غير متاحة");
    statusCell(row, report.status);
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
  staffTeams = teams.docs;
  staffVolunteers = volunteers.docs;
  staffInitiatives = initiatives.docs;
  setSelectOptions(
    document.getElementById("staffTeamLeader"),
    staffVolunteers.map((item) => ({
      id: item.id,
      label: item.data().displayName || item.data().email || item.id
    })),
    "اختر قائد الفريق"
  );
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
    rowCell(row, team.leaderUid ? profileLabel(staffVolunteers, team.leaderUid) : "بدون قائد");
    rowCell(row, team.description);
    const action = document.createElement("td");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "role-save-button";
    edit.textContent = "تعديل";
    edit.addEventListener("click", () => openStaffTeamDialog(item));
    action.append(edit);
    row.append(action);
    rows.append(row);
  });
}

function openStaffTeamDialog(item) {
  const team = item.data();
  editingStaffTeam = item;
  const dialog = document.getElementById("staffTeamDialog");
  const form = document.getElementById("staffTeamEditForm");
  form.elements.name.value = team.name || "";
  form.elements.description.value = team.description || "";
  const leaderSelect = form.elements.leaderUid;
  leaderSelect.replaceChildren();
  if (!team.leaderUid) {
    const noLeaderOption = document.createElement("option");
    noLeaderOption.value = "";
    noLeaderOption.textContent = "بدون قائد حاليًا";
    noLeaderOption.disabled = true;
    noLeaderOption.selected = true;
    leaderSelect.append(noLeaderOption);
  }
  if (currentRole === "admin") {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "بدون قائد";
    leaderSelect.append(emptyOption);
  }
  staffVolunteers.forEach((member) => {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = member.data().displayName || member.data().email || member.id;
    leaderSelect.append(option);
  });
  if (team.leaderUid && !staffVolunteers.some((member) => member.id === team.leaderUid)) {
    const currentLeader = document.createElement("option");
    currentLeader.value = team.leaderUid;
    currentLeader.textContent = "الحساب المرتبط حاليًا (غير مسجل في قائمة المتطوعين)";
    leaderSelect.append(currentLeader);
  }
  leaderSelect.value = team.leaderUid || "";
  leaderSelect.disabled = leaderSelect.options.length <= 1 && !team.leaderUid;
  dialog.showModal();
}

const staffTeamDialog = document.getElementById("staffTeamDialog");
document.querySelectorAll("[data-team-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => staffTeamDialog.close());
});
staffTeamDialog.addEventListener("click", (event) => {
  if (event.target === staffTeamDialog) staffTeamDialog.close();
});
staffTeamDialog.addEventListener("close", () => {
  editingStaffTeam = null;
});

document.getElementById("staffTeamEditForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingStaffTeam) return;
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const name = form.elements.name.value.trim();
  if (name.length < 2) {
    showToast("اسم الفريق قصير جدًا.");
    return;
  }
  const leaderUid = form.elements.leaderUid.value;
  if (!leaderUid && currentRole !== "admin" && editingStaffTeam.data().leaderUid) {
    showToast("لا يمكن إزالة قائد الفريق. اختر قائدًا بديلًا.");
    return;
  }
  button.disabled = true;
  try {
    await editingStaffTeam.ref.update({
      name,
      leaderUid,
      description: form.elements.description.value.trim()
    });
    staffTeamDialog.close();
    showToast("تم تحديث بيانات الفريق.");
    await loadStaffDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

function renderStaffInitiativeRequests(requests) {
  const rows = document.getElementById("staffInitiativeRequestRows");
  rows.replaceChildren();
  document.getElementById("staffInitiativeRequestsEmpty").hidden = requests.length > 0;
  requests.forEach((item) => {
    const request = item.data();
    const row = document.createElement("tr");
    stackedCell(
      row,
      request.title || "مبادرة",
      request.teamName || teamLabel(staffTeams, request.teamId)
    );
    const schedule = [request.date, request.time].filter(Boolean).join(" · ");
    const details = [
      request.location,
      request.requiredVolunteers ? `${request.requiredVolunteers} متطوع` : "",
      request.hours ? `${request.hours} ساعة` : ""
    ].filter(Boolean).join(" · ");
    stackedCell(row, schedule, details);
    const attachmentCell = document.createElement("td");
    appendAttachmentLinks(attachmentCell, request.attachments);
    row.append(attachmentCell);
    statusCell(row, request.status);
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
        button.classList.add(status === "rejected" ? "is-danger" : status === "approved" ? "is-positive" : "is-warning");
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
    rowCell(row, teamLabel(staffTeams, report.teamId));
    rowCell(row, initiativeLabel(staffInitiatives, report.initiativeId));
    rowCell(row, report.content);
    const attachments = document.createElement("td");
    appendAttachmentLinks(attachments, report.attachments);
    row.append(attachments);
    statusCell(row, report.status);
    const noteCell = document.createElement("td");
    const note = document.createElement("input");
    note.className = "dialog-input";
    note.value = report.reviewNote || "";
    note.maxLength = 2000;
    note.setAttribute("aria-label", "ملاحظة مراجعة التقرير");
    noteCell.append(note);
    row.append(noteCell);
    const action = document.createElement("td");
    if (report.status === "submitted") {
      [["reviewed", "تمت المراجعة"], ["revision_requested", "إعادة للتعديل"]].forEach(([status, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "role-save-button";
        button.textContent = label;
        button.classList.add(status === "reviewed" ? "is-positive" : "is-warning");
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
    rowCell(row, user.teamId ? teamLabel(staffTeams, user.teamId) : "بدون فريق");
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
    rowCell(row, profileLabel(staffVolunteers, certificate.volunteerUid));
    rowCell(row, initiativeLabel(staffInitiatives, certificate.initiativeId));
    rowCell(row, certificate.hours);
    const certificateCell = document.createElement("td");
    if (certificate.certificateNumber) certificateCell.textContent = certificate.certificateNumber;
    if (typeof certificate.certificateUrl === "string" && /^https:\/\//i.test(certificate.certificateUrl)) {
      const link = document.createElement("a");
      link.href = certificate.certificateUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = certificate.certificateNumber ? "عرض" : "رابط الشهادة";
      if (certificateCell.textContent) certificateCell.append(document.createTextNode(" · "));
      certificateCell.append(link);
    }
    if (!certificateCell.textContent && !certificateCell.childElementCount) certificateCell.textContent = "—";
    row.append(certificateCell);
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
  renderExecutiveInitiatives(initiatives.docs, participationRequests.docs, teams.docs);
  renderExecutiveReports(reports.docs, teams.docs, initiatives.docs);
  renderExecutiveCertificates(certificates.docs, volunteers.docs, initiatives.docs);
  renderExecutiveInitiativeRequests(initiativeRequests.docs, teams.docs);
  renderExecutiveUsers(volunteers.docs, teams.docs);
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
    rowCell(row, team.leaderUid ? profileLabel(volunteers, team.leaderUid) : "بدون قائد");
    rowCell(row, countByTeam.get(item.id) || 0);
    rows.append(row);
  });
}

function renderExecutiveInitiatives(initiatives, participationRequests, teams) {
  const rows = document.getElementById("executiveInitiativeRows");
  rows.replaceChildren();
  initiatives.forEach((item) => {
    const initiative = item.data();
    const row = document.createElement("tr");
    rowCell(row, initiative.title);
    rowCell(row, initiative.teamName || teamLabel(teams, initiative.teamId));
    rowCell(row, participationRequests.filter((request) => request.data().initiativeId === item.id
      && request.data().status === "accepted").length);
    statusCell(row, initiative.status);
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
    rowCell(row, volunteer?.data().displayName || "مستخدم غير متاح");
    rowCell(row, initiative?.data().title || "مبادرة غير متاحة");
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

function renderExecutiveReports(reports, teams, initiatives) {
  const rows = document.getElementById("executiveReportRows");
  rows.replaceChildren();
  reports.forEach((item) => {
    const report = item.data();
    const row = document.createElement("tr");
    rowCell(row, teamLabel(teams, report.teamId));
    rowCell(row, initiativeLabel(initiatives, report.initiativeId));
    rowCell(row, report.content);
    const attachments = document.createElement("td");
    appendAttachmentLinks(attachments, report.attachments);
    row.append(attachments);
    statusCell(row, report.status);
    rows.append(row);
  });
}

function renderExecutiveInitiativeRequests(requests, teams) {
  const rows = document.getElementById("executiveInitiativeRequestRows");
  rows.replaceChildren();
  requests.forEach((item) => {
    const request = item.data();
    const row = document.createElement("tr");
    rowCell(row, request.title);
    rowCell(row, request.teamName || teamLabel(teams, request.teamId));
    statusCell(row, request.status);
    rowCell(row, request.reviewNote);
    const attachments = document.createElement("td");
    appendAttachmentLinks(attachments, request.attachments);
    row.append(attachments);
    rows.append(row);
  });
}

function renderExecutiveUsers(volunteers, teams) {
  const rows = document.getElementById("executiveUserRows");
  rows.replaceChildren();
  document.getElementById("executiveUsersEmpty").hidden = volunteers.length > 0;
  volunteers.forEach((item) => {
    const user = item.data();
    const row = document.createElement("tr");
    rowCell(row, user.displayName);
    rowCell(row, user.email);
    rowCell(row, item.id);
    const currentTeam = teams.find((team) => team.id === user.teamId);
    rowCell(row, currentTeam?.data().name || "—");
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
    const teamSelect = document.createElement("select");
    teamSelect.className = "user-role-select leader-team-select";
    teamSelect.setAttribute("aria-label", `فريق القائد ${user.displayName || user.email}`);
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = teams.length ? "اختر الفريق" : "لا توجد فرق";
    teamSelect.append(emptyOption);
    teams.forEach((team) => {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = team.data().name || `فريق (${team.id})`;
      option.selected = user.role === "leader" && user.teamId === team.id;
      teamSelect.append(option);
    });
    teamSelect.hidden = user.role !== "leader";
    role.addEventListener("change", () => {
      teamSelect.hidden = role.value !== "leader";
      if (role.value === "leader" && user.teamId) teamSelect.value = user.teamId;
    });
    roleCell.append(teamSelect);
    row.append(roleCell);
    const action = document.createElement("td");
    const save = document.createElement("button");
    save.type = "button";
    save.className = "role-save-button";
    save.textContent = "حفظ";
    save.addEventListener("click", async () => {
      try {
        if (role.value === "leader" && !teamSelect.value) {
          showToast("اختر فريقًا موجودًا قبل تعيين قائد الفريق.");
          return;
        }
        const selectedTeam = teams.find((team) => team.id === teamSelect.value);
        const currentTeamLeader = selectedTeam?.data().leaderUid;
        if (
          role.value === "leader"
          && currentTeamLeader
          && currentTeamLeader !== item.id
          && !window.confirm("هذا الفريق مرتبط بقائد حالي. عند المتابعة تنتقل القيادة إلى المستخدم المحدد وتُعاد رتبة القائد السابق إلى متطوع. هل تريد المتابعة؟")
        ) return;
        await saveVolunteerRole(item, role.value, teamSelect.value);
        showToast("تم تحديث الرتبة وربطها بالفريق المحدد.");
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

async function saveVolunteerRole(item, role, teamId) {
  const userRef = item.ref;
  await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) throw new Error("لم يعد حساب المستخدم موجودًا.");
    const currentUser = userSnapshot.data();
    const selectedTeamRef = role === "leader" ? db.collection("teams").doc(teamId) : null;
    const currentTeamRef = currentUser.role === "leader" && currentUser.teamId
      ? db.collection("teams").doc(currentUser.teamId)
      : null;
    const selectedTeamSnapshot = selectedTeamRef
      ? await transaction.get(selectedTeamRef)
      : null;
    const currentTeamSnapshot = currentTeamRef
      && currentTeamRef.id !== selectedTeamRef?.id
      ? await transaction.get(currentTeamRef)
      : currentTeamSnapshotForSameTeam(currentTeamRef, selectedTeamSnapshot);
    if (selectedTeamSnapshot && !selectedTeamSnapshot.exists) {
      throw new Error("الفريق المحدد لم يعد موجودًا. حدّث القائمة وحاول مجددًا.");
    }

    const previousLeaderUid = selectedTeamSnapshot?.data().leaderUid;
    const previousLeaderRef = role === "leader"
      && previousLeaderUid
      && previousLeaderUid !== item.id
      ? db.collection("volunteers").doc(previousLeaderUid)
      : null;
    const previousLeaderSnapshot = previousLeaderRef
      ? await transaction.get(previousLeaderRef)
      : null;

    if (
      currentTeamRef
      && currentTeamRef.id !== selectedTeamRef?.id
      && currentTeamSnapshot?.exists
      && currentTeamSnapshot.data().leaderUid === item.id
    ) {
      transaction.update(currentTeamRef, { leaderUid: "" });
    } else if (
      role !== "leader"
      && currentTeamRef
      && currentTeamRef.id === selectedTeamRef?.id
      && currentTeamSnapshot?.exists
      && currentTeamSnapshot.data().leaderUid === item.id
    ) {
      transaction.update(currentTeamRef, { leaderUid: "" });
    }

    if (previousLeaderSnapshot?.exists) {
      const previousLeader = previousLeaderSnapshot.data();
      if (previousLeader.role === "leader" && previousLeader.teamId === teamId) {
        transaction.update(previousLeaderRef, {
          role: "volunteer",
          teamId: firebase.firestore.FieldValue.delete()
        });
      }
    }

    const changes = { role };
    if (role === "leader") {
      changes.teamId = teamId;
      if (selectedTeamSnapshot.data().leaderUid !== item.id) {
        transaction.update(selectedTeamRef, { leaderUid: item.id });
      }
    } else if (currentUser.teamId) {
      changes.teamId = firebase.firestore.FieldValue.delete();
    }
    transaction.update(userRef, changes);
  });
}

function currentTeamSnapshotForSameTeam(currentTeamRef, selectedTeamSnapshot) {
  return currentTeamRef?.id === selectedTeamSnapshot?.ref?.id
    ? selectedTeamSnapshot
    : null;
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
  if (leaderCertificates.some((document) => document.data().participationRequestId === participationRequest.id)) {
    showToast("تم إصدار شهادة لهذا المشارك مسبقًا.");
    await loadLeaderDashboard();
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
    const existingCertificate = await db.collection("certificates")
      .where("participationRequestId", "==", participationRequest.id)
      .limit(1)
      .get();
    if (!existingCertificate.empty) {
      showToast("تم إصدار شهادة لهذا المشارك مسبقًا.");
      await loadLeaderDashboard();
      return;
    }
    await db.collection("certificates").add(certificate);
    form.reset();
    showToast("تم إصدار الشهادة وتسجيل الساعات.");
    await loadLeaderDashboard();
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
  const name = String(data.get("name") || "").trim();
  const leaderUid = String(data.get("leaderUid") || "").trim();
  if (!name) {
    showToast("أدخل اسم الفريق.");
    return;
  }
  if (!leaderUid) {
    showToast("اختر قائد الفريق من القائمة.");
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const team = {
      name,
      leaderUid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const description = String(data.get("description")).trim();
    if (description) team.description = description;
    await db.collection("teams").add(team);
    form.reset();
    showToast(`تم إنشاء فريق «${team.name}» بنجاح.`);
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
