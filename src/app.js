import express from "express";
import passport from "passport";
import session from "express-session";

import "../config/passport.js";
import adminAuthrouter from "../routes/admin/adminAuth.route.js";
import signupRouter from "../routes/user/signup.route.js";
import loginRouter  from "../routes/user/login.route.js";
import forgotpassrouter from "../routes/user/forgot-pass.route.js";
import verifyotp from "../routes/user/verify-otp.route.js";
import resetpassword from "../routes/user/reset-pass.route.js";
import homepage from "../routes/user/home.route.js";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(session({
  secret: 'yoursecret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use("/api/auth", adminAuthrouter);
app.use('/api/auth',signupRouter)
app.use('/api/auth',loginRouter)
app.use('/api/auth',forgotpassrouter)
app.use('/api/auth',verifyotp)
app.use('/api/auth',resetpassword)
app.use('/api/auth/',homepage)

export default app;