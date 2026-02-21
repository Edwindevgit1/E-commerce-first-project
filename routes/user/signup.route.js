import express from "express";
import passport from "passport";
import signupUser from "../../controllers/signupController.js";

const router = express.Router();

router.get("/register", (req, res) => {
  res.render("user/signup");
});

router.post("/register",(req,res,next)=>{
console.log(req.body)
next()
} ,signupUser);

router.get("/google",
  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

// GOOGLE CALLBACK
router.get("/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/register"
  }),
  (req, res) => {
    res.redirect("/");
  }
);

export default router;