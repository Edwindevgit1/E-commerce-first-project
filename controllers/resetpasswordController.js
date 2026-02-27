import User from "../models/User.js";
import bcrypt from "bcrypt";

const resetpassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    // 1️⃣ Session protection
    if (!req.session.resetEmail || !req.session.otpVerified) {
      return res.redirect('/api/auth/forgotpassword');
    }

    // 2️⃣ Validate fields
    if (!password || !confirmPassword) {
      return res.render('user/reset-password', {
        error: "All fields are required"
      });
    }

    if (password !== confirmPassword) {
      return res.render('user/reset-password', {
        error: "Passwords do not match"
      });
    }

    // 3️⃣ Password strength check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.render("user/reset-password", {
        error: "Password must meet required conditions"
      });
    }

    // 4️⃣ Find user
    const user = await User.findOne({
      email: req.session.resetEmail
    });

    if (!user) {
      return res.redirect('/api/auth/forgotpassword');
    }

    // 5️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    await user.save();

    // 6️⃣ Clear session
    req.session.resetEmail = null;
    req.session.otpVerified = null;

    // 7️⃣ Redirect
    res.redirect('/api/auth/login');

  } catch (error) {
    console.log('Reset password error', error);
    res.render('user/reset-password', {
      error: "Something went wrong"
    });
  }
};

export default resetpassword;