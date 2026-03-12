export const loadHome = (req,res)=>{
  if(!req.session.user){
    return res.redirect("/api/auth/login")
  }
  res.render('user/home',{
    user:req.session.user
  })
}