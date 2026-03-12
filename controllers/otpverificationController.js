import User from "../models/User.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const verifyOTP = async (req, res) => {
  try {

    const { otp1, otp2, otp3, otp4, otp5, otp6 } = req.body;

    if (!otp1 || !otp2 || !otp3 || !otp4 || !otp5 || !otp6) {
      return res.render("user/verify", {
        error: "Please enter complete OTP"
      });
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
      return res.render("user/verify", {
        error: "OTP expired"
      });
    }

    if (String(user.resetOtp) !== String(enteredOTP)) {
      return res.render("user/verify", {
        error: "Invalid OTP"
      });
    }
    user.resetOtp = null;
    user.resetOtpExpiry = null;

    await user.save();

    req.session.otpVerified = true;

    res.redirect("/api/auth/resetpassword");

  } catch (err) {

    console.error("OTP verify error:", err);

    res.render("user/verify", {
      error: "Something went wrong"
    });

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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetOtp = otp;
    user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await user.save();

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