import express from "express"

const router=express.Router()

router.get('/verify',(req,res)=>{
  res.render('user/verify')
})
export default router