const blockAuthPages = async (req,res,next)=>{
  if(req.session.user){
    return res.redirect('/api/auth/home')
  }
  next()
}
export default blockAuthPages