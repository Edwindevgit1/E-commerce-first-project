import express from 'express'

const router=express.Router()

router.post('/logout',(req,res)=>{
  delete req.session.user;
  return res.redirect("/api/auth/login")
})

export default router