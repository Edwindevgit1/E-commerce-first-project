import express from "express";
import passport from "passport";
import signupUser, { getSignupPage , googleAuthCallback} from "../../controllers/signupController.js";
import blockAuthPages from "../../middleware/user/blockAuth.middleware.js";

const router = express.Router();

router.get("/register",blockAuthPages,getSignupPage);

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