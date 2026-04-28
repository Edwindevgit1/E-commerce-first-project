import express from "express";
import {
  getCartController,
  addToCartController,
  removeFromCartController,
  updateCartQuantityController,
  updateCartQuantityAjaxController,
  checkoutCartController,
  placeOrderController,
  getOrderSuccessController
} from "../../controllers/user/cartController.js";
import noCache from "../../middleware/noCacheMiddleware.js";

const router = express.Router()

router.get("/cart",noCache,getCartController)
router.post("/cart/add/:productId",addToCartController);
router.post("/cart/remove/:productId",removeFromCartController)
router.post("/cart/update/:productId",updateCartQuantityController)
router.post("/cart/update-ajax/:productId",updateCartQuantityAjaxController)
router.post("/cart/checkout", checkoutCartController)
router.post("/cart/place-order", placeOrderController);
router.get("/order-success/:orderId", noCache, getOrderSuccessController);

export default router
