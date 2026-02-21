import express from "express"

const router=express.Router()

router.get('/login',(req,res)=>{
  res.render('user/login')
})
router.post('/login',(req,res)=>{
  res.send("you reached the home page")
})
export default router;