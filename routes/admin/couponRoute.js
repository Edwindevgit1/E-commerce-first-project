import express from "express";
import adminMiddleware from "../../middleware/adminauthmiddleware.js";
import noCache from "../../middleware/noCacheMiddleware.js";
import {
  createCouponController,
  deleteCouponController,
  getCouponsController
} from "../../controllers/admin/couponController.js";

const router = express.Router();

router.get("/coupons", noCache, adminMiddleware, getCouponsController);
router.post("/coupons", adminMiddleware, createCouponController);
router.post("/coupons/:id/delete", adminMiddleware, deleteCouponController);

export default router;
