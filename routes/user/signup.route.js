import express from "express";
import passport from "passport";
import signupUser, { getSignupPage , googleAuthCallback} from "../../controllers/signupController.js";

const router = express.Router();

router.get("/register",getSignupPage);

router.post("/register",(req,res,next)=>{
console.log(req.body)
next()
} ,signupUser);

router.get("/google",
  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/register",
    session: false
  }),
  googleAuthCallback
);

export default router;