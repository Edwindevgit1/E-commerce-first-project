import express from "express";
import signupUser, {
  resendSignupOtp,
  verifySignupOtp,
  cancelSignup,
  getSignupPage,
  getSignupOtpPage
} from "../../controllers/signupController.js";

const router = express.Router();

router.get("/register", getSignupPage);

router.get("/signupotp", getSignupOtpPage);

router.get("/cancel-signup", cancelSignup);
router.get("/cancel-singup", cancelSignup);

router.post("/signupotp", signupUser);

router.post("/resend-otp", resendSignupOtp);

router.post("/signupverify-otp", verifySignupOtp);

export default router;
