import User from "../models/User.js";

const adminMiddleware=async(req,res,next)=>{
  try{
    if(!req.session.admin){
      return res.redirect('/api/admin/admin')
    }
    const admin=await User.findById(req.session.admin.id) 
    if(!admin){
      req.session.admin=null
      return res.redirect('/api/admin/admin')
    }
    if(admin.role!=='admin'){
      req.session.admin=null
      return res.redirect('/api/admin/admin')
    }
    if(admin.isBlocked){
      req.session.admin=null
      return res.redirect('api/admin/admin')
    }
    req.admin=admin
    next()
  }catch(error){
    console.log(error,'admin auth middleware error')
    return res.redirect('/api/admin/admin')
  }
}
export default adminMiddleware