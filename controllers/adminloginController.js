import User from '../models/User.js'
import bcrpyt from "bcrypt"

const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

const getEmailValidationMessage = (email = "") => {
  if (!email) return "Email is required";
  if (/\s/.test(email)) return "Email cannot contain spaces";
  if (/[A-Z]/.test(email)) return "Email must be in lowercase only";
  if (!EMAIL_REGEX.test(email)) return "Please enter a valid email address";
  return "";
};

export const getAdminLoginPage = (req,res)=>{
  if(req.session.admin){
    return res.redirect('/api/admin/adminusermanagement')
  }
  res.render("admin/adminlogin");
}

export const adminlogin = async(req,res)=>{
  try{
    const {email,password}=req.body
    const trimmedEmail = String(email || "").trim();
    if(!trimmedEmail||!password){
      return res.render('admin/adminlogin',{
        error:'All fields are required'
      })
    }
    const emailError = getEmailValidationMessage(trimmedEmail);
    if (emailError) {
      return res.render("admin/adminlogin", {
        error: emailError
      });
    }
    const user=await User.findOne({email:trimmedEmail})
    if(!user){
      return res.render('admin/adminlogin',{
        error:'Invalid email or password'
      })
    }
    if(user.role!=='admin' && user.role!=='superadmin'){
      return res.render('admin/adminlogin',{
        error:'Access denied'
      })
    }
    if(user.provider!=='local'){
      return res.render('admin/adminlogin',{
        error:'Admin must login through the email and password'
      })
    }
    if (user.isBlocked) {
      return res.render("admin/adminlogin", {
        error: "Your account has been blocked. Contact super admin.",
      });
    }
    const isMatch=await bcrpyt.compare(password,user.password)
    if(!isMatch){
      return res.render('admin/adminlogin',{
        error:'Invalid email or password'
      })
    }
    req.session.admin={
      id:user._id,
      email:user.email,
      role:user.role
    }
    return res.redirect('/api/admin/adminusermanagement')
  }catch(error){
    console.log(error,'Admin login error')
    return res.render('admin/adminlogin',{
      error:'Something went wrong'
    })
  }
}

export const adminLogout=(req,res)=>{
  delete req.session.admin;
  return res.redirect('/api/admin/admin')
  }
