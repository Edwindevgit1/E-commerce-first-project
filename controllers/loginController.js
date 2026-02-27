import User from "../models/User.js";
import bcrypt from "bcrypt";

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.render("user/login", {
        error: "All fields are required"
      });
    }
    const user = await User.findOne({ email });

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