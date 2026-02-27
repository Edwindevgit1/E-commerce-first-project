import express from "express";
import { adminlogin,adminLogout } from "../../controllers/adminloginController.js";
import User from "../../models/User.js";
import { blockUser, unblockUser } from "../../controllers/block-unblockControllers.js";
import adminMiddleware from "../../middleware/adminauthmiddleware.js";


const router=express.Router()

router.get('/admin',(req,res)=>{
 res.render("admin/adminlogin")
})
router.post('/admin',adminlogin)
router.post('/adminlogout',adminLogout)
router.get('/adminusermanagement',async(req,res)=>{
  const users=await User.find({role:'user'})
  res.render('admin/usermanagement',{users})
})
router.post('/block/:id',adminMiddleware,blockUser)
router.post('/unblock/:id',adminMiddleware,unblockUser)
export default router;
