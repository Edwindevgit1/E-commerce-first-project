import express from "express";
import signupUser, { resendSignupOtp, verifySignupOtp } from "../../controllers/signupController.js";


const router = express.Router();

router.get("/signupotp", (req, res) => {
  res.render("user/signupotp");
});

router.post("/signupotp", signupUser);      
router.post("/resend-otp", resendSignupOtp);
router.post('/signupverify-otp',verifySignupOtp)
export default router;
