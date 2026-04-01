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
  deleteProductController,
  restoreProductController,
  permanentDeleteProductController
} from "../../controllers/admin/productController.js";

const router = express.Router();

router.get("/products",noCache,getProductController);
router.get("/add-product",noCache,getAddProductPage);
router.post("/add-product",upload.array("images", 10),addProductController);
router.get("/edit-product/:id",noCache,getEditProductPage);
router.post("/edit-product/:id",upload.array("images", 10),editProductController);
router.post("/delete-product/:id",deleteProductController);
router.post("/restore-product/:id",restoreProductController);
router.post("/permanent-delete-product/:id", permanentDeleteProductController);

export default router;
