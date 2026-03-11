import User from '../models/User.js'
import bcrpyt from "bcrypt"

export const getAdminLoginPage = (req,res)=>{
  if(req.session.admin){
    return res.redirect('/api/admin/adminusermanagement')
  }
  res.render("admin/adminlogin");
}

export const adminlogin = async(req,res)=>{
  try{
    const {email,password}=req.body
    if(!email||!password){
      return res.render('admin/adminlogin',{
        error:'All fields are required'
      })
    }
    const trimmedEmail=email.trim().toLowerCase()
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

export const adminLogout=async(req,res)=>{
  req.session.destroy(()=>{
    return res.redirect('/api/admin/admin')
  })
  }