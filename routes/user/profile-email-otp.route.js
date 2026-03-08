import express from "express";
import {
  updateProfile,
  getVerifyEmailOtpPage,
  verifyEmailOtp,
  resendEmailOtp,
} from "../../controllers/profile-email-otp.Controller.js";
import upload from "../../middleware/user/uploadimage.js";

const router = express.Router();

router.post("/update-profile", upload.single("profileImage"), updateProfile);
router.get("/verify-email-otp", getVerifyEmailOtpPage);
router.post("/verify-email-otp", verifyEmailOtp);
router.post("/resend-email-otp", resendEmailOtp);

export default router;