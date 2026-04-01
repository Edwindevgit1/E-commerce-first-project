import express from "express"
import adminMiddleware from "../../middleware/adminauthmiddleware.js";
import { getUserManagement } from "../../controllers/adminUserManagementController.js";
import noCache from "../../middleware/noCacheMiddleware.js";

const router=express.Router()


router.get('/adminusermanagement',noCache,adminMiddleware,getUserManagement)
export default router
