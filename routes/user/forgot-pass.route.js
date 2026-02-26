import express from "express";
import sendOtp from "../../controllers/forgotpasswordController.js";

const router = express.Router();

router.get('/forgotpassword', (req, res) => {
  res.render('user/forgot-password');
});

router.post('/forgotpassword', sendOtp);

export default router;