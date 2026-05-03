import User from "../models/User.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";

const OTP_COOLDOWN_SECONDS = 30;
const OTP_EXPIRY_MS = OTP_COOLDOWN_SECONDS * 1000;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

const getEmailValidationMessage = (email = "") => {
  if (!email) return "Email is required";
  if (/\s/.test(email)) return "Email cannot contain spaces";
  if (/[A-Z]/.test(email)) return "Email must be in lowercase only";
  if (!EMAIL_REGEX.test(email)) return "Please enter a valid email address";
  return "";
};

const getSignupOtpRetryAfter = (req) => {
  const lastSentAt = Number(req.session?.otpLastSentAt) || 0;
  if (!lastSentAt) return 0;

  const elapsed = Math.floor((Date.now() - lastSentAt) / 1000);
  return Math.max(OTP_COOLDOWN_SECONDS - elapsed, 0);
};

const renderSignupOtp = (req, res, options = {}, statusCode = 200) =>
  res.status(statusCode).render("user/signupotp", {
    error: options.error || null,
    retryAfter: getSignupOtpRetryAfter(req),
  });

const signupUser = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    const trimmedName = name?.trim();
    const trimmedEmail = email?.trim();
    if(req.session.signupData){
      return res.redirect('/api/auth/signupotp')
    }

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      return res.render("user/signup", {
        error: "All fields are required",
        name: trimmedName,
        email: trimmedEmail,
      });
    }

    const emailError = getEmailValidationMessage(trimmedEmail);
    if (emailError) {
      return res.render("user/signup", {
        error: emailError,
        name: trimmedName,
        email: trimmedEmail,
      });
    }

    if (password !== confirmPassword) {
      return res.render("user/signup", {
        error: "Passwords do not match",
        name: trimmedName,
        email: trimmedEmail,
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.render("user/signup", {
        error: "Password must contain 8 character, 1 uppercase, 1 lowercase, 1 special character",
        name: trimmedName,
        email: trimmedEmail,
      });
    }

    const existingUser = await User.findOne({ email: trimmedEmail });
    
    if (existingUser) {
      if (existingUser.isBlocked && (existingUser.role === "user" || existingUser.role === "admin")) {
        return res.render("user/signup", {
          error: "This account is blocked. You cannot sign up with this email.",
          name: trimmedName,
          email: trimmedEmail,
        });
      }
      if (existingUser.provider === "google") {
        return res.render("user/signup", {
          error: "Account exists. Please login using Google.",
          name: trimmedName,
          email: trimmedEmail,
        });
      }

      return res.render("user/signup", {
        error: "User already exists please login",
        name: trimmedName,
        email: trimmedEmail,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();

    req.session.signupOtp = otp;
    req.session.signupOtpExpiry = Date.now() + OTP_EXPIRY_MS;
    req.session.otpLastSentAt = Date.now(); 
    console.log('Signup OTP',otp)
    req.session.signupData = {
      name: trimmedName,
      email: trimmedEmail,
      password: hashedPassword,
      provider:"local"
    };

    await transporter.sendMail({
      from: `Your app <${process.env.EMAIL_USER}>`,
      to: trimmedEmail,
      subject: "Email verification OTP",
      text: `Your OTP for account verification is: ${otp}`,
    });
    return res.redirect("/api/auth/signupotp");
  } catch (error) {
    console.error(error, "signup error");
    return res.render("user/signup", { error: "Registration failed" });
  }
};
export const getSignupPage=(req,res)=>{
  if(req.session.signupData){
    return res.redirect('/api/auth/signupotp')
  }
  res.render('user/signup', {
    error: req.query.error || null,
    name: "",
    email: ""
  })
}

export const resendSignupOtp = async (req, res) => {
  try {
    const email = req.session?.signupData?.email;
    if (!email) {
      return res.status(400).json({ message: "Session expired. Please signup again." });
    }

    const now = Date.now();
    const lastSentAt = req.session.otpLastSentAt || 0;
    const elapsed = Math.floor((now - lastSentAt) / 1000);

    if (elapsed < OTP_COOLDOWN_SECONDS) {
      return res.status(429).json({
        message: "Please wait before requesting OTP again.",
        retryAfter: OTP_COOLDOWN_SECONDS - elapsed,
      });
    }

    const otp = generateOtp();
    req.session.signupOtp = otp;
    req.session.signupOtpExpiry = now + OTP_EXPIRY_MS;
    req.session.otpLastSentAt = now;

    await transporter.sendMail({
      from: `Your app <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Email verification OTP",
      text: `Your OTP for account verification is: ${otp}`,
    });

    console.log("Resent OTP:", otp);
    return res.status(200).json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.error("resend otp error", error);
    return res.status(500).json({ message: "Failed to resend OTP" });
  }
};

export const verifySignupOtp = async (req, res) => {
  try {
    const rawOtp = String(req.body?.otp || "").trim();
    if (!rawOtp) {
      return renderSignupOtp(req, res, {
        error: "OTP is required.",
      }, 400);
    }

    if (!/^\d+$/.test(rawOtp)) {
      return renderSignupOtp(req, res, {
        error: "OTP must contain numbers only.",
      }, 400);
    }

    if (rawOtp.length !== 6) {
      return renderSignupOtp(req, res, {
        error: "OTP must be 6 digits.",
      }, 400);
    }
    if (!req.session.signupOtp || !req.session.signupOtpExpiry || !req.session.signupData) {
      return renderSignupOtp(req, res, {
        error: "Session expired. Please sign up again.",
      }, 400);
    }
    if (Date.now() > req.session.signupOtpExpiry) {
      return renderSignupOtp(req, res, {
        error: "OTP expired. Click resend OTP again.",
      }, 400);
    }
    if (rawOtp !== req.session.signupOtp) {
      return renderSignupOtp(req, res, {
        error: "Invalid OTP.",
      }, 400);
    }
    const { name, email, password ,provider} = req.session.signupData;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).render("user/signup", {
        error: "User already exists. Please login.",
        name,
        email,
      });
    }

    await User.create({
      name,
      email,
      password, 
      provider,
      isVerified: true,
    });
    delete req.session.signupOtp;
    delete req.session.signupOtpExpiry;
    delete req.session.otpLastSentAt;
    delete req.session.signupData;

    return res.redirect("/api/auth/login");
  } catch (err) {
    console.error("verify otp error", err);
    return renderSignupOtp(req, res, {
      error: "OTP verification failed.",
    }, 500);
  }
};
export const cancelSignup=(req,res)=>{
  try{
  delete req.session.signupOtp
  delete req.session.signupOtpExpiry
  delete req.session.otpLastSentAt
  delete req.session.signupData

  return res.redirect('/api/auth/register')
  }catch(error){
    console.log(error,'cancel singup error in the otp page')
    return res.redirect('/api/auth/register')
  }
}
export const googleAuthCallback = async (req, res) => {
  try {
    const googleUser = req.user;

    if (!googleUser?.email) {
      return res.redirect("/api/auth/register");
    }

    const email = googleUser.email.toLowerCase();
    const name = googleUser.name;
    const googleAuthIntent = req.session.googleAuthIntent === "signup" ? "signup" : "login";
    delete req.session.googleAuthIntent;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (googleAuthIntent === "signup") {
        return res.redirect(
          "/api/auth/register?error=" +
            encodeURIComponent("User already exists. Please login.")
        );
      }

      if (existingUser.isBlocked && (existingUser.role === "user" || existingUser.role === "admin")) {
        return res.redirect("/api/auth/login");
      }

      req.session.user = {
        id: existingUser._id,
        email: existingUser.email,
        name: existingUser.name,
      };

      return res.redirect("/api/auth/home");
    }

    if (googleAuthIntent !== "signup") {
      return res.redirect(
        "/api/auth/login?error=" +
          encodeURIComponent("User does not exist. Please sign up first.")
      );
    }

    const user = await User.create({
      name,
      email,
      googleId: googleUser.googleId || null,
      provider: "google",
      isVerified: true,
    });

    delete req.session.signupOtp;
    delete req.session.signupOtpExpiry;
    delete req.session.otpLastSentAt;
    delete req.session.signupData;

    return res.redirect("/api/auth/login");

  } catch (error) {
    console.log("Google auth error", error);
    return res.redirect("/api/auth/register");
  }
};
export const getSignupOtpPage = (req, res) => {

  if (!req.session.signupData) {
    return res.redirect("/api/auth/register");
  }

  res.set("Cache-Control", "no-store");

  return renderSignupOtp(req, res);
};
export default signupUser;
