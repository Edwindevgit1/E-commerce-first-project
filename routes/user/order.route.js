import express from "express";
import {
  getOrdersPage,
  getOrderDetailPage,
  cancelOrderController,
  cancelOrderItemController,
  returnOrderController,
  returnOrderItemController,
  downloadInvoiceController
} from "../../controllers/user/orderController.js";
import noCache from "../../middleware/noCacheMiddleware.js";

const router = express.Router();

router.get("/orders", noCache, getOrdersPage);
router.get("/orders/:orderId", noCache, getOrderDetailPage);
router.post("/orders/:orderId/cancel", cancelOrderController);
router.post("/orders/:orderId/items/:itemIndex/cancel", cancelOrderItemController);
router.post("/orders/:orderId/return", returnOrderController);
router.post("/orders/:orderId/items/:itemIndex/return", returnOrderItemController);
router.get("/orders/:orderId/invoice", downloadInvoiceController);

export default router;
