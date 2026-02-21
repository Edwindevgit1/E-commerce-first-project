import express from "express";

const router=express.Router()

router.get('/admin',(req,res)=>{
 res.render("admin/adminlogin")
})
router.post('/admin',(req,res)=>{
 console.log(req.body)
 res.send('login recived')
})
export default router;
