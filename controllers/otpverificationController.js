import User from "../models/User.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const RESET_OTP_COOLDOWN_SECONDS = 30;
const RESET_OTP_EXPIRY_MS = RESET_OTP_COOLDOWN_SECONDS * 1000;

export const getResetOtpRetryAfter = (req) => {
  const lastSentAt = Number(req.session?.resetOtpLastSentAt) || 0;
  if (!lastSentAt) return 0;

  const elapsed = Math.floor((Date.now() - lastSentAt) / 1000);
  return Math.max(RESET_OTP_COOLDOWN_SECONDS - elapsed, 0);
};

export const renderResetOtpPage = (req, res, options = {}, statusCode = 200) =>
  res.status(statusCode).render("user/verify", {
    error: options.error || null,
    retryAfter: getResetOtpRetryAfter(req),
  });

const verifyOTP = async (req, res) => {
  try {

    const { otp1, otp2, otp3, otp4, otp5, otp6 } = req.body;

    if (!otp1 || !otp2 || !otp3 || !otp4 || !otp5 || !otp6) {
      return renderResetOtpPage(req, res, {
        error: "Please enter complete OTP"
      }, 400);
    }

    const enteredOTP = `${otp1}${otp2}${otp3}${otp4}${otp5}${otp6}`;

    const email = req.session.resetEmail;

    if (!email) {
      return res.redirect("/api/auth/forgotpassword");
    }

    const user = await User.findOne({ email });

    if (!user || !user.resetOtp) {
      return res.redirect("/api/auth/forgotpassword");
    }
    if (user.resetOtpExpiry.getTime() < Date.now()) {
      return renderResetOtpPage(req, res, {
        error: "OTP expired. Click resend OTP again."
      }, 400);
    }

    if (String(user.resetOtp) !== String(enteredOTP)) {
      return renderResetOtpPage(req, res, {
        error: "Invalid OTP"
      }, 400);
    }
    user.resetOtp = null;
    user.resetOtpExpiry = null;

    await user.save();

    req.session.otpVerified = true;
    delete req.session.resetOtpLastSentAt;

    res.redirect("/api/auth/resetpassword");

  } catch (err) {

    console.error("OTP verify error:", err);

    renderResetOtpPage(req, res, {
      error: "Something went wrong"
    }, 500);

  }
};

export const resendOtp = async (req, res) => {

  try {

    const email = req.session.resetEmail;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Session expired"
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const now = Date.now();
    const lastSentAt = Number(req.session.resetOtpLastSentAt) || 0;
    const elapsed = Math.floor((now - lastSentAt) / 1000);

    if (elapsed < RESET_OTP_COOLDOWN_SECONDS) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting OTP again.",
        retryAfter: RESET_OTP_COOLDOWN_SECONDS - elapsed
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetOtp = otp;
    user.resetOtpExpiry = new Date(now + RESET_OTP_EXPIRY_MS);

    await user.save();
    req.session.resetOtpLastSentAt = now;

    console.log("Resent OTP:", otp);

    await transporter.sendMail({
      from: `"Your App" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset OTP",
      text: `Your OTP is: ${otp}`
    });

    res.json({
      success: true
    });

  } catch (err) {

    console.error("Resend OTP error:", err);

    res.status(500).json({
      success: false
    });

  }

};

export default verifyOTP;
