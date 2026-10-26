const recoveryParams = new URLSearchParams(window.location.search);
const recoveryMode = recoveryParams.get("mode");
const recoveryTitle = document.getElementById("recoveryPageTitle");
const recoveryDescription = document.getElementById("recoveryPageDescription");
const recoveryBackLink = document.getElementById("recoveryBackLink");
const recoveryForm = document.getElementById("passwordRecoveryForm");
const usernameGuidance = document.getElementById("usernameRecoveryGuidance");
const recoveryFeedback = document.getElementById("recoveryFeedback");
if (recoveryParams.get("flow") === "admin") {
  recoveryBackLink.href = "admin.html";
}

if (recoveryMode === "username") {
  document.title = "استعادة اسم المستخدم | منصة الوحدة التطوعية";
  recoveryTitle.textContent = "نسيت اسم المستخدم؟";
  recoveryDescription.textContent = "لاستعادة اسم المستخدم، تواصل مع إدارة المنصة للتحقق من بيانات الحساب.";
  usernameGuidance.hidden = false;
} else {
  document.title = "استعادة كلمة المرور | منصة الوحدة التطوعية";
  recoveryTitle.textContent = "استعادة كلمة المرور";
  recoveryDescription.textContent = "أدخل اسم المستخدم لإرسال رابط إعادة تعيين كلمة المرور إلى البريد المسجل في الحساب.";
  recoveryForm.hidden = false;
}

function showRecoveryFeedback(message, isError = false) {
  recoveryFeedback.textContent = message;
  recoveryFeedback.classList.toggle("is-error", isError);
  recoveryFeedback.hidden = false;
}

recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const firebaseReady = typeof firebase !== "undefined"
    && firebase.apps.length > 0
    && window.firebaseConfig
    && Object.values(window.firebaseConfig).every((value) => typeof value === "string" && value.trim());
  if (!firebaseReady) {
    showRecoveryFeedback("إعدادات Firebase غير مكتملة. تعذر إرسال رابط الاستعادة.", true);
    return;
  }

  const input = document.getElementById("recoveryUsername");
  const username = input.value.trim();
  const button = recoveryForm.querySelector("button[type=submit]");
  button.disabled = true;
  showRecoveryFeedback("");
  try {
    const functions = firebase.app().functions("us-central1");
    await functions.httpsCallable("sendUsernamePasswordReset")({
      username,
      apiKey: window.firebaseConfig.apiKey
    });
    showRecoveryFeedback("إذا كان اسم المستخدم مرتبطًا بحساب، فسيصلك رابط استعادة كلمة المرور إلى البريد المسجل.");
    recoveryForm.reset();
  } catch (error) {
    if (error.code === "functions/unavailable" || error.code === "functions/internal") {
      showRecoveryFeedback("تعذر إرسال رابط الاستعادة الآن. حاول مرة أخرى لاحقًا.", true);
    } else if (error.code === "auth/network-request-failed") {
      showRecoveryFeedback("تعذر الاتصال. تحقق من الإنترنت ثم حاول مرة أخرى.", true);
    } else {
      showRecoveryFeedback("تعذر إرسال رابط الاستعادة. تحقق من نشر دوال Firebase ثم حاول لاحقًا.", true);
    }
  } finally {
    button.disabled = false;
  }
});
