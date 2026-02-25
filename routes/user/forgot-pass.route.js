import express from "express"

const router=express.Router()

router.get('/forgotpass',(req,res)=>{
  res.render('user/forgot-password')
})
export default router