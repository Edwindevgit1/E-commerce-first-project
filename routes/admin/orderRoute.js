import express from "express";
import adminMiddleware from "../../middleware/adminauthmiddleware.js";
import noCache from "../../middleware/noCacheMiddleware.js";
import {
  getAdminOrdersController,
  getAdminOrderDetailController,
  updateAdminOrderStatusController,
  verifyAndRestockOrderItemController,
  rejectReturnRequestController
} from "../../controllers/admin/orderController.js";

const router = express.Router();

router.get("/orders", noCache, adminMiddleware, getAdminOrdersController);
router.get("/orders/:id", noCache, adminMiddleware, getAdminOrderDetailController);
router.post("/orders/:id/status", adminMiddleware, updateAdminOrderStatusController);
router.post("/orders/:id/items/:itemIndex/restock", adminMiddleware, verifyAndRestockOrderItemController);
router.post("/orders/:id/items/:itemIndex/reject-return", adminMiddleware, rejectReturnRequestController);

export default router;
