import User from "../models/User.js";
import bcrypt from "bcrypt";

const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!req.session.resetEmail || !req.session.isOtpVerified) {
      return res.redirect("/api/auth/forgotpassword");
    }

    if (!password) {
      return res.render("user/reset-password", {
        error: "Password is required"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.findOne({
      email: req.session.resetEmail
    });

    user.password = hashedPassword;
    user.resetOTP = null;
    user.resetOTPExpiry = null;

    await user.save();

    // Clear session
    req.session.resetEmail = null;
    req.session.isOtpVerified = null;

    res.redirect("/api/auth/login");

  } catch (err) {
    console.error(err);
    res.render("user/reset-password", {
      error: "Something went wrong"
    });
  }
};

export default resetPassword;