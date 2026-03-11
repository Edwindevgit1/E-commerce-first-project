import User from "../models/User.js";

export const promotetoAdmin = async (req,res)=>{
  try{
    const userId = req.params.id;
    await User.findByIdAndUpdate(userId,{
      role:"admin"
    })
    res.redirect('/api/admin/adminusermanagement')
  }catch(error){
    console.log(error,"Promote to Admin error")
  }
}

export const demoteToUser = async (req,res)=>{
  try{
    const userId = req.params.id;
    await User.findByIdAndUpdate(userId,{
      role:"user"
    })
    res.redirect("/api/admin/adminusermanagement")
  }catch(error){
    console.log(error,'Demote to user error')
  }
}