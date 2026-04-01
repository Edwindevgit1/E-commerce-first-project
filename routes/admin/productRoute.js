import express from "express";
import upload from "../../middleware/user/upload.js";
import adminMiddleware from "../../middleware/adminauthmiddleware.js";
import noCache from "../../middleware/noCacheMiddleware.js";
import {
  getProductController,
  getAddProductPage,
  addProductController,
  getEditProductPage,
  editProductController,
  deleteProductController
} from "../../controllers/admin/productController.js";

const router = express.Router();

router.get("/products",noCache,adminMiddleware,getProductController);
router.get("/add-product",noCache,adminMiddleware,getAddProductPage);
router.post("/add-product",adminMiddleware,upload.array("images", 10),addProductController);
router.get("/edit-product/:id",noCache,adminMiddleware,getEditProductPage);
router.post("/edit-product/:id",adminMiddleware,upload.array("images", 10),editProductController);
router.post("/delete-product/:id",adminMiddleware,deleteProductController
);


export default router;
