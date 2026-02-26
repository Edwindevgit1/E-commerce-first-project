import User from "../models/User.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const trimmedEmail = email?.trim().toLowerCase();
    console.log('Email received',trimmedEmail)
    if (!trimmedEmail) {
      return res.render("user/forgot-password", {
        error: "Email is required"
      });
    }

    const user = await User.findOne({ email: trimmedEmail });

    if (!user) {
      return res.render("user/forgot-password", {
        error: "No account found with this email"
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP and expiry (10 minutes)
    user.resetOtp = otp;
    user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await user.save();

    // Send email
    await transporter.sendMail({
      from: `"Your App" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset OTP",
      text: `Your OTP is: ${otp}`
    });

    // Save email in session for next step
    req.session.resetEmail = user.email;

    res.redirect("/api/auth/verify");

  } catch (error) {
    console.error("Send OTP Error:", error);
    res.render("user/forgot-password", {
      error: "Something went wrong"
    });
  }
};

export default sendOtp;