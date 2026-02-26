import User from "../models/User.js";

const verifyOTP = async (req, res) => {
  try {
    const { otp1, otp2, otp3, otp4, otp5, otp6 } = req.body;

    // 1️⃣ Validate all digits entered
    if (!otp1 || !otp2 || !otp3 || !otp4 || !otp5 || !otp6) {
      return res.render("user/verify", {
        error: "Please enter complete OTP"
      });
    }

    const enteredOTP = otp1 + otp2 + otp3 + otp4 + otp5 + otp6;

    const email = req.session.resetEmail;

    if (!email) {
      return res.redirect("/api/auth/forgotpassword");
    }

    const user = await User.findOne({ email });

    if (!user || !user.resetOTP) {
      return res.redirect("/api/auth/forgotpassword");
    }

    // 2️⃣ Check expiry
    if (user.resetOTPExpiry < Date.now()) {
      return res.render("user/verify", {
        error: "OTP expired"
      });
    }

    // 3️⃣ Check match
    if (user.resetOTP !== enteredOTP) {
      return res.render("user/verify", {
        error: "Invalid OTP"
      });
    }

    // 4️⃣ Clear OTP after success
    user.resetOTP = null;
    user.resetOTPExpiry = null;
    await user.save();

    // 5️⃣ Redirect to reset password page
    res.redirect("/api/auth/reset-password");

  } catch (err) {
    console.error(err);
    res.render("user/verify", {
      error: "Something went wrong"
    });
  }
};

export default verifyOTP;