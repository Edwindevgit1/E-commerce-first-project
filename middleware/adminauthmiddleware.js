import User from "../models/User.js";

const adminMiddleware=async(req,res)=>{
  try{
    if(!req.session.admin){
      return res.redirect('/api/auth/admin')
    }
    const admin=await User.findById(req.session.admin.id) 
    if(!admin){
      req.session.admin=null
      return res.redirect('/api/auth/admin')
    }
    if(admin.role!=='admin'){
      req.session.admin=null
      return res.redirect('/api/auth/admin')
    }
    if(admin.isBlocked){
      req.session.admin=null
      return res.redirect('api/auth/admin')
    }
    req.admin=admin
    next()
  }catch(error){
    console.log(error,'admin auth middleware error')
    return res.redirect('/api/auth/admin')
  }
}
export default adminMiddleware