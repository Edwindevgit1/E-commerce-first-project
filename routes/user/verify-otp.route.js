import express from "express";
import verifyOTP, { resendOtp } from "../../controllers/otpverificationController.js";

const router = express.Router();

router.get('/verify', (req, res) => {

  if (!req.session.resetEmail) {
    return res.redirect('/api/auth/forgotpassword');
  }

  res.set("Cache-Control","no-store");

  res.render('user/verify');

});
router.get('/forgot-cancel-reset', (req,res)=>{
  delete req.session.resetEmail
  delete req.session.otpVerified
  res.redirect('/api/auth/login')
})
router.post('/verify',verifyOTP)
router.post("/forgot-resend-otp", resendOtp);
export default router;