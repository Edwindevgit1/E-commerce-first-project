import User from "../models/User.js";

const verifyOTP = async (req, res) => {
  try {
    const { otp1, otp2, otp3, otp4, otp5, otp6 } = req.body;

    if (!otp1 || !otp2 || !otp3 || !otp4 || !otp5 || !otp6) {
      return res.render("user/verify", {
        error: "Please enter complete OTP"
      });
    }

    const enteredOTP = otp1 + otp2 + otp3 + otp4 + otp5 + otp6;

    const email = req.session.resetEmail;

    if (!email) {
      return res.redirect("/api/auth/forgotpassword");
    }

    const user = await User.findOne({ email });

    if (!user || !user.resetOtp) {
      return res.redirect("/api/auth/forgotpassword");
    }

    if (user.resetOtpExpiry < Date.now()) {
      return res.render("user/verify", {
        error: "OTP expired"
      });
    }


    if (user.resetOtp !== enteredOTP) {
      return res.render("user/verify", {
        error: "Invalid OTP"
      });
    }


    user.resetOtp = null;
    user.resetOtpExpiry = null;
    await user.save();

    req.session.otpVerified = true;

    res.redirect("/api/auth/resetpassword");

  } catch (err) {
    console.error(err);
    res.render("user/verify", {
      error: "Something went wrong"
    });
  }
};

export default verifyOTP