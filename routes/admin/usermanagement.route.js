import express from "express"
import adminMiddleware from "../../middleware/adminauthmiddleware.js";
import {
  getUserManagement,
  regenerateUserReferralCodeController,
  resetUserReferralController,
  resumeUserReferralController,
  suspendUserReferralController
} from "../../controllers/adminUserManagementController.js";
import noCache from "../../middleware/noCacheMiddleware.js";

const router=express.Router()


router.get('/adminusermanagement',noCache,adminMiddleware,getUserManagement)
router.post('/adminusermanagement/referral/:id/reset', adminMiddleware, resetUserReferralController)
router.post('/adminusermanagement/referral/:id/regenerate', adminMiddleware, regenerateUserReferralCodeController)
router.post('/adminusermanagement/referral/:id/suspend', adminMiddleware, suspendUserReferralController)
router.post('/adminusermanagement/referral/:id/resume', adminMiddleware, resumeUserReferralController)
export default router
