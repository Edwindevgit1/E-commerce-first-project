const RESEND_WAIT = 30;
let remaining = RESEND_WAIT;
let intervalId = null;

const inputs = Array.from(document.querySelectorAll(".otp-input"));
const otpValue = document.getElementById("otpValue");
const form = document.getElementById("otpForm");
const resendBtn = document.getElementById("resendBtn");
const timerText = document.getElementById("timerText");

function formatTime(sec) {
  return `00:${String(sec).padStart(2, "0")}`;
}

function updateResendUI() {
  timerText.textContent = formatTime(remaining);
  resendBtn.disabled = remaining > 0;
  resendBtn.classList.toggle("enabled", remaining === 0);
}

function startCountdown() {
  clearInterval(intervalId);
  updateResendUI();

  intervalId = setInterval(() => {
    if (remaining > 0) {
      remaining -= 1;
      updateResendUI();
      return;
    }
    clearInterval(intervalId);
  }, 1000);
}

inputs[0]?.focus();

inputs.forEach((input, i) => {
  input.addEventListener("input", (e) => {
    const value = e.target.value.replace(/\D/g, "");
    e.target.value = value;
    if (value && i < inputs.length - 1) inputs[i + 1].focus();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && i > 0) {
      inputs[i - 1].focus();
    }
  });

  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    pasted.split("").forEach((digit, idx) => {
      if (inputs[idx]) inputs[idx].value = digit;
    });
    const nextIndex = Math.min(pasted.length, inputs.length - 1);
    inputs[nextIndex]?.focus();
  });
});

form?.addEventListener("submit", () => {
  const otp = inputs.map((i) => i.value).join("").trim();
  otpValue.value = otp;
});

resendBtn?.addEventListener("click", async () => {
  if (remaining > 0) return;

  try {
    const res = await fetch("/api/auth/forgot-resend-otp", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 429 && data.retryAfter) {
        remaining = data.retryAfter;
        startCountdown();
      }
      return;
    }

    remaining = RESEND_WAIT;
    startCountdown();
  } catch (err) {
    console.error("Resend OTP failed:", err);
  }
});

setTimeout(() => {
  const errorBox = document.getElementById("errorBox");
  if (errorBox) errorBox.style.display = "none";
}, 3000);

startCountdown();
window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
  window.location.reload();
  }
  });
