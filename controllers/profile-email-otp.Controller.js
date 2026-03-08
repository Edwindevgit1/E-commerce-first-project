import User from "../models/User.js";

const EMAIL_OTP_EXPIRY_MS = 10 * 60 * 1000;
const EMAIL_OTP_COOLDOWN_SEC = 30;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

export const updateProfile = async (req,res) => {
 try{
    const userId=req.session.user?._id;
    if(!userId) return res.redirect('/api/auth/login');

    const user = await User.findById(userId)
    if(!user) return res.redirect('/api/auth/login');

    const name = (req.body.name || "").trim()
    const newEmail = (req.body.email || "").toLowerCase()

    const newProfileImage = req.file ? `/uploads/${req.file.filename}` : user.profileImage;
    console.log("New email:", newEmail);
    console.log("Old email:", user.email);
    if(!newEmail||newEmail===user.email){
      user.name=name || user.name;
      user.profileImage=newProfileImage || user.profileImage;
      await user.save()
      return res.redirect('/api/user/profile')
    }

    const emailTaken = await User.findOne({email:newEmail,_id:{$ne:userId}})
    if(emailTaken){
      return res.render('user/profile',{
        user,
        error:'Email is already in use'
      })
    }
    const otp = generateOtp()
    req.session.emailChangeOtp=otp;
    req.session.emailChangeOtpExpiry= Date.now()+ EMAIL_OTP_EXPIRY_MS ;
    req.session.emailChangeLastSendAt = Date.now()

    req.session.pendingProfileUpdate={
      name:name || user.name,
      email:newEmail,
      profileImage: newProfileImage || user.profileImage,
    }
    console.log('Email changing OTP:',otp)
    return res.redirect('/api/user/verify-email-otp')

 }catch(error){
  console.log(error,'update profile error')
  return res.redirect('/api/user/profile')
 }
}

export const getVerifyEmailOtpPage = (req,res)=>{
 const pendingEmail = req.session.pendingProfileUpdate?.email || "";
 return res.render('user/profile-email-otp',{ pendingEmail,error:null })
}

export const verifyEmailOtp = async (req,res)=>{
  try{
    const userId = req.session.user?._id
    if(!userId){
      return res.redirect('/api/auth/login')
    }
    const otp = String(req.body.otp || "").trim();

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).render("user/profile-email-otp", {
        pendingEmail: req.session.pendingProfileUpdate?.email || "",
        error: "Enter valid 6-digit OTP",
      });
    }
    if (
      !req.session.emailChangeOtp ||
      !req.session.emailChangeOtpExpiry ||
      !req.session.pendingProfileUpdate
    ) {
      return res.status(400).render("user/profile-email-otp", {
        pendingEmail: "",
        error: "Session expired. Try again.",
      });
    }
    if (Date.now() > req.session.emailChangeOtpExpiry) {
      return res.status(400).render("user/profile-email-otp", {
        pendingEmail: req.session.pendingProfileUpdate.email,
        error: "OTP expired. Resend OTP.",
      });
    }
    if (otp !== req.session.emailChangeOtp) {
      return res.status(400).render("user/profile-email-otp", {
        pendingEmail: req.session.pendingProfileUpdate.email,
        error: "Invalid OTP",
      });
    }
    const user = await User.findById(userId)
    if(!user) return res.redirect('/api/auth/login')

    const pending = req.session.pendingProfileUpdate;
    user.name=pending.name;
    user.email=pending.email;
    user.profileImage=pending.profileImage;
    await user.save()

    if (req.session.user) req.session.user.email = pending.email;

    delete req.session.emailChangeOtp;
    delete req.session.emailChangeOtpExpiry;
    delete req.session.emailChangeLastSendAt;
    delete req.session.pendingProfileUpdate;

    return res.redirect('/api/user/profile')

  }catch(error){
    console.log(error,'veriy email otp error')
    res.redirect('/api/user/profile')
  }
}
export const resendEmailOtp = async (req,res)=>{
  try{
    const pending = req.session.pendingProfileUpdate;
    if (!pending?.email) {
      return res.status(400).json({ message: "No pending email change" });
    }
    const now = Date.now()
    const last = req.session.emailChangeLastSendAt || 0
    const elapsed = Math.floor((now - last) / 1000);


    if (elapsed < EMAIL_OTP_COOLDOWN_SEC) {
      return res.status(429).json({
        message: "Please wait",
        retryAfter: EMAIL_OTP_COOLDOWN_SEC - elapsed,
      });
    }
    const otp = generateOtp()
    req.session.emailChangeOtp = otp;
    req.session.emailChangeOtpExpiry = now + EMAIL_OTP_EXPIRY_MS;
    req.session.emailChangeLastSendAt = now;

    console.log("Resend Email change OTP:", otp);
    return res.json({ success: true });
  }catch(error){
    console.error("resendEmailOtp error:", error);
    return res.status(500).json({ message: "Failed to resend OTP" });
  }
}