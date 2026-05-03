import User from "../models/User.js";
import bcrypt from "bcrypt";

const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

const getEmailValidationMessage = (email = "") => {
  if (!email) return "Email is required";
  if (/\s/.test(email)) return "Email cannot contain spaces";
  if (/[A-Z]/.test(email)) return "Email must be in lowercase only";
  if (!EMAIL_REGEX.test(email)) return "Please enter a valid email address";
  return "";
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = String(email || "").trim();
    if (!trimmedEmail || !password) {
      return res.render("user/login", {
        error: "All fields are required"
      });
    }

    const emailError = getEmailValidationMessage(trimmedEmail);
    if (emailError) {
      return res.render("user/login", {
        error: emailError
      });
    }

    const user = await User.findOne({ email: trimmedEmail });

    if (!user) {
      return res.render("user/login", {
        error: "Invalid email or password"
      });
    }
    if (user.provider !== "local") {
      return res.render("user/login", {
        error: "Please login using Google"
      });
    }
    if ((user.role === "user" || user.role === "admin") && user.isBlocked) {
      return res.render("user/login", {
        error: "Your account has been blocked. Contact support.",
      });
    }
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("user/login", {
        error: "Invalid email or password"
      });
    }
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email
    };
    return res.redirect('/api/auth/home')

  } catch (error) {
    console.error("Login error:", error);
    return res.render("user/login", {
      error: "Login failed. Please try again."
    });
  }
};

export default loginUser;
