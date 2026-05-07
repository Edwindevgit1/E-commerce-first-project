import express from "express";
import adminMiddleware from "../../middleware/adminauthmiddleware.js";
import noCache from "../../middleware/noCacheMiddleware.js";
import {
  createReferralOfferController,
  getOffersController,
  updateCategoryOfferController,
  updateProductOfferController
} from "../../controllers/admin/offerController.js";

const router = express.Router();

router.get("/offers", noCache, adminMiddleware, getOffersController);
router.post("/offers/products/:id", adminMiddleware, updateProductOfferController);
router.post("/offers/categories/:id", adminMiddleware, updateCategoryOfferController);
router.post("/offers/referral", adminMiddleware, createReferralOfferController);

export default router;
