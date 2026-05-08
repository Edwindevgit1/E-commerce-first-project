import express from "express";
import adminMiddleware from "../../middleware/adminauthmiddleware.js";
import noCache from "../../middleware/noCacheMiddleware.js";
import {
  createReferralOfferController,
  deleteReferralOfferController,
  getOffersController,
  updateCategoryOfferController,
  updateProductOfferController,
  updateReferralOfferController
} from "../../controllers/admin/offerController.js";

const router = express.Router();

router.get("/offers", noCache, adminMiddleware, getOffersController);
router.post("/offers/products/:id", adminMiddleware, updateProductOfferController);
router.post("/offers/categories/:id", adminMiddleware, updateCategoryOfferController);
router.post("/offers/referral", adminMiddleware, createReferralOfferController);
router.post("/offers/referral/:id", adminMiddleware, updateReferralOfferController);
router.post("/offers/referral/:id/delete", adminMiddleware, deleteReferralOfferController);

export default router;
