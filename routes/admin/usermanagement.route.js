import express from "express"
import adminMiddleware from "../../middleware/adminauthmiddleware.js";
import { getUserManagement } from "../../controllers/adminUserManagementController.js";

const router=express.Router()


router.get('/adminusermanagement',adminMiddleware,getUserManagement)
export default router