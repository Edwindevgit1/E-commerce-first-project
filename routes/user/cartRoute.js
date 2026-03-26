import express from "express";
import { getCartController,addToCartController,removeFromCartController,updateCartQuantityController } from "../../controllers/user/cartController.js";
import noCache from "../../middleware/noCacheMiddleware.js";

const router = express.Router()

router.get("/cart",noCache,getCartController)
router.post("/cart/add/:productId",addToCartController);
router.post("/cart/remove/:productId",removeFromCartController)
router.post("/cart/update/:productId",updateCartQuantityController)

export default router
