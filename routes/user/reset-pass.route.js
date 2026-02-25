import express from "express"

const router=express.Router()

router.get('/resetpass',(req,res)=>{
  res.render('user/reset-password')
})
export default router