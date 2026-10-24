const firebaseConfig = window.firebaseConfig || {};
const firebaseReady = typeof firebase !== "undefined"
  && Object.values(firebaseConfig).every((value) => typeof value === "string" && value.trim());
const auth = firebaseReady ? firebase.auth() : null;
const db = firebaseReady ? firebase.firestore() : null;
const functions = firebaseReady ? firebase.app().functions("us-central1") : null;
const loginPanel = document.getElementById("adminLoginPanel");
const dashboard = document.getElementById("adminDashboard");
const toast = document.getElementById("adminToast");
const adminAuthDomain = "admin.nbda-1ee36.firebaseapp.com";
const founderSetupToggle = document.getElementById("founderSetupToggle");
const founderSetupForm = document.getElementById("founderSetupForm");
const founderSetupStatusNote = document.getElementById("founderSetupStatusNote");
let signedInAdmin = null;
let toastTimer;

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
    "firestore/permission-denied": "رفضت قواعد Firestore العملية. تحقق من دور المسؤول والقواعد المنشورة.",
    "functions/already-exists": "تم إعداد حساب المؤسس مسبقًا. لا يمكن إنشاء مؤسس آخر بهذه الطريقة.",
    "functions/failed-precondition": "رمز التهيئة غير صحيح أو أن إعداد المؤسس غير متاح.",
    "functions/invalid-argument": "تحقق من الاسم وكلمة المرور ورمز التهيئة.",
    "functions/not-found": "خدمة إنشاء المؤسس غير منشورة بعد. اتبع خطوات النشر في دليل Firebase."
  };
  return messages[error.code] || error.message || "حدث خطأ غير متوقع.";
}

async function updateFounderSetupAvailability() {
  if (!firebaseReady) return;
  try {
    const result = await functions.httpsCallable("founderSetup")({ action: "status" });
    founderSetupToggle.hidden = result.data.complete;
    founderSetupToggle.disabled = false;
    founderSetupStatusNote.hidden = true;
  } catch (error) {
    founderSetupToggle.hidden = false;
    founderSetupToggle.disabled = true;
    founderSetupStatusNote.hidden = false;
  }
}

async function verifyAdmin(user) {
  const profile = await db.collection("adminAccounts").doc(user.uid).get();
  if (!profile.exists || profile.data().role !== "admin") {
    await auth.signOut();
    loginPanel.hidden = false;
    dashboard.hidden = true;
    showToast("هذا الحساب غير موجود في مجموعة حسابات الإدارة.");
    return false;
  }
  signedInAdmin = user;
  document.getElementById("adminSessionName").textContent = profile.data().displayName || user.email;
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
  const username = document.getElementById("adminUsername").value.trim();
  if (username.toLowerCase() !== "yasser") {
    showToast("اسم المستخدم للمسؤول هو Yasser.");
    return;
  }
  try {
    const credential = await auth.signInWithEmailAndPassword(
      `${username.toLowerCase()}@${adminAuthDomain}`,
      document.getElementById("adminPassword").value
    );
    await verifyAdmin(credential.user);
  } catch (error) {
    showToast(errorMessage(error));
  }
});

founderSetupToggle.addEventListener("click", () => {
  founderSetupForm.hidden = !founderSetupForm.hidden;
});

founderSetupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!firebaseReady) {
    showToast("أضف إعدادات Firebase إلى firebase-config.js أولًا.");
    return;
  }

  const button = event.currentTarget.querySelector("button[type=submit]");
  const displayName = document.getElementById("founderDisplayName").value.trim();
  const password = document.getElementById("founderPassword").value;
  const setupCodeInput = document.getElementById("founderSetupCode");
  const setupCode = setupCodeInput.value;
  button.disabled = true;

  try {
    await functions.httpsCallable("founderSetup")({
      action: "create",
      displayName,
      password,
      setupCode
    });
    founderSetupForm.reset();
    founderSetupToggle.hidden = true;
    setupCodeInput.value = "";
    showToast("تم إنشاء حساب المؤسس. جارٍ تسجيل الدخول...");
    const credential = await auth.signInWithEmailAndPassword(
      `yasser@${adminAuthDomain}`,
      password
    );
    await verifyAdmin(credential.user);
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    button.disabled = false;
  }
});

document.getElementById("adminLogoutButton").addEventListener("click", async () => {
  try {
    await auth.signOut();
    signedInAdmin = null;
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
  } catch (error) {
    showToast(errorMessage(error));
  }
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
    const role = document.createElement("select");
    role.className = "user-role-select";
    role.setAttribute("aria-label", `صلاحية ${user.displayName || user.email}`);
    const roles = [
      ["volunteer", "متطوع"],
      ["leader", "قائد فريق"],
      ["staff", "موظف الوحدة"],
      ["executive", "الإدارة التنفيذية"],
      ["admin", "مسؤول الوحدة"]
    ];
    roles.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = (collection === "adminAccounts" ? "admin" : user.role) === value;
      role.append(option);
    });
    roleCell.append(role);
    const actionCell = document.createElement("td");
    const save = document.createElement("button");
    save.type = "button";
    save.className = "role-save-button";
    save.textContent = "حفظ";
    save.addEventListener("click", async () => {
      try {
        const newRole = role.value;
        if (collection === "adminAccounts" && newRole !== "admin") {
          const batch = db.batch();
          batch.set(db.collection("volunteers").doc(userDocument.id), {
            ...user,
            role: newRole
          });
          batch.delete(userDocument.ref);
          await batch.commit();
        } else if (collection === "volunteers" && newRole === "admin") {
          const batch = db.batch();
          batch.set(db.collection("adminAccounts").doc(userDocument.id), {
            ...user,
            role: "admin"
          });
          batch.delete(userDocument.ref);
          await batch.commit();
        } else if (collection === "volunteers") {
          await userDocument.ref.update({ role: newRole });
        }
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

document.getElementById("initiativeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!signedInAdmin) return;
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

if (!firebaseReady) {
  document.getElementById("adminConfigNote").hidden = false;
} else {
  updateFounderSetupAvailability();
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      signedInAdmin = null;
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
