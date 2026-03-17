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
import usermanagement from "../routes/admin/usermanagement.route.js";
import blockunblock from "../routes/admin/block-unblockrouter.js";
import usersprof from "../routes/user/profile.route.js";
import adressrouter from "../routes/user/adress.route.js";
import changepassword from "../routes/user/changepassword.route.js";
import logout from "../routes/user/logout.route.js";
import signupotp from "../routes/user/signupotp.route.js";
import profileemailverify from "../routes/user/profile-email-otp.route.js";
import promotedemoteAdmin from "../routes/admin/promotedemoteAdmin.route.js";
import userAuth from "../middleware/user/userauth.middleware.js";
import categoryRoutes from "../routes/admin/categoryRoute.js";
import productRoutes from "../routes/admin/productRoute.js";


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
app.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  next();
});
app.use(passport.initialize());
app.use(passport.session());
//admin
app.use('/api/admin',adminAuthrouter);
app.use('/api/admin',usermanagement)
app.use('/api/admin',promotedemoteAdmin)
app.use('/api/admin',blockunblock)
app.use('/api/admin',categoryRoutes)
app.use('/api/admin',productRoutes)
//user
app.use('/api/auth',signupRouter)
app.use('/api/auth',signupotp)
app.use('/api/auth',loginRouter)
app.use('/api/auth',forgotpassrouter)
app.use('/api/auth',verifyotp)
app.use('/api/auth',resetpassword)
app.use('/api/auth',homepage)
//user profile
app.use('/api/user',userAuth,usersprof)
app.use('/api/user',userAuth,adressrouter)
app.use('/api/user',userAuth,changepassword)
app.use('/api/user',userAuth,logout)
app.use('/api/user',userAuth,profileemailverify)

export default app;
