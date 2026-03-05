import express from "express";
import { adminlogin, adminLogout } from "../../controllers/adminloginController.js";
import adminMiddleware from "../../middleware/adminauthmiddleware.js";

const router = express.Router();


router.get('/admin', (req, res) => {
  res.render("admin/adminlogin");
});

router.post('/admin', adminlogin);
router.post('/adminlogout', adminLogout);


export default router;