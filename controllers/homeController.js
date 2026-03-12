export const loadHome = (req,res)=>{
  if(!req.user){
    return res.redirect("/api/auth/login")
  }
  res.render('user/home',{
    user:req.user
  })
}
