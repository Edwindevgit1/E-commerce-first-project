import express from "express"

const router=express.Router()

router.get('/resetpassword',(req,res)=>{
  res.render('user/reset-password')
})
export default router