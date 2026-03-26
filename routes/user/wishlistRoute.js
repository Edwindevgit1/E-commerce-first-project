import express from "express";
import { getWishlistController,addToWishlistController,removeFromWishlistController } from "../../controllers/user/wishlistController.js";
import noCache from "../../middleware/noCacheMiddleware.js";

const router = express.Router()

router.get("/wishlist",noCache,getWishlistController)
router.post("/wishlist/add/:productId",addToWishlistController)
router.post("/wishlist/remove/:productId",removeFromWishlistController)

export default router
