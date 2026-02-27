import User from "../models/User.js";
import bcrypt from "bcrypt";

const signupUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Trim values
    const trimmedName = name?.trim();
    const trimmedEmail = email?.trim();

    // Required field validation
    if (!trimmedName || !trimmedEmail || !password) {
      return res.render("user/signup", {
        error: "All fields are required",
        name: trimmedName,
        email: trimmedEmail
      });
    }

    // Enforce lowercase email (your chosen rule)
    if (/[A-Z]/.test(trimmedEmail)) {
      return res.render("user/signup", {
        error: "Email must be in lowercase only",
        name: trimmedName,
        email: trimmedEmail
      });
    }

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.render("user/signup", {
        error: "Password must follow the given conditions",
        name: trimmedName,
        email: trimmedEmail
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: trimmedEmail });

    if (existingUser) {
      if (existingUser.provider === "google") {
        return res.render("user/signup", {
          error: "Account exists. Please login using Google.",
          name: trimmedName,
          email: trimmedEmail
        });
      }

      return res.render("user/signup", {
        error: "User already exists please login",
        name: trimmedName,
        email: trimmedEmail
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    await User.create({
      name: trimmedName,
      email: trimmedEmail,
      password: hashedPassword,
      provider: "local"
    });

    return res.redirect("/api/auth/login");

  } catch (error) {
    console.error(error, "signup error");

    return res.render("user/signup", {
      error: "Registration failed"
    });
  }
};

export default signupUser;