const superAdmin = async (req,res,next)=>{
  if(!req.session.admin){
    return res.redirect('/api/admin/admin')
  }
  if(req.admin.role !=="superadmin"){
    return res.status(403).send('Only super admin allowed')
  }
  next()
}
export  default superAdmin