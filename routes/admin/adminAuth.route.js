import express from "express";
import { adminlogin, adminLogout, getAdminLoginPage } from "../../controllers/adminloginController.js";
import noCache from "../../middleware/noCacheMiddleware.js";

const router = express.Router();


router.get('/admin',noCache,getAdminLoginPage)
router.post('/admin' ,adminlogin);
router.post('/adminlogout', adminLogout);


export default router;