import express from "express";
import signupUser, { resendSignupOtp, verifySignupOtp ,cancelSignup} from "../../controllers/signupController.js";


const router = express.Router();

router.get("/signupotp", (req, res) => {
  res.render("user/signupotp");
});

router.get('/cancel-singup',cancelSignup)
router.post("/signupotp", signupUser);      
router.post("/resend-otp", resendSignupOtp);
router.post('/signupverify-otp',verifySignupOtp)
export default router;
