import express from "express";
import { getProductListingPage,getProductDetailsPage } from "../../controllers/user/productController.js";
const router = express.Router();

router.get("/products",getProductListingPage)
router.get("/products/:id",getProductDetailsPage)

export default router
