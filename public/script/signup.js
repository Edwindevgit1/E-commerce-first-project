document.querySelectorAll(".toggle-password").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.textContent = isPassword ? "Hide" : "Show";
    btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });
});
window.addEventListener("pageshow", function () {
  const form = document.querySelector("form");
  if (form) {
    form.reset();
  }
});
setTimeout(() => {
  const errorBox = document.getElementById("errorBox");
  if (errorBox) {
    errorBox.style.display = "none";
  }
}, 3000);