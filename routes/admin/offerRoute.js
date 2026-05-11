import express from "express";
import adminMiddleware from "../../middleware/adminauthmiddleware.js";
import noCache from "../../middleware/noCacheMiddleware.js";
import {
  getOffersController,
  getReferralSettingsController,
  updateCategoryOfferController,
  updateProductOfferController,
  updateReferralSettingsController
} from "../../controllers/admin/offerController.js";

const router = express.Router();

router.get("/offers", noCache, adminMiddleware, getOffersController);
router.get("/offers/referral-settings", noCache, adminMiddleware, getReferralSettingsController);
router.post("/offers/products/:id", adminMiddleware, updateProductOfferController);
router.post("/offers/categories/:id", adminMiddleware, updateCategoryOfferController);
router.post("/offers/referral-settings", adminMiddleware, updateReferralSettingsController);

export default router;
