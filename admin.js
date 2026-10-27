const firebaseConfig = window.firebaseConfig || {};
const firebaseReady = typeof firebase !== "undefined"
  && Object.values(firebaseConfig).every((value) => typeof value === "string" && value.trim());
const auth = firebaseReady ? firebase.auth() : null;
const db = firebaseReady ? firebase.firestore() : null;
const storage = firebaseReady && typeof firebase.storage === "function" ? firebase.storage() : null;
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
let leaderReports = [];
let leaderLetters = [];
let staffTeams = [];
let founderTeams = [];
let staffVolunteers = [];
let staffInitiatives = [];
let editingStaffTeam = null;
let editingInitiativeId = null;
let archiveLetters = [];
let editingArchiveLetterId = null;
let editingArchiveAttachments = [];
let editingInitiativeRequestId = null;
let editingCertificateId = null;
let editingReportId = null;
let reportPreviewUrls = [];
let toastTimer;

const REPORT_PHOTO_LIMIT = 8;
const REPORT_PHOTO_BYTES = 5 * 1024 * 1024;
const REPORT_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACTIVE_CERTIFICATE_STATUSES = ["pending", "approved", "issued"];
const letterRecipientLabels = {
  staff: "إدارة العمل التطوعي",
  executive: "الإدارة التنفيذية",
  both: "كلتا الإدارتين"
};

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
    initiatives: "#adminInitiativesPanel",
    addInitiative: "#adminInitiativeFormPanel",
    teams: "#staffTeamPanel",
    users: "#adminUsersPanel",
    requests: "#adminRequestsPanel",
    reports: "#staffReportsPanel",
    certificates: "#staffCertificatesPanel",
    letters: "#staffLettersPanel",
    archive: "#letterArchivePanel"
  },
  leader: {
    initiatives: "#leaderInitiativesPanel",
    teams: "#leaderTeamName",
    requests: "#leaderJoinRequestsPanel",
    reports: "#leaderReportsPanel",
    certificates: "#leaderCertificatesPanel",
    letters: "#leaderLettersPanel"
  },
  staff: {
    teams: "#staffTeamPanel",
    requests: "#staffInitiativeRequestsPanel",
    reports: "#staffReportsPanel",
    certificates: "#staffCertificatesPanel",
    letters: "#staffLettersPanel",
    archive: "#letterArchivePanel"
  },
  executive: {
    initiatives: "#executiveInitiativeRows",
    teams: "#executiveTeamRows",
    users: "#executiveUsersPanel",
    requests: "#executiveInitiativeRequestRows",
    reports: "#executiveReportRows",
    certificates: "#executiveCertificateRows",
    letters: "#executiveLettersPanel",
    archive: "#executiveLetterArchivePanel"
  }
};

const adminNavigationLabels = {
  admin: {
    initiatives: "المبادرات المنشورة",
    addInitiative: "إضافة مبادرة",
    users: "حسابات المستخدمين",
    requests: "طلبات المشاركة",
    reports: "مراجعة التقارير",
    certificates: "الساعات والشهادات",
    letters: "الخطابات الواردة"
  },
  leader: {
    initiatives: "مبادرات الفريق",
    teams: "فريقي",
    requests: "طلبات الانضمام",
    reports: "تقارير الإغلاق",
    certificates: "شهاداتي",
    letters: "خطاباتي"
  },
  staff: {
    teams: "الفرق",
    requests: "طلبات المبادرات",
    reports: "مراجعة التقارير",
    certificates: "الساعات والشهادات",
    letters: "الخطابات الواردة",
    archive: "أرشيف الخطابات"
  },
  executive: {
    initiatives: "المبادرات",
    teams: "الفرق",
    users: "إدارة الرتب",
    requests: "طلبات المبادرات",
    reports: "التقارير",
    certificates: "الشهادات",
    letters: "الخطابات",
    archive: "أرشيف الخطابات"
  }
};

function closeAdminMenu() {
  const menu = document.getElementById("adminQuickMenu");
  const toggle = document.getElementById("adminMenuToggle");
  menu.classList.remove("is-open");
  menu.style.maxHeight = "";
  toggle.setAttribute("aria-expanded", "false");
}

document.getElementById("adminMenuToggle").addEventListener("click", () => {
  const menu = document.getElementById("adminQuickMenu");
  const toggle = document.getElementById("adminMenuToggle");
  const opening = !menu.classList.contains("is-open");
  menu.classList.toggle("is-open", opening);
  menu.style.maxHeight = opening
    ? `${Math.max(200, window.innerHeight - toggle.getBoundingClientRect().bottom - 24)}px`
    : "";
  toggle.setAttribute("aria-expanded", String(opening));
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 900) closeAdminMenu();
});

function renderAdminNav() {
  const menu = document.getElementById("adminQuickMenu");
  const labels = adminNavigationLabels[currentRole] || {};
  menu.querySelectorAll("[data-admin-section]").forEach((button) => {
    const section = button.dataset.adminSection;
    button.hidden = !(section === "home"
      || section === "profile"
      || Boolean(adminNavigationTargets[currentRole]?.[section]));
    button.classList.toggle("active", section === "home");
    const label = button.querySelector(".admin-nav-label");
    if (label) {
      if (!button.dataset.defaultLabel) button.dataset.defaultLabel = label.textContent;
      label.textContent = labels[section] || button.dataset.defaultLabel;
    }
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
  if (messages[error?.code]) return messages[error.code];
  if (!error?.code && typeof error?.message === "string" && /[\u0600-\u06FF]/.test(error.message)) {
    return error.message;
  }
  return "حدث خطأ غير متوقع. حاول مرة أخرى أو تواصل مع إدارة المنصة.";
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

async function signInAdminAccount(identifier, password) {
  if (identifier.includes("@")) {
    return auth.signInWithEmailAndPassword(identifier, password);
  }
  let usernameError = null;
  try {
    const result = await functions.httpsCallable("usernameSignIn")({
      username: identifier,
      password,
      apiKey: firebaseConfig.apiKey
    });
    return await auth.signInWithCustomToken(result.data.customToken);
  } catch (error) {
    usernameError = error;
  }
  try {
    return await auth.signInWithEmailAndPassword(
      `${identifier.toLowerCase()}@admin.nbda-1ee36.firebaseapp.com`,
      password
    );
  } catch (fallbackError) {
    throw usernameError;
  }
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
    showToast("أدخل البريد الإلكتروني أو اسم المستخدم وكلمة المرور.");
    return;
  }
  button.disabled = true;
  button.textContent = "جارٍ التحقق من الحساب...";
  try {
    await signInAdminAccount(username, password);
    document.getElementById("adminPassword").value = "";
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
    if (["admin", "staff", "executive"].includes(currentRole)) {
      await loadLetterArchive();
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
  founderTeams = teamsSnapshot.docs;
  renderUsers(volunteersSnapshot.docs, administratorsSnapshot.docs, teamsSnapshot.docs);
  renderInitiatives(initiativesSnapshot.docs);
  renderInitiativeTeamOptions();
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
        if (newRole === "leader" && !teamSelect.value) {
          showToast(teams.length
            ? "اختر فريقًا موجودًا قبل حفظ رتبة قائد الفريق."
            : "لا توجد فرق بعد. أنشئ فريقًا من قسم الفرق أولًا.");
          return;
        }
        const selectedTeam = teams.find((team) => team.id === teamSelect.value);
        const currentTeamLeader = selectedTeam?.data().leaderUid;
        if (
          newRole === "leader"
          && currentTeamLeader
          && currentTeamLeader !== userDocument.id
          && !window.confirm("هذا الفريق مرتبط بقائد حالي. عند المتابعة تنتقل القيادة إلى المستخدم المحدد وتُعاد رتبة القائد السابق إلى متطوع. هل تريد المتابعة؟")
        ) return;
        await saveVolunteerRole(userDocument, newRole, newRole === "leader" ? teamSelect.value : "");
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

function initiativeStatusLabel(initiative) {
  if (initiative.status === "open") {
    return initiative.published === true ? "التسجيل مفتوح" : "مفتوحة · غير منشورة";
  }
  if (initiative.status === "closed") return "مغلقة";
  if (initiative.status === "approved") return "معتمدة · غير منشورة";
  if (initiative.status === "rejected") return "مرفوضة";
  return "غير متاحة";
}

function renderInitiativeTeamOptions() {
  const createSelect = document.getElementById("initiativeTeam");
  if (createSelect) {
    setSelectOptions(
      createSelect,
      founderTeams.map((item) => ({ id: item.id, label: item.data().name || "فريق" })),
      founderTeams.length ? "اختر الفريق المنفذ" : "لا توجد فرق — أنشئ فريقًا أولًا"
    );
  }
  const editSelect = document.getElementById("initiativeEditTeam");
  if (!editSelect) return;
  const currentValue = editSelect.value;
  editSelect.replaceChildren();
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = founderTeams.length ? "بدون تغيير / بدون فريق" : "لا توجد فرق متاحة";
  editSelect.append(emptyOption);
  founderTeams.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.data().name || "فريق";
    editSelect.append(option);
  });
  editSelect.value = currentValue;
  editSelect.disabled = founderTeams.length === 0;
}

function renderInitiatives(initiatives) {
  const rows = document.getElementById("adminInitiativeRows");
  rows.replaceChildren();
  document.getElementById("initiativesEmpty").hidden = initiatives.length > 0;
  initiatives.forEach((item) => {
    const initiative = item.data();
    const row = document.createElement("tr");
    rowCell(row, initiative.title || "مبادرة");
    rowCell(row, initiative.teamId ? teamLabel(founderTeams, initiative.teamId) : "بدون فريق");
    rowCell(row, initiative.date || "—");
    rowCell(row, initiativeStatusLabel(initiative));
    const publishedCell = document.createElement("td");
    const published = document.createElement("input");
    published.type = "checkbox";
    published.checked = initiative.published === true;
    published.disabled = initiative.status !== "open";
    published.title = initiative.status === "open"
      ? "إظهار المبادرة في الموقع العام أو إخفاؤها"
      : "النشر المباشر متاح للمبادرات المفتوحة فقط. استخدم زر الاعتماد للمبادرة المعتمدة.";
    published.setAttribute("aria-label", `نشر ${initiative.title}`);
    published.addEventListener("change", async () => {
      try {
        await item.ref.update({ published: published.checked });
        showToast(published.checked ? "ظهرت المبادرة في الموقع العام." : "تم إخفاء المبادرة من الموقع العام.");
        await loadDashboard();
      } catch (error) {
        published.checked = !published.checked;
        showToast(errorMessage(error));
      }
    });
    publishedCell.append(published);

    const actionCell = document.createElement("td");
    actionCell.className = "table-action-cell";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "role-save-button";
    editButton.textContent = "تعديل";
    editButton.addEventListener("click", () => openInitiativeEdit(item));
    const acceptButton = document.createElement("button");
    acceptButton.type = "button";
    acceptButton.className = "role-save-button is-positive";
    acceptButton.textContent = initiative.status === "closed" ? "إعادة فتح ونشر" : "قبول ونشر";
    acceptButton.disabled = initiative.status === "open" && initiative.published === true;
    acceptButton.addEventListener("click", () => decideInitiative(item, "accept", acceptButton));
    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "role-save-button is-warning";
    rejectButton.textContent = initiative.published === true ? "رفض وإخفاء" : "رفض";
    rejectButton.disabled = initiative.status === "rejected" || initiative.status === "closed";
    rejectButton.addEventListener("click", () => decideInitiative(item, "reject", rejectButton));
    actionCell.append(editButton, acceptButton, rejectButton);

    row.append(publishedCell, actionCell);
    rows.append(row);
  });
}

async function decideInitiative(item, decision, button) {
  button.disabled = true;
  try {
    if (decision === "accept") {
      const reopening = item.data().status === "closed";
      if (reopening && !window.confirm("هذه المبادرة مغلقة. إعادة فتحها ستتيح التسجيل والتنفيذ من جديد. هل تريد المتابعة؟")) {
        button.disabled = false;
        return;
      }
      await item.ref.update({ published: true, status: "open" });
      showToast(reopening
        ? "تمت إعادة فتح المبادرة ونشرها في الموقع العام."
        : "تم قبول المبادرة ونشرها في الموقع العام.");
    } else {
      const wasPublished = item.data().published === true;
      await item.ref.update({ published: false, status: "rejected" });
      showToast(wasPublished
        ? "تم رفض المبادرة وإخفاؤها من الموقع العام."
        : "تم رفض المبادرة.");
    }
    await loadDashboard();
  } catch (error) {
    button.disabled = false;
    showToast(errorMessage(error));
  }
}

function openInitiativeEdit(item) {
  const initiative = item.data();
  editingInitiativeId = item.id;
  const dialog = document.getElementById("initiativeEditDialog");
  const form = document.getElementById("initiativeEditForm");
  form.elements.title.value = initiative.title || "";
  form.elements.description.value = initiative.description || "";
  form.elements.category.value = initiative.category || "";
  form.elements.date.value = initiative.date || "";
  form.elements.location.value = initiative.location || "";
  form.elements.hours.value = initiative.hours ?? "";
  if (form.elements.teamId) form.elements.teamId.value = initiative.teamId || "";
  dialog.showModal();
}

const initiativeEditDialog = document.getElementById("initiativeEditDialog");
document.querySelectorAll("[data-initiative-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => initiativeEditDialog.close());
});
initiativeEditDialog.addEventListener("click", (event) => {
  if (event.target === initiativeEditDialog) initiativeEditDialog.close();
});
initiativeEditDialog.addEventListener("close", () => {
  editingInitiativeId = null;
});

document.getElementById("initiativeEditForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingInitiativeId) return;
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const title = form.elements.title.value.trim();
  const description = form.elements.description.value.trim();
  const category = form.elements.category.value.trim();
  const date = form.elements.date.value;
  const location = form.elements.location.value.trim();
  const hours = Number(form.elements.hours.value);
  if (title.length < 2 || description.length < 10 || category.length < 2 || !date || !location) {
    showToast("أكمل بيانات المبادرة (الاسم والوصف والمجال والتاريخ والموقع).");
    return;
  }
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) {
    showToast("أدخل عدد ساعات صحيحًا من 1 إلى 24.");
    return;
  }
  const updates = { title, description, category, date, location, hours };
  const teamId = form.elements.teamId?.value || "";
  if (teamId) {
    const team = founderTeams.find((item) => item.id === teamId);
    if (!team) {
      showToast("الفريق المحدد لم يعد موجودًا. حدّث الصفحة وحاول مجددًا.");
      return;
    }
    updates.teamId = team.id;
    updates.teamName = team.data().name || "فريق";
    updates.leaderUid = team.data().leaderUid || "";
  }
  button.disabled = true;
  try {
    await db.collection("initiatives").doc(editingInitiativeId).update(updates);
    initiativeEditDialog.close();
    showToast(teamId ? "تم تحديث بيانات المبادرة وربطها بالفريق." : "تم تحديث بيانات المبادرة.");
    await loadDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

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
    accepted: "مقبول",
    issued: "صادر",
    sent: "مرسل"
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

function certificateStatus(certificate) {
  return certificate.status || "issued";
}

function isCertificateActive(certificate) {
  return ACTIVE_CERTIFICATE_STATUSES.includes(certificateStatus(certificate));
}

function impactLabel(record) {
  if (!Number.isFinite(Number(record.volunteersCount)) && !Number.isFinite(Number(record.beneficiariesCount))) {
    return "—";
  }
  const volunteers = Number(record.volunteersCount) || 0;
  const beneficiaries = Number(record.beneficiariesCount) || 0;
  return `${volunteers} متطوع · ${beneficiaries} مستفيد`;
}

function attendanceCell(row, record) {
  const cell = document.createElement("td");
  const summary = record.attendanceSummary;
  const entries = Array.isArray(record.attendance) ? record.attendance : [];
  if (!summary && !entries.length) {
    cell.textContent = "—";
    row.append(cell);
    return cell;
  }
  const registered = Number(summary?.registered ?? entries.length) || 0;
  const present = Number(summary?.present ?? entries.filter((entry) => entry.status === "present").length) || 0;
  const absent = Number(summary?.absent ?? Math.max(registered - present, 0)) || 0;
  const rate = Number(summary?.rate ?? (registered ? Math.round((present / registered) * 100) : 0)) || 0;
  const label = document.createElement("span");
  label.className = "attendance-summary-label";
  label.textContent = `${present}/${registered} حضور · ${rate}%`;
  label.title = `غائب: ${absent}`;
  cell.append(label);
  if (entries.length) {
    const details = document.createElement("details");
    details.className = "attendance-details";
    const summaryTag = document.createElement("summary");
    summaryTag.textContent = "قائمة الحضور";
    details.append(summaryTag);
    const list = document.createElement("ul");
    list.className = "attendance-list";
    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = entry.status === "absent" ? "is-absent" : "is-present";
      const name = document.createElement("strong");
      name.textContent = entry.name || "—";
      const state = document.createElement("span");
      state.textContent = entry.status === "absent" ? "غائب" : "حضر";
      item.append(name, state);
      if (entry.phone) {
        const phone = document.createElement("a");
        phone.href = `tel:${entry.phone}`;
        phone.textContent = entry.phone;
        item.append(phone);
      }
      if (entry.note) {
        const note = document.createElement("small");
        note.textContent = entry.note;
        item.append(note);
      }
      list.append(item);
    });
    details.append(list);
    cell.append(details);
  }
  row.append(cell);
  return cell;
}

function photoCell(row, urls) {
  const cell = document.createElement("td");
  const valid = (Array.isArray(urls) ? urls : []).filter(
    (value) => typeof value === "string" && /^https:\/\//i.test(value)
  );
  if (!valid.length) {
    cell.textContent = "—";
    row.append(cell);
    return cell;
  }
  const strip = document.createElement("div");
  strip.className = "photo-strip";
  valid.forEach((url, index) => {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `فتح الصورة التوثيقية ${index + 1}`);
    const image = document.createElement("img");
    image.src = url;
    image.alt = `صورة توثيقية ${index + 1}`;
    image.loading = "lazy";
    link.append(image);
    strip.append(link);
  });
  cell.append(strip);
  row.append(cell);
  return cell;
}

function messageCell(row, text) {
  const cell = rowCell(row, text);
  cell.classList.add("table-message-cell");
  return cell;
}

function letterBodyCell(row, body) {
  const cell = rowCell(row, body);
  cell.classList.add("table-message-cell", "letter-body-cell");
  return cell;
}

function openCertificateDocument(certificate) {
  if (!window.NabdCertificates) {
    showToast("تعذر تحميل أداة الشهادة. حدّث الصفحة وحاول مجددًا.");
    return;
  }
  window.NabdCertificates.open(certificate);
}

function validateReportPhotos(files) {
  if (!files.length) throw new Error("أرفق صورة توثيقية واحدة على الأقل للمبادرة.");
  if (files.length > REPORT_PHOTO_LIMIT) {
    throw new Error(`يمكن إرفاق ${REPORT_PHOTO_LIMIT} صور كحد أقصى.`);
  }
  files.forEach((file) => {
    if (!REPORT_PHOTO_TYPES.includes(file.type)) {
      throw new Error("الصيغ المدعومة للصور: JPG أو PNG أو WEBP.");
    }
    if (file.size > REPORT_PHOTO_BYTES) {
      throw new Error(`حجم الصورة «${file.name}» يتجاوز 5 ميجابايت.`);
    }
  });
}

async function uploadReportPhotos(reportId, files, onProgress) {
  if (!storage) {
    throw new Error("خدمة تخزين الصور غير مفعّلة. تواصل مع إدارة المنصة.");
  }
  const urls = [];
  const uploaded = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (onProgress) onProgress(index + 1, files.length);
      const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
      const reference = storage.ref(
        `reports/${leaderTeam.id}/${reportId}/${Date.now()}-${index + 1}.${extension}`
      );
      await reference.put(file, { contentType: file.type });
      uploaded.push(reference);
      urls.push(await reference.getDownloadURL());
    }
    return urls;
  } catch (error) {
    await Promise.allSettled(uploaded.map((reference) => reference.delete()));
    throw error;
  }
}

async function fetchLettersFor(roles) {
  const snapshots = await Promise.all(
    roles.map((recipient) => db.collection("letters").where("recipient", "==", recipient).get())
  );
  return snapshots
    .flatMap((snapshot) => snapshot.docs)
    .sort((a, b) =>
      (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0)
    );
}

const ARCHIVE_FILE_LIMIT = 5;
const ARCHIVE_FILE_BYTES = 10 * 1024 * 1024;
const ARCHIVE_FILE_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"];

function archiveFileExtension(name) {
  return (String(name).split(".").pop() || "").toLowerCase();
}

function validateArchiveFiles(files) {
  files.forEach((file) => {
    if (!ARCHIVE_FILE_EXTENSIONS.includes(archiveFileExtension(file.name))) {
      throw new Error(`صيغة الملف «${file.name}» غير مدعومة. استخدم PDF أو صورة أو Word.`);
    }
    if (file.size > ARCHIVE_FILE_BYTES) {
      throw new Error(`حجم الملف «${file.name}» يتجاوز 10 ميغابايت.`);
    }
  });
}

function archiveContentType(file) {
  const allowed = [
    "application/pdf", "image/jpeg", "image/png", "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];
  if (allowed.includes(file.type)) return file.type;
  return {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }[archiveFileExtension(file.name)] || "application/pdf";
}

async function uploadArchiveFiles(letterId, files, onProgress) {
  if (!storage) {
    throw new Error("خدمة تخزين المرفقات غير مفعّلة. تواصل مع إدارة المنصة.");
  }
  const urls = [];
  const uploaded = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (onProgress) onProgress(index + 1, files.length);
      const extension = archiveFileExtension(file.name) || "pdf";
      const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-60);
      const fileName = safeName.toLowerCase().endsWith(`.${extension}`) ? safeName : `${safeName}.${extension}`;
      const reference = storage.ref(
        `letterArchive/${letterId}/${Date.now()}-${index + 1}-${fileName}`
      );
      await reference.put(file, { contentType: archiveContentType(file) });
      uploaded.push(reference);
      urls.push(await reference.getDownloadURL());
    }
    return urls;
  } catch (error) {
    await Promise.allSettled(uploaded.map((reference) => reference.delete()));
    throw error;
  }
}

function archiveFileName(url) {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const name = path.split("/").pop() || "مرفق";
    return name.replace(/^\d{10,}-\d+-/, "") || name;
  } catch (error) {
    return "مرفق";
  }
}

function archiveDownloadUrl(url) {
  if (!/firebasestorage|googleapis/i.test(url)) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}download=${encodeURIComponent(archiveFileName(url))}`;
}

function archiveAttachmentNodes(urls) {
  const list = document.createElement("div");
  list.className = "archive-letter-files";
  const valid = (Array.isArray(urls) ? urls : []).filter(
    (value) => typeof value === "string" && /^https:\/\//i.test(value)
  );
  if (!valid.length) {
    const empty = document.createElement("span");
    empty.className = "archive-files-empty";
    empty.textContent = "لا توجد مرفقات.";
    list.append(empty);
    return list;
  }
  valid.forEach((url, index) => {
    const item = document.createElement("div");
    item.className = "archive-file-item";
    const name = document.createElement("span");
    name.textContent = archiveFileName(url) || `مرفق ${index + 1}`;
    const view = document.createElement("a");
    view.href = url;
    view.target = "_blank";
    view.rel = "noopener noreferrer";
    view.textContent = "عرض";
    const download = document.createElement("a");
    download.href = archiveDownloadUrl(url);
    download.target = "_blank";
    download.rel = "noopener noreferrer";
    download.textContent = "تنزيل";
    item.append(name, view, download);
    list.append(item);
  });
  return list;
}

function archiveAttachmentCell(row, urls) {
  const cell = document.createElement("td");
  const valid = (Array.isArray(urls) ? urls : []).filter(
    (value) => typeof value === "string" && /^https:\/\//i.test(value)
  );
  if (!valid.length) {
    cell.textContent = "—";
    row.append(cell);
    return cell;
  }
  valid.forEach((url, index) => {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = archiveFileName(url) || `مرفق ${index + 1}`;
    link.title = "فتح المرفق في نافذة جديدة";
    cell.append(link);
    if (index < valid.length - 1) cell.append(document.createElement("br"));
  });
  row.append(cell);
  return cell;
}

async function loadLetterArchive() {
  try {
    const snapshot = await db.collection("letterArchive").orderBy("letterDate", "desc").get();
    archiveLetters = snapshot.docs;
  } catch (error) {
    archiveLetters = [];
    if (error.code === "permission-denied") {
      showToast("تعذر تحميل أرشيف الخطابات. تأكد من نشر قواعد Firestore المحدثة.");
    } else {
      showToast(errorMessage(error));
    }
  }
  renderArchiveLetters();
  renderExecutiveArchiveLetters();
}

function archiveSearchMatches(letter, term) {
  if (!term) return true;
  const haystack = `${letter.subject || ""} ${letter.entityName || ""}`.toLowerCase();
  return haystack.includes(term);
}

function renderArchiveLetters() {
  const rows = document.getElementById("letterArchiveRows");
  if (!rows) return;
  const term = (document.getElementById("letterArchiveSearch")?.value || "").trim().toLowerCase();
  rows.replaceChildren();
  const visible = archiveLetters.filter((item) => archiveSearchMatches(item.data(), term));
  document.getElementById("letterArchiveEmpty").hidden = visible.length > 0;
  visible.forEach((item) => {
    const letter = item.data();
    const row = document.createElement("tr");
    rowCell(row, letter.subject);
    rowCell(row, letter.entityName);
    rowCell(row, letter.letterDate);
    messageCell(row, letter.description);
    archiveAttachmentCell(row, letter.attachments);
    const action = document.createElement("td");
    action.className = "table-action-cell";
    const view = document.createElement("button");
    view.type = "button";
    view.className = "role-save-button";
    view.textContent = "عرض";
    view.addEventListener("click", () => openArchiveLetter(letter));
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "role-save-button is-positive";
    edit.textContent = "تعديل";
    edit.addEventListener("click", () => prepareArchiveEdit(item));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "role-save-button is-danger";
    remove.textContent = "حذف";
    remove.addEventListener("click", () => deleteArchiveLetter(item, remove));
    action.append(view, edit, remove);
    row.append(action);
    rows.append(row);
  });
}

function renderExecutiveArchiveLetters() {
  const rows = document.getElementById("executiveArchiveRows");
  if (!rows) return;
  const term = (document.getElementById("executiveArchiveSearch")?.value || "").trim().toLowerCase();
  rows.replaceChildren();
  const visible = archiveLetters.filter((item) => archiveSearchMatches(item.data(), term));
  document.getElementById("executiveArchiveEmpty").hidden = visible.length > 0;
  visible.forEach((item) => {
    const letter = item.data();
    const row = document.createElement("tr");
    rowCell(row, letter.subject);
    rowCell(row, letter.entityName);
    rowCell(row, letter.letterDate);
    messageCell(row, letter.description);
    archiveAttachmentCell(row, letter.attachments);
    rows.append(row);
  });
}

function openArchiveLetter(letter) {
  const dialog = document.getElementById("archiveLetterDialog");
  document.getElementById("archiveLetterViewSubject").textContent = letter.subject || "—";
  document.getElementById("archiveLetterViewEntity").textContent = letter.entityName || "—";
  document.getElementById("archiveLetterViewDate").textContent = letter.letterDate
    ? `تاريخ الخطاب: ${letter.letterDate}`
    : "—";
  document.getElementById("archiveLetterViewDescription").textContent = letter.description || "—";
  const attachments = document.getElementById("archiveLetterViewAttachments");
  attachments.replaceChildren(archiveAttachmentNodes(letter.attachments));
  dialog.showModal();
}

const archiveLetterDialog = document.getElementById("archiveLetterDialog");
document.querySelectorAll("[data-archive-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => archiveLetterDialog.close());
});
archiveLetterDialog.addEventListener("click", (event) => {
  if (event.target === archiveLetterDialog) archiveLetterDialog.close();
});

function renderArchiveExistingAttachments() {
  const container = document.getElementById("letterArchiveAttachmentList");
  container.replaceChildren();
  if (!editingArchiveAttachments.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  editingArchiveAttachments.forEach((url) => {
    const item = document.createElement("div");
    item.className = "archive-file-item";
    const name = document.createElement("span");
    name.textContent = archiveFileName(url);
    const view = document.createElement("a");
    view.href = url;
    view.target = "_blank";
    view.rel = "noopener noreferrer";
    view.textContent = "عرض";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "archive-file-remove";
    remove.textContent = "إزالة";
    remove.addEventListener("click", () => {
      editingArchiveAttachments = editingArchiveAttachments.filter((value) => value !== url);
      renderArchiveExistingAttachments();
    });
    item.append(name, view, remove);
    container.append(item);
  });
}

function resetArchiveForm() {
  editingArchiveLetterId = null;
  editingArchiveAttachments = [];
  const form = document.getElementById("letterArchiveForm");
  form.reset();
  document.getElementById("letterArchiveAttachmentList").replaceChildren();
  document.getElementById("letterArchiveAttachmentList").hidden = true;
  document.getElementById("letterArchiveCancel").hidden = true;
  form.querySelector("button[type=submit]").textContent = "حفظ الخطاب";
}

function prepareArchiveEdit(item) {
  const letter = item.data();
  editingArchiveLetterId = item.id;
  editingArchiveAttachments = Array.isArray(letter.attachments) ? [...letter.attachments] : [];
  const form = document.getElementById("letterArchiveForm");
  form.elements.subject.value = letter.subject || "";
  form.elements.entityName.value = letter.entityName || "";
  form.elements.letterDate.value = letter.letterDate || "";
  form.elements.description.value = letter.description || "";
  document.getElementById("letterArchiveFiles").value = "";
  renderArchiveExistingAttachments();
  document.getElementById("letterArchiveCancel").hidden = false;
  form.querySelector("button[type=submit]").textContent = "حفظ التعديلات";
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

document.getElementById("letterArchiveCancel").addEventListener("click", resetArchiveForm);
document.getElementById("letterArchiveSearch").addEventListener("input", renderArchiveLetters);
document.getElementById("executiveArchiveSearch").addEventListener("input", renderExecutiveArchiveLetters);

document.getElementById("letterArchiveForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const subject = form.elements.subject.value.trim();
  const entityName = form.elements.entityName.value.trim();
  const letterDate = form.elements.letterDate.value;
  const description = form.elements.description.value.trim();
  if (subject.length < 3 || subject.length > 200) {
    showToast("اسم الخطاب يجب أن يكون بين 3 و200 حرف.");
    return;
  }
  if (entityName.length < 2 || entityName.length > 160) {
    showToast("أدخل اسم الجهة بشكل صحيح.");
    return;
  }
  if (!letterDate) {
    showToast("حدّد تاريخ الخطاب.");
    return;
  }
  if (description.length < 10 || description.length > 5000) {
    showToast("وصف الخطاب يجب أن يكون بين 10 و5000 حرف.");
    return;
  }
  const files = [...document.getElementById("letterArchiveFiles").files];
  if (editingArchiveAttachments.length + files.length > ARCHIVE_FILE_LIMIT) {
    showToast(`يمكن إرفاق ${ARCHIVE_FILE_LIMIT} ملفات كحد أقصى.`);
    return;
  }
  try {
    validateArchiveFiles(files);
  } catch (error) {
    showToast(error.message);
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const reference = editingArchiveLetterId
      ? db.collection("letterArchive").doc(editingArchiveLetterId)
      : db.collection("letterArchive").doc();
    const uploaded = files.length
      ? await uploadArchiveFiles(reference.id, files, (current, total) => {
        button.textContent = `جارٍ رفع المرفقات ${current}/${total}...`;
      })
      : [];
    const attachments = [...editingArchiveAttachments, ...uploaded];
    button.textContent = "جارٍ حفظ الخطاب...";
    if (editingArchiveLetterId) {
      await reference.update({
        subject,
        entityName,
        letterDate,
        description,
        attachments,
        updatedBy: signedInAdmin.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("تم تحديث بيانات الخطاب.");
    } else {
      await reference.set({
        subject,
        entityName,
        letterDate,
        description,
        attachments,
        createdBy: signedInAdmin.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: signedInAdmin.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("تمت إضافة الخطاب إلى الأرشيف.");
    }
    resetArchiveForm();
    await loadLetterArchive();
  } catch (error) {
    showToast(errorMessage(error));
    button.textContent = editingArchiveLetterId ? "حفظ التعديلات" : "حفظ الخطاب";
  } finally {
    button.disabled = false;
  }
});

async function deleteArchiveLetter(item, button) {
  const letter = item.data();
  if (!window.confirm(`حذف الخطاب «${letter.subject || ""}» ومرفقاته نهائيًا؟`)) return;
  button.disabled = true;
  try {
    if (storage) {
      try {
        const folder = storage.ref(`letterArchive/${item.id}`);
        const listed = await folder.listAll();
        await Promise.allSettled(listed.items.map((entry) => entry.delete()));
      } catch (error) {
        console.warn("Could not remove archive files", error);
      }
    }
    await item.ref.delete();
    if (editingArchiveLetterId === item.id) resetArchiveForm();
    showToast("تم حذف الخطاب من الأرشيف.");
    await loadLetterArchive();
  } catch (error) {
    button.disabled = false;
    showToast(errorMessage(error));
  }
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
  const [members, joinRequests, initiativeRequests, initiatives, reports, certificates, letters] = await Promise.all([
    db.collection("volunteers").where("teamId", "==", teamId).get(),
    db.collection("teamJoinRequests").where("teamId", "==", teamId).get(),
    db.collection("initiativeRequests").where("leaderUid", "==", signedInAdmin.uid).get(),
    db.collection("initiatives").where("teamId", "==", teamId).get(),
    db.collection("reports").where("teamId", "==", teamId).get(),
    db.collection("certificates").where("teamId", "==", teamId).get(),
    db.collection("letters").where("teamId", "==", teamId).get()
  ]);
  leaderMembers = members.docs;
  leaderInitiatives = initiatives.docs;
  leaderCertificates = certificates.docs;
  leaderReports = reports.docs;
  leaderLetters = letters.docs;
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
  renderLeaderCertificates(certificates.docs);
  renderLeaderLetters(letters.docs);
  const activeParticipationIds = new Set(
    certificates.docs
      .filter((document) => isCertificateActive(document.data()))
      .map((document) => document.data().participationRequestId)
      .filter(Boolean)
  );
  const participantOptions = leaderParticipants
    .filter((request) => !activeParticipationIds.has(request.id))
    .map((request) => ({
      id: request.id,
      label: `${request.data().volunteerName || request.data().volunteerEmail} — ${
        initiatives.docs.find((item) => item.id === request.data().initiativeId)?.data().title || "مبادرة"
      }`
    }));
  const memberOptions = members.docs
    .filter((member) => member.id !== signedInAdmin.uid
      && (!member.data().role || member.data().role === "volunteer"))
    .map((member) => ({ id: member.id, label: member.data().displayName || member.data().email || member.id }));
  const reportableInitiatives = initiatives.docs.filter((item) => item.data().status === "open");
  const certificateEmptyLabel = leaderParticipants.length && participantOptions.length === 0
    ? "جميع المشاركين المعتمدين لديهم شهادات قائمة"
    : "اختر مشاركًا معتمدًا";
  setSelectOptions(document.getElementById("leaderNotificationRecipient"), memberOptions,
    memberOptions.length ? "اختر متطوعًا" : "لا يوجد متطوعون في الفريق");
  setSelectOptions(document.getElementById("leaderCertificateParticipant"), participantOptions, certificateEmptyLabel);
  setSelectOptions(
    document.getElementById("leaderReportInitiative"),
    reportableInitiatives.map((item) => ({ id: item.id, label: item.data().title || item.id })),
    "لا توجد مبادرة مفتوحة"
  );
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
    if (initiative.status === "approved") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "role-save-button is-positive";
      button.textContent = "بدء المبادرة";
      button.addEventListener("click", async () => {
        try {
          await item.ref.update({ status: "open", published: true });
          showToast("بدأت المبادرة وظهرت للمتطوعين.");
          await loadLeaderDashboard();
        } catch (error) {
          showToast(errorMessage(error));
        }
      });
      action.append(button);
    } else if (initiative.status === "open") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "role-save-button is-warning";
      button.textContent = "إعداد تقرير الإغلاق";
      button.addEventListener("click", () => prepareClosureReport(item));
      action.append(button);
    } else {
      action.textContent = "—";
    }
    row.append(action);
    rows.append(row);
  });
}

function prepareClosureReport(initiativeDocument) {
  const form = document.getElementById("leaderReportForm");
  const select = form.elements.initiativeId;
  select.value = initiativeDocument.id;
  select.dispatchEvent(new Event("change"));
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderLeaderReports(reports) {
  const rows = document.getElementById("leaderReportRows");
  rows.replaceChildren();
  document.getElementById("leaderReportsEmpty").hidden = reports.length > 0;
  reports.forEach((item) => {
    const report = item.data();
    const initiative = leaderInitiatives.find((entry) => entry.id === report.initiativeId);
    const row = document.createElement("tr");
    rowCell(row, initiative ? initiative.data().title : initiativeLabel(leaderInitiatives, report.initiativeId));
    rowCell(row, report.volunteersCount ?? "—");
    rowCell(row, report.beneficiariesCount ?? "—");
    messageCell(row, report.content);
    photoCell(row, report.attachments);
    attendanceCell(row, report);
    statusCell(row, report.status);
    rowCell(row, report.reviewNote);
    const action = document.createElement("td");
    if (report.status === "revision_requested") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "role-save-button is-warning";
      button.textContent = "تعديل وإعادة الإرسال";
      button.addEventListener("click", () => prepareReportRevision(item));
      action.append(button);
    } else {
      action.textContent = "—";
    }
    row.append(action);
    rows.append(row);
  });
}

function prepareReportRevision(item) {
  const report = item.data();
  editingReportId = item.id;
  const form = document.getElementById("leaderReportForm");
  const select = form.elements.initiativeId;
  const initiative = leaderInitiatives.find((entry) => entry.id === report.initiativeId);
  if (![...select.options].some((option) => option.value === report.initiativeId)) {
    const option = document.createElement("option");
    option.value = report.initiativeId;
    option.textContent = initiative?.data().title || "مبادرة مغلقة";
    select.append(option);
  }
  select.value = report.initiativeId;
  select.disabled = true;
  form.elements.beneficiariesCount.value = report.beneficiariesCount ?? "";
  form.elements.content.value = report.content || "";
  renderLeaderAttendance(report.initiativeId, report.attendance || []);
  document.getElementById("leaderReportPhotos").value = "";
  resetReportPreview();
  form.querySelector("button[type=submit]").textContent = "إعادة إرسال التقرير";
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderLeaderCertificates(certificates) {
  const rows = document.getElementById("leaderCertificateRows");
  rows.replaceChildren();
  document.getElementById("leaderCertificatesEmpty").hidden = certificates.length > 0;
  certificates.forEach((item) => {
    const certificate = item.data();
    const status = certificateStatus(certificate);
    const row = document.createElement("tr");
    rowCell(row, certificate.volunteerName || profileLabel(leaderMembers, certificate.volunteerUid));
    rowCell(row, certificate.initiativeTitle || initiativeLabel(leaderInitiatives, certificate.initiativeId));
    rowCell(row, certificate.initiativeDate);
    statusCell(row, status);
    rowCell(row, certificate.reviewNote);
    const action = document.createElement("td");
    if (status === "rejected") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "role-save-button is-warning";
      button.textContent = "تعديل وإعادة الإرسال";
      button.addEventListener("click", () => prepareCertificateResubmit(item));
      action.append(button);
    } else if (status === "issued") {
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = "PDF";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openCertificateDocument({ ...certificate, status: "issued" });
      });
      action.append(link);
    } else {
      action.textContent = "—";
    }
    row.append(action);
    rows.append(row);
  });
}

function renderLeaderLetters(letters) {
  const rows = document.getElementById("leaderLetterRows");
  rows.replaceChildren();
  document.getElementById("leaderLettersEmpty").hidden = letters.length > 0;
  letters.forEach((item) => {
    const letter = item.data();
    const row = document.createElement("tr");
    rowCell(row, letter.subject);
    rowCell(row, letterRecipientLabels[letter.recipient] || "—");
    letterBodyCell(row, letter.body);
    const attachment = document.createElement("td");
    appendAttachmentLinks(attachment, letter.attachmentUrl ? [letter.attachmentUrl] : []);
    row.append(attachment);
    rowCell(row, timestampLabel(letter.createdAt));
    statusCell(row, letter.status);
    rowCell(row, letter.reviewNote);
    rows.append(row);
  });
}

async function loadStaffDashboard() {
  const [teams, requests, reports, volunteers, certificates, initiatives, letters] = await Promise.all([
    db.collection("teams").orderBy("name").get(),
    db.collection("initiativeRequests").orderBy("createdAt", "desc").get(),
    db.collection("reports").orderBy("createdAt", "desc").get(),
    db.collection("volunteers").orderBy("displayName").get(),
    db.collection("certificates").orderBy("createdAt", "desc").get(),
    db.collection("initiatives").get(),
    fetchLettersFor(["staff", "both"])
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
  renderStaffLetters(letters);
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
  const currentLeaderOption = document.createElement("option");
  currentLeaderOption.value = team.leaderUid || "";
  currentLeaderOption.textContent = team.leaderUid
    ? profileLabel(staffVolunteers, team.leaderUid)
    : "بدون قائد حاليًا";
  leaderSelect.append(currentLeaderOption);
  leaderSelect.value = currentLeaderOption.value;
  leaderSelect.disabled = true;
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
    rowCell(row, impactLabel(report));
    messageCell(row, report.content);
    photoCell(row, report.attachments);
    attendanceCell(row, report);
    statusCell(row, report.status);
    const noteCell = document.createElement("td");
    const note = document.createElement("input");
    note.className = "dialog-input";
    note.value = report.reviewNote || "";
    note.maxLength = 2000;
    note.placeholder = "ملاحظة المراجعة";
    note.setAttribute("aria-label", "ملاحظة مراجعة التقرير");
    noteCell.append(note);
    row.append(noteCell);
    const action = document.createElement("td");
    if (report.status === "submitted") {
      [["approved", "اعتماد التقرير"], ["revision_requested", "إعادة للتعديل"]].forEach(([status, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "role-save-button";
        button.textContent = label;
        button.classList.add(status === "approved" ? "is-positive" : "is-warning");
        button.addEventListener("click", async () => {
          try {
            await item.ref.update({
              status,
              reviewNote: note.value.trim(),
              reviewedBy: signedInAdmin.uid,
              reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast(status === "approved" ? "تم اعتماد تقرير المبادرة." : "أُعيد التقرير للتعديل.");
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
    rowCell(row, user.teamId ? teamLabel(staffTeams, user.teamId) : "بدون فريق");
    rowCell(row, roleLabels[user.role] || "متطوع");
    rows.append(row);
  });
}

function readCertificateHours(input) {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 1 || value > 1000) {
    throw new Error("أدخل عدد ساعات صحيحًا من 1 إلى 1000. تكتبها الإدارة التنفيذية أو المؤسس.");
  }
  return value;
}

function renderStaffCertificates(certificates) {
  const rows = document.getElementById("staffCertificateRows");
  rows.replaceChildren();
  document.getElementById("staffCertificatesEmpty").hidden = certificates.length > 0;
  certificates.forEach((item) => {
    const certificate = item.data();
    const status = certificateStatus(certificate);
    const row = document.createElement("tr");
    stackedCell(
      row,
      certificate.volunteerName || profileLabel(staffVolunteers, certificate.volunteerUid),
      teamLabel(staffTeams, certificate.teamId)
    );
    rowCell(row, certificate.initiativeTitle || initiativeLabel(staffInitiatives, certificate.initiativeId));
    rowCell(row, certificate.initiativeDate);
    const hoursCell = document.createElement("td");
    const hours = document.createElement("input");
    hours.className = "dialog-input";
    hours.type = "number";
    hours.min = "1";
    hours.max = "1000";
    hours.value = certificate.hours ?? "";
    hours.disabled = currentRole !== "admin" || status === "issued" || status === "rejected";
    hours.placeholder = currentRole === "admin" ? "الساعات" : "تكتبها الإدارة التنفيذية أو المؤسس";
    hours.title = currentRole === "admin"
      ? "ساعات التطوع المعتمدة لهذه الشهادة"
      : "تكتب الساعات الإدارة التنفيذية أو المؤسس قبل الاعتماد.";
    hours.setAttribute("aria-label", `ساعات ${certificate.volunteerName || "المتطوع"}`);
    hoursCell.append(hours);
    row.append(hoursCell);
    statusCell(row, status);
    const numberCell = document.createElement("td");
    numberCell.textContent = certificate.certificateNumber || "—";
    row.append(numberCell);
    const action = document.createElement("td");
    action.className = "table-action-cell";
    const note = document.createElement("input");
    note.className = "dialog-input action-note-input";
    note.value = certificate.reviewNote || "";
    note.maxLength = 2000;
    note.placeholder = "ملاحظة";
    note.setAttribute("aria-label", `ملاحظة شهادة ${certificate.volunteerName || "المتطوع"}`);
    if (status === "pending") {
      action.append(note);
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "role-save-button is-positive";
      approve.textContent = "اعتماد";
      approve.addEventListener("click", async () => {
        try {
          const value = readCertificateHours(hours);
          await item.ref.update({
            status: "approved",
            hours: value,
            reviewNote: note.value.trim(),
            reviewedBy: signedInAdmin.uid,
            reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          showToast("تم اعتماد بيانات الشهادة؛ يمكن إصدارها الآن.");
          await loadStaffDashboard();
        } catch (error) {
          showToast(errorMessage(error));
        }
      });
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "role-save-button is-danger";
      reject.textContent = "رفض";
      reject.addEventListener("click", async () => {
        try {
          const reason = note.value.trim();
          if (reason.length < 3) {
            showToast("اكتب سبب الرفض في خانة الملاحظة أولًا.");
            return;
          }
          await item.ref.update({
            status: "rejected",
            hours: readCertificateHours(hours),
            reviewNote: reason,
            reviewedBy: signedInAdmin.uid,
            reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          showToast("تم رفض طلب الشهادة وإبلاغ قائد الفريق.");
          await loadStaffDashboard();
        } catch (error) {
          showToast(errorMessage(error));
        }
      });
      action.append(approve, reject);
    } else if (status === "approved") {
      action.append(note);
      const issue = document.createElement("button");
      issue.type = "button";
      issue.className = "role-save-button is-positive";
      issue.textContent = "إصدار الشهادة";
      issue.addEventListener("click", async () => {
        try {
          const value = readCertificateHours(hours);
          const certificateNumber = `NBD-${new Date().getFullYear()}-${item.id.slice(0, 6).toUpperCase()}`;
          await item.ref.update({
            status: "issued",
            hours: value,
            certificateNumber,
            issuedBy: signedInAdmin.uid,
            issuedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reviewNote: note.value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          showToast(`تم إصدار الشهادة برقم ${certificateNumber}.`);
          await loadStaffDashboard();
        } catch (error) {
          showToast(errorMessage(error));
        }
      });
      action.append(issue);
    } else if (status === "issued") {
      if (certificate.certificateNumber) {
        const pdf = document.createElement("button");
        pdf.type = "button";
        pdf.className = "role-save-button";
        pdf.textContent = "PDF";
        pdf.addEventListener("click", () => openCertificateDocument({ ...certificate, status: "issued" }));
        action.append(pdf);
      }
      if (typeof certificate.certificateUrl === "string" && /^https:\/\//i.test(certificate.certificateUrl)) {
        const link = document.createElement("a");
        link.href = certificate.certificateUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "عرض الشهادة";
        action.append(link);
      }
      if (!action.childElementCount) action.textContent = "—";
    } else {
      action.textContent = "—";
    }
    row.append(action);
    rows.append(row);
  });
}

function renderStaffLetters(letters) {
  const rows = document.getElementById("staffLetterRows");
  rows.replaceChildren();
  document.getElementById("staffLettersEmpty").hidden = letters.length > 0;
  letters.forEach((item) => {
    const letter = item.data();
    const row = document.createElement("tr");
    stackedCell(row, letter.teamName || "فريق", letter.leaderName || "");
    rowCell(row, letter.subject);
    letterBodyCell(row, letter.body);
    const attachment = document.createElement("td");
    appendAttachmentLinks(attachment, letter.attachmentUrl ? [letter.attachmentUrl] : []);
    row.append(attachment);
    rowCell(row, timestampLabel(letter.createdAt));
    statusCell(row, letter.status);
    const noteCell = document.createElement("td");
    const note = document.createElement("input");
    note.className = "dialog-input";
    note.value = letter.reviewNote || "";
    note.maxLength = 2000;
    note.placeholder = "ملاحظة";
    note.setAttribute("aria-label", `ملاحظة خطاب ${letter.subject || ""}`);
    noteCell.append(note);
    row.append(noteCell);
    const action = document.createElement("td");
    if (letter.status === "sent") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "role-save-button";
      button.textContent = "تم الاطلاع";
      button.addEventListener("click", () => reviewLetter(item, note));
      action.append(button);
    } else {
      action.textContent = "—";
    }
    row.append(action);
    rows.append(row);
  });
}

async function reviewLetter(item, noteInput) {
  try {
    await item.ref.update({
      status: "reviewed",
      reviewedBy: signedInAdmin.uid,
      reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reviewNote: noteInput.value.trim()
    });
    showToast("تم تسجيل الاطلاع على الخطاب.");
    await loadDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function loadExecutiveDashboard() {
  const [teams, volunteers, initiatives, reports, participationRequests, certificates, initiativeRequests, letters] = await Promise.all([
    db.collection("teams").orderBy("name").get(),
    db.collection("volunteers").orderBy("displayName").get(),
    db.collection("initiatives").orderBy("date", "desc").get(),
    db.collection("reports").orderBy("createdAt", "desc").get(),
    db.collection("participationRequests").get(),
    db.collection("certificates").orderBy("createdAt", "desc").get(),
    db.collection("initiativeRequests").get(),
    fetchLettersFor(["executive", "both"])
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
  renderExecutiveLetters(letters);
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
  document.getElementById("executiveCertificatesEmpty").hidden = certificates.length > 0;
  certificates.forEach((item) => {
    const certificate = item.data();
    const volunteer = volunteers.find((profile) => profile.id === certificate.volunteerUid);
    const initiative = initiatives.find((entry) => entry.id === certificate.initiativeId);
    const status = certificateStatus(certificate);
    const row = document.createElement("tr");
    rowCell(row, certificate.volunteerName || volunteer?.data().displayName || "مستخدم غير متاح");
    rowCell(row, certificate.initiativeTitle || initiative?.data().title || "مبادرة غير متاحة");
    rowCell(row, certificate.initiativeDate);
    const hoursCell = document.createElement("td");
    const hours = document.createElement("input");
    hours.className = "dialog-input";
    hours.type = "number";
    hours.min = "1";
    hours.max = "1000";
    hours.value = certificate.hours ?? "";
    hours.disabled = status === "issued" || status === "rejected";
    hours.placeholder = status === "issued" || status === "rejected" ? "—" : "أدخل الساعات";
    hours.setAttribute("aria-label", `ساعات ${certificate.volunteerName || "المتطوع"}`);
    hoursCell.append(hours);
    row.append(hoursCell);
    statusCell(row, status);
    rowCell(row, certificate.certificateNumber);
    const action = document.createElement("td");
    action.className = "table-action-cell";
    if (status === "pending" || status === "approved") {
      const saveHours = document.createElement("button");
      saveHours.type = "button";
      saveHours.className = "role-save-button is-positive";
      saveHours.textContent = "حفظ الساعات";
      saveHours.addEventListener("click", async () => {
        try {
          const value = readCertificateHours(hours);
          await item.ref.update({
            hours: value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          showToast("تم حفظ ساعات التطوع لهذه الشهادة.");
          await loadExecutiveDashboard();
        } catch (error) {
          showToast(errorMessage(error));
        }
      });
      action.append(saveHours);
    } else if (status === "issued" && certificate.certificateNumber) {
      const pdf = document.createElement("button");
      pdf.type = "button";
      pdf.className = "role-save-button";
      pdf.textContent = "PDF";
      pdf.addEventListener("click", () => openCertificateDocument({ ...certificate, status: "issued" }));
      action.append(pdf);
    } else if (typeof certificate.certificateUrl === "string" && /^https:\/\//i.test(certificate.certificateUrl)) {
      const link = document.createElement("a");
      link.href = certificate.certificateUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "عرض";
      action.append(link);
    } else {
      action.textContent = "—";
    }
    row.append(action);
    rows.append(row);
  });
}

function renderExecutiveReports(reports, teams, initiatives) {
  const rows = document.getElementById("executiveReportRows");
  rows.replaceChildren();
  document.getElementById("executiveReportsEmpty").hidden = reports.length > 0;
  reports.forEach((item) => {
    const report = item.data();
    const row = document.createElement("tr");
    rowCell(row, teamLabel(teams, report.teamId));
    rowCell(row, initiativeLabel(initiatives, report.initiativeId));
    rowCell(row, impactLabel(report));
    messageCell(row, report.content);
    photoCell(row, report.attachments);
    attendanceCell(row, report);
    statusCell(row, report.status);
    rows.append(row);
  });
}

function renderExecutiveLetters(letters) {
  const rows = document.getElementById("executiveLetterRows");
  rows.replaceChildren();
  document.getElementById("executiveLettersEmpty").hidden = letters.length > 0;
  letters.forEach((item) => {
    const letter = item.data();
    const row = document.createElement("tr");
    stackedCell(row, letter.teamName || "فريق", letter.leaderName || "");
    rowCell(row, letter.subject);
    letterBodyCell(row, letter.body);
    const attachment = document.createElement("td");
    appendAttachmentLinks(attachment, letter.attachmentUrl ? [letter.attachmentUrl] : []);
    row.append(attachment);
    rowCell(row, timestampLabel(letter.createdAt));
    statusCell(row, letter.status);
    const noteCell = document.createElement("td");
    const note = document.createElement("input");
    note.className = "dialog-input";
    note.value = letter.reviewNote || "";
    note.maxLength = 2000;
    note.placeholder = "ملاحظة";
    note.setAttribute("aria-label", `ملاحظة خطاب ${letter.subject || ""}`);
    noteCell.append(note);
    row.append(noteCell);
    const action = document.createElement("td");
    if (letter.status === "sent") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "role-save-button";
      button.textContent = "تم الاطلاع";
      button.addEventListener("click", () => reviewLetter(item, note));
      action.append(button);
    } else {
      action.textContent = "—";
    }
    row.append(action);
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
    const currentTeam = teams.find((team) => team.id === user.teamId);
    rowCell(row, currentTeam?.data().name || "—");
    if (item.id === signedInAdmin.uid) {
      const ownRole = document.createElement("td");
      ownRole.textContent = roleLabels[user.role] || "متطوع";
      const ownAction = document.createElement("td");
      ownAction.className = "table-action-cell";
      ownAction.textContent = "حسابك الحالي";
      row.append(ownRole, ownAction);
      rows.append(row);
      return;
    }
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
  const form = event.currentTarget;
  const title = document.getElementById("initiativeTitle").value.trim();
  const description = document.getElementById("initiativeDescription").value.trim();
  const category = document.getElementById("initiativeCategory").value.trim();
  const date = document.getElementById("initiativeDate").value;
  const location = document.getElementById("initiativeLocation").value.trim();
  const hours = Number(document.getElementById("initiativeHours").value);
  const teamId = document.getElementById("initiativeTeam").value;
  if (title.length < 2 || title.length > 160
    || description.length < 10 || description.length > 4000
    || category.length < 2 || category.length > 80
    || !date || location.length < 2 || location.length > 200) {
    showToast("أكمل بيانات المبادرة: الاسم والوصف والمجال والتاريخ والموقع.");
    return;
  }
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) {
    showToast("أدخل عدد ساعات صحيحًا من 1 إلى 24.");
    return;
  }
  if (!teamId) {
    showToast(founderTeams.length
      ? "اختر الفريق المنفذ للمبادرة."
      : "لا توجد فرق بعد. أنشئ فريقًا من قسم الفرق قبل نشر المبادرة.");
    return;
  }
  const team = founderTeams.find((item) => item.id === teamId);
  if (!team) {
    showToast("الفريق المحدد لم يعد موجودًا. حدّث الصفحة وحاول مجددًا.");
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const payload = {
      title,
      description,
      category,
      date,
      location,
      hours,
      teamId: team.id,
      teamName: team.data().name || "فريق",
      status: "open",
      published: true,
      createdBy: signedInAdmin.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (team.data().leaderUid) payload.leaderUid = team.data().leaderUid;
    await db.collection("initiatives").add(payload);
    form.reset();
    showToast("تم نشر المبادرة على الموقع العام وربطها بالفريق المنفذ.");
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
  const recipientUid = String(data.get("recipientUid") || "");
  const message = String(data.get("message") || "").trim();
  if (!recipientUid) {
    showToast("اختر متطوعًا من أعضاء الفريق.");
    return;
  }
  if (message.length < 3) {
    showToast("اكتب نص التنبيه (3 أحرف على الأقل).");
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await db.collection("notifications").add({
      teamId: leaderTeam.id,
      createdBy: signedInAdmin.uid,
      recipientUid,
      message,
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

function resetReportPreview() {
  reportPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  reportPreviewUrls = [];
  document.getElementById("leaderReportPhotoPreview").replaceChildren();
}

document.getElementById("leaderReportPhotos").addEventListener("change", (event) => {
  resetReportPreview();
  const preview = document.getElementById("leaderReportPhotoPreview");
  const files = [...event.target.files];
  try {
    validateReportPhotos(files);
  } catch (error) {
    showToast(error.message);
  }
  files.slice(0, REPORT_PHOTO_LIMIT).forEach((file, index) => {
    if (!REPORT_PHOTO_TYPES.includes(file.type)) return;
    const url = URL.createObjectURL(file);
    reportPreviewUrls.push(url);
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    image.src = url;
    image.alt = `معاينة الصورة ${index + 1}`;
    const caption = document.createElement("figcaption");
    caption.textContent = file.name;
    figure.append(image, caption);
    preview.append(figure);
  });
});

function attendancePhone(request) {
  if (request.volunteerPhone) return request.volunteerPhone;
  const member = leaderMembers.find((document) => document.id === request.volunteerUid);
  return member?.data().phone || "";
}

function renderLeaderAttendance(initiativeId, existingAttendance = []) {
  const rows = document.getElementById("leaderAttendanceRows");
  rows.replaceChildren();
  const participants = leaderParticipants
    .map((request) => ({ id: request.id, ...request.data() }))
    .filter((request) => request.initiativeId === initiativeId);
  const existingByRequest = new Map(
    (Array.isArray(existingAttendance) ? existingAttendance : [])
      .map((entry) => [entry.participationRequestId || entry.uid, entry])
  );
  const entries = participants.map((request) => {
    const previous = existingByRequest.get(request.id) || existingByRequest.get(request.volunteerUid);
    return {
      participationRequestId: request.id,
      uid: request.volunteerUid,
      name: previous?.name || request.volunteerName || "",
      phone: previous?.phone || attendancePhone(request),
      status: previous?.status === "absent" ? "absent" : "present",
      note: previous?.note || ""
    };
  });
  (Array.isArray(existingAttendance) ? existingAttendance : []).forEach((entry) => {
    if (entries.some((item) => item.participationRequestId === entry.participationRequestId)) return;
    entries.push({
      participationRequestId: entry.participationRequestId || "",
      uid: entry.uid || "",
      name: entry.name || "",
      phone: entry.phone || "",
      status: entry.status === "absent" ? "absent" : "present",
      note: entry.note || ""
    });
  });
  entries.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.dataset.requestId = entry.participationRequestId;
    row.dataset.uid = entry.uid;

    const numberCell = document.createElement("td");
    numberCell.textContent = String(index + 1);
    const nameCell = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.className = "dialog-input attendance-input attendance-name";
    nameInput.value = entry.name;
    nameInput.maxLength = 100;
    nameInput.setAttribute("aria-label", `اسم المتطوع ${index + 1}`);
    nameCell.append(nameInput);
    const phoneCell = document.createElement("td");
    const phoneInput = document.createElement("input");
    phoneInput.className = "dialog-input attendance-input attendance-phone";
    phoneInput.type = "tel";
    phoneInput.inputMode = "tel";
    phoneInput.maxLength = 20;
    phoneInput.value = entry.phone;
    phoneInput.setAttribute("aria-label", `رقم جوال المتطوع ${index + 1}`);
    phoneCell.append(phoneInput);
    const statusCell = document.createElement("td");
    const statusSelect = document.createElement("select");
    statusSelect.className = "dialog-input attendance-status";
    statusSelect.innerHTML = '<option value="present">حضر</option><option value="absent">غائب</option>';
    statusSelect.value = entry.status;
    statusSelect.setAttribute("aria-label", `حالة حضور المتطوع ${index + 1}`);
    statusCell.append(statusSelect);
    const noteCell = document.createElement("td");
    const noteInput = document.createElement("input");
    noteInput.className = "dialog-input attendance-input attendance-note";
    noteInput.value = entry.note;
    noteInput.maxLength = 500;
    noteInput.placeholder = "ملاحظة اختيارية";
    noteInput.setAttribute("aria-label", `ملاحظة المتطوع ${index + 1}`);
    noteCell.append(noteInput);
    [numberCell, nameCell, phoneCell, statusCell, noteCell].forEach((cell) => row.append(cell));
    rows.append(row);
  });
  document.getElementById("leaderAttendanceEmpty").hidden = entries.length > 0;
  updateAttendanceSummary();
}

function collectAttendance() {
  return [...document.querySelectorAll("#leaderAttendanceRows tr")].map((row) => ({
    participationRequestId: row.dataset.requestId || "",
    uid: row.dataset.uid || "",
    name: row.querySelector(".attendance-name").value.trim(),
    phone: row.querySelector(".attendance-phone").value.trim(),
    status: row.querySelector(".attendance-status").value,
    note: row.querySelector(".attendance-note").value.trim()
  }));
}

function updateAttendanceSummary() {
  const entries = collectAttendance();
  const registered = entries.length;
  const present = entries.filter((entry) => entry.status === "present").length;
  const absent = registered - present;
  const rate = registered ? Math.round((present / registered) * 100) : 0;
  document.getElementById("attendanceRegistered").textContent = String(registered);
  document.getElementById("attendancePresent").textContent = String(present);
  document.getElementById("attendanceAbsent").textContent = String(absent);
  document.getElementById("attendanceRate").textContent = `${rate}%`;
  const countInput = document.getElementById("leaderReportVolunteersCount");
  if (registered > 0) {
    countInput.value = String(present);
    countInput.readOnly = true;
  } else {
    countInput.readOnly = false;
  }
  return { registered, present, absent, rate };
}

document.getElementById("leaderAttendanceRows").addEventListener("input", updateAttendanceSummary);
document.getElementById("leaderAttendanceRows").addEventListener("change", updateAttendanceSummary);

document.getElementById("leaderReportInitiative").addEventListener("change", (event) => {
  renderLeaderAttendance(event.target.value);
});

function resetReportForm() {
  editingReportId = null;
  const form = document.getElementById("leaderReportForm");
  form.reset();
  form.elements.initiativeId.disabled = false;
  form.querySelector("button[type=submit]").textContent = "إرسال التقرير وإغلاق المبادرة";
  resetReportPreview();
  renderLeaderAttendance("");
}

document.getElementById("leaderReportForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!leaderTeam) return;
  const editingReport = editingReportId
    ? leaderReports.find((item) => item.id === editingReportId)
    : null;
  const initiativeId = form.elements.initiativeId.value;
  const initiative = leaderInitiatives.find((item) => item.id === initiativeId);
  if (!editingReport && (!initiative || initiative.data().status !== "open")) {
    showToast("اختر مبادرة مفتوحة لإعداد تقرير إغلاقها.");
    return;
  }
  const attendance = collectAttendance();
  const registered = attendance.length;
  const present = attendance.filter((entry) => entry.status === "present").length;
  const attendanceSummary = {
    registered,
    present,
    absent: registered - present,
    rate: registered ? Math.round((present / registered) * 100) : 0
  };
  for (const entry of attendance) {
    if (entry.name.length < 2 || entry.name.length > 100) {
      showToast("تحقق من أسماء المتطوعين في قائمة الحضور.");
      return;
    }
    if (entry.phone && !/^[+\d][\d\s()-]{6,19}$/.test(entry.phone)) {
      showToast(`رقم جوال «${entry.name}» غير صحيح.`);
      return;
    }
    if (entry.note.length > 500) {
      showToast("ملاحظات الحضور يجب ألا تتجاوز 500 حرف.");
      return;
    }
  }
  const volunteersCount = registered
    ? present
    : Number(form.elements.volunteersCount.value);
  const beneficiariesCount = Number(form.elements.beneficiariesCount.value);
  const content = form.elements.content.value.trim();
  if (!Number.isInteger(volunteersCount) || volunteersCount < 1) {
    showToast(registered
      ? "حدّد حضور متطوع واحد على الأقل قبل إرسال التقرير."
      : "أدخل عدد المتطوعين المشاركين (1 على الأقل).");
    return;
  }
  if (!Number.isInteger(beneficiariesCount) || beneficiariesCount < 0) {
    showToast("أدخل إجمالي عدد المستفيدين (0 أو أكثر).");
    return;
  }
  if (content.length < 10) {
    showToast("اكتب شرحًا لتنفيذ المبادرة (10 أحرف على الأقل).");
    return;
  }
  const files = [...document.getElementById("leaderReportPhotos").files];
  const previousAttachments = editingReport && Array.isArray(editingReport.data().attachments)
    ? editingReport.data().attachments
    : [];
  if (files.length) {
    try {
      validateReportPhotos(files);
    } catch (error) {
      showToast(error.message);
      return;
    }
  } else if (editingReport ? previousAttachments.length < 1 : true) {
    showToast("أرفق صورة توثيقية واحدة على الأقل للمبادرة.");
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const reportReference = editingReport ? editingReport.ref : db.collection("reports").doc();
    const attachments = files.length
      ? await uploadReportPhotos(reportReference.id, files, (current, total) => {
        button.textContent = `جارٍ رفع الصور ${current}/${total}...`;
      })
      : previousAttachments;
    button.textContent = "جارٍ إرسال التقرير...";
    if (editingReport) {
      await reportReference.update({
        status: "submitted",
        content,
        volunteersCount,
        beneficiariesCount,
        attachments,
        attendance,
        attendanceSummary
      });
      showToast("أُعيد إرسال التقرير إلى إدارة العمل التطوعي.");
    } else {
      const batch = db.batch();
      batch.set(reportReference, {
        teamId: leaderTeam.id,
        initiativeId,
        createdBy: signedInAdmin.uid,
        content,
        volunteersCount,
        beneficiariesCount,
        attachments,
        attendance,
        attendanceSummary,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "submitted"
      });
      batch.update(initiative.ref, { status: "closed", published: false });
      await batch.commit();
      showToast("تم إرسال تقرير الإغلاق وإغلاق المبادرة بعد اعتماد الإدارة.");
    }
    resetReportForm();
    await loadLeaderDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = editingReportId ? "إعادة إرسال التقرير" : "إرسال التقرير وإغلاق المبادرة";
  }
});

function resetCertificateForm() {
  editingCertificateId = null;
  const form = document.getElementById("leaderCertificateForm");
  form.reset();
  form.elements.participationRequestId.disabled = false;
  form.querySelector("button[type=submit]").textContent = "إرسال طلب الشهادة";
}

function prepareCertificateResubmit(item) {
  const certificate = item.data();
  editingCertificateId = item.id;
  const form = document.getElementById("leaderCertificateForm");
  const select = form.elements.participationRequestId;
  select.value = certificate.participationRequestId;
  select.disabled = true;
  form.elements.volunteerName.value = certificate.volunteerName || "";
  form.elements.initiativeTitle.value = certificate.initiativeTitle || "";
  form.elements.initiativeDate.value = certificate.initiativeDate || "";
  form.querySelector("button[type=submit]").textContent = "إعادة إرسال طلب الشهادة";
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

document.getElementById("leaderCertificateParticipant").addEventListener("change", (event) => {
  if (editingCertificateId) return;
  const form = document.getElementById("leaderCertificateForm");
  const request = leaderParticipants.find((item) => item.id === event.target.value);
  if (!request) return;
  const participant = request.data();
  const initiative = leaderInitiatives.find((item) => item.id === participant.initiativeId);
  form.elements.volunteerName.value = participant.volunteerName || "";
  form.elements.initiativeTitle.value = initiative?.data().title || participant.initiativeName || "";
  form.elements.initiativeDate.value = initiative?.data().date || "";
});

document.getElementById("leaderCertificateForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!leaderTeam) return;
  const participationRequestId = form.elements.participationRequestId.value;
  const participationRequest = leaderParticipants.find((item) => item.id === participationRequestId);
  if (!participationRequest) {
    showToast("اختر مشاركًا معتمدًا من القائمة.");
    return;
  }
  const volunteerName = form.elements.volunteerName.value.trim();
  const initiativeTitle = form.elements.initiativeTitle.value.trim();
  const initiativeDate = form.elements.initiativeDate.value;
  if (volunteerName.length < 2 || volunteerName.length > 100) {
    showToast("أدخل اسم المتطوع بشكل صحيح.");
    return;
  }
  if (initiativeTitle.length < 2 || initiativeTitle.length > 160) {
    showToast("أدخل اسم المبادرة بشكل صحيح.");
    return;
  }
  if (!initiativeDate) {
    showToast("حدّد تاريخ تنفيذ المبادرة.");
    return;
  }
  const activeCertificate = leaderCertificates.find(
    (document) =>
      document.data().participationRequestId === participationRequestId
      && isCertificateActive(document.data())
  );
  if (activeCertificate) {
    showToast("يوجد طلب شهادة قائم لهذا المشارك بالفعل.");
    return;
  }
  const rejectedCertificate = editingCertificateId
    ? leaderCertificates.find((document) => document.id === editingCertificateId)
    : leaderCertificates.find(
      (document) =>
        document.data().participationRequestId === participationRequestId
        && certificateStatus(document.data()) === "rejected"
    );
  const participant = participationRequest.data();
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    if (rejectedCertificate) {
      await rejectedCertificate.ref.update({
        status: "pending",
        volunteerName,
        initiativeTitle,
        initiativeDate,
        requestedBy: signedInAdmin.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("تم إرسال طلب الشهادة مجددًا. تُكتب ساعات التطوع من الإدارة التنفيذية أو المؤسس.");
    } else {
      await db.collection("certificates").add({
        teamId: leaderTeam.id,
        volunteerUid: participant.volunteerUid,
        initiativeId: participant.initiativeId,
        participationRequestId,
        volunteerName,
        initiativeTitle,
        initiativeDate,
        status: "pending",
        requestedBy: signedInAdmin.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("تم إرسال طلب الشهادة. تُكتب ساعات التطوع من الإدارة التنفيذية أو المؤسس.");
    }
    resetCertificateForm();
    await loadLeaderDashboard();
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = editingCertificateId ? "إعادة إرسال طلب الشهادة" : "إرسال طلب الشهادة";
  }
});

document.getElementById("leaderLetterForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!leaderTeam) return;
  const data = new FormData(form);
  const subject = String(data.get("subject") || "").trim();
  const body = String(data.get("body") || "").trim();
  const attachmentUrl = String(data.get("attachmentUrl") || "").trim();
  if (subject.length < 3) {
    showToast("أدخل موضوعًا واضحًا للخطاب.");
    return;
  }
  if (body.length < 10) {
    showToast("اكتب نص الخطاب (10 أحرف على الأقل).");
    return;
  }
  if (attachmentUrl && !/^https:\/\//i.test(attachmentUrl)) {
    showToast("يجب أن يبدأ رابط المرفق بـ https://");
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const letter = {
      teamId: leaderTeam.id,
      teamName: leaderTeam.name,
      leaderUid: signedInAdmin.uid,
      leaderName: signedInProfile.displayName || signedInAdmin.email,
      subject,
      body,
      recipient: String(data.get("recipient")),
      status: "sent",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (attachmentUrl) letter.attachmentUrl = attachmentUrl;
    await db.collection("letters").add(letter);
    form.reset();
    showToast("تم إرسال الخطاب إلى الجهة المحددة.");
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
