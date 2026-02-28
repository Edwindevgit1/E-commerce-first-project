import User from "../models/User.js";

export const blockUser=async(req,res)=>{
  await User.findByIdAndUpdate(req.params.id,{isBlocked:true})
  res.redirect('/api/admin/adminusermanagement')
}
export const unblockUser=async(req,res)=>{
  await User.findByIdAndUpdate(req.params.id,{isBlocked:false})
  res.redirect('/api/admin/adminusermanagement')
}