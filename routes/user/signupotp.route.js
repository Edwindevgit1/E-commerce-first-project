import express from "express";
import signupUser, {
  resendSignupOtp,
  verifySignupOtp,
  cancelSignup,
  getSignupPage,
  getSignupOtpPage
} from "../../controllers/signupController.js";

const router = express.Router();

// signup page
router.get("/register", getSignupPage);

// OTP page
router.get("/signupotp", getSignupOtpPage);

// cancel signup
router.get("/cancel-signup", cancelSignup);

// submit signup form
router.post("/signupotp", signupUser);

// resend OTP
router.post("/resend-otp", resendSignupOtp);

// verify OTP
router.post("/signupverify-otp", verifySignupOtp);

export default router;