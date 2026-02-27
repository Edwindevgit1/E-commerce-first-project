import express from "express";
import verifyOTP from "../../controllers/otpverificationController.js";

const router = express.Router();

router.get('/verify', (req, res) => {
  res.render('user/verify');
});
router.post('/verify',verifyOTP)

export default router;