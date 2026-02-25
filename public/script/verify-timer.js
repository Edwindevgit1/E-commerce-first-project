    let timeLeft = 30;
    const timerElement = document.getElementById("timer");
    const resendBtn = document.getElementById("resendBtn");

    const countdown = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(countdown);
            resendBtn.disabled = false;
            resendBtn.textContent = "Resend OTP";
        }
    }, 1000);

    resendBtn.addEventListener("click", () => {
        resendBtn.disabled = true;
        timeLeft = 30;
        resendBtn.innerHTML = `Resend OTP in <span id="timer">30</span>s`;

        // Optional: call backend route
        fetch("/resend-otp")
            .then(() => {
                console.log("OTP resent");
            });

        startCountdown();
    });

    function startCountdown() {
        const timerElement = document.getElementById("timer");

        const newCountdown = setInterval(() => {
            timeLeft--;
            timerElement.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(newCountdown);
                resendBtn.disabled = false;
                resendBtn.textContent = "Resend OTP";
            }
        }, 1000);
    }
