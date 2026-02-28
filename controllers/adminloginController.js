import User from '../models/User.js'
import bcrpyt from "bcrypt"

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
    if(user.role!=='admin'){
      return res.render('admin/adminlogin',{
        error:'Access denied'
      })
    }
    if(user.provider!=='local'){
      return res.render('admin/adminlogin',{
        error:'Admin must login through the email and password'
      })
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
    console.log('Admin log in error',error)
    return res.render('admin/adminlogin',{
      error:'Something went wrong'
    })
  }
}
export const adminLogout=async(req,res)=>{
  req.session.admin=null
  return res.redirect('/api/admin/admin')
}