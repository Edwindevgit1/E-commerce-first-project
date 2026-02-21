import User from "../models/User.js";
import bcrypt from "bcrypt";

const signupUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if(!name||!email||!password){
      return res.render('user/signup',{
        error:'All fields are required'
      })
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.render("user/signup", {
        error: "Password must follow the given conditions",
        name,
        email
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('user/signup',{
        error:'User already exists',
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (role defaults to "user")
    await User.create({
      name,
      email,
      password: hashedPassword
    });

    // Redirect to login page
    return res.redirect("/api/auth/login");

  } catch (error) {
    console.error(error,'signup error');
    return res.render('user/signup',{
      error:'Registration failed'
    })
  }
};

export default signupUser;