const eyeIcon = `
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 5c5.23 0 9.27 4.11 10.75 6.04a1.5 1.5 0 0 1 0 1.92C21.27 14.89 17.23 19 12 19S2.73 14.89 1.25 12.96a1.5 1.5 0 0 1 0-1.92C2.73 9.11 6.77 5 12 5Zm0 2c-3.98 0-7.22 3.01-8.66 5 1.44 1.99 4.68 5 8.66 5s7.22-3.01 8.66-5C19.22 10.01 15.98 7 12 7Zm0 1.75A3.25 3.25 0 1 1 8.75 12 3.25 3.25 0 0 1 12 8.75Zm0 2A1.25 1.25 0 1 0 13.25 12 1.25 1.25 0 0 0 12 10.75Z"
    />
  </svg>
`;

const eyeOffIcon = `
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      fill="currentColor"
      d="M3.53 2.47a.75.75 0 1 0-1.06 1.06l2.1 2.1A15.6 15.6 0 0 0 1.25 9.04a1.5 1.5 0 0 0 0 1.92C2.73 12.89 6.77 17 12 17c1.73 0 3.31-.45 4.71-1.14l3.76 3.76a.75.75 0 1 0 1.06-1.06Zm7.54 6.48 3.48 3.48c.12-.3.18-.62.18-.93A2.75 2.75 0 0 0 11.98 8.75c-.31 0-.61.07-.91.2ZM9.9 11.9l2.2 2.2a1.25 1.25 0 0 1-2.2-2.2Zm9.53.1c-1.44 1.99-4.68 5-8.66 5-3.98 0-7.22-3.01-8.66-5 .88-1.22 2.38-2.78 4.3-3.87l1.13 1.13A4.25 4.25 0 0 0 13.74 15l1.37 1.37c3.17-1.13 5.62-3.64 6.64-5a13.95 13.95 0 0 0-4.3-3.87l1.07 1.07c.35.24.65.49.91.74Z"
    />
  </svg>
`;

function syncPasswordToggle(btn, isPassword) {
  btn.innerHTML = isPassword ? eyeIcon : eyeOffIcon;
  btn.setAttribute("aria-label", isPassword ? "Show password" : "Hide password");
}

document.querySelectorAll(".toggle-password").forEach((btn) => {
  const input = document.getElementById(btn.dataset.target);
  if (!input) return;

  syncPasswordToggle(btn, input.type === "password");

  btn.addEventListener("click", () => {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    syncPasswordToggle(btn, input.type === "password");
  });
});

function showSignupError(message) {
  const messageSlot = document.querySelector(".message-slot");
  if (!messageSlot) return;

  messageSlot.innerHTML = `<div id="errorBox" class="error-message">${message}</div>`;
  hideSignupErrorAfterDelay();
}

function hideSignupErrorAfterDelay() {
  setTimeout(() => {
    const errorBox = document.getElementById("errorBox");
    if (errorBox) {
      errorBox.style.display = "none";
    }
  }, 3000);
}

window.addEventListener("pageshow", function () {
  const form = document.querySelector("form");
  if (form) {
    form.reset();
  }
});
hideSignupErrorAfterDelay();
