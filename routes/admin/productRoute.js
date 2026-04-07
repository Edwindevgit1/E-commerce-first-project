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

router.get("/products",noCache,adminMiddleware,getProductController);
router.get("/add-product",noCache,adminMiddleware,getAddProductPage);
router.post("/add-product",adminMiddleware,upload.any(),addProductController);
router.get("/edit-product/:id",noCache,adminMiddleware,getEditProductPage);
router.post("/edit-product/:id",adminMiddleware,upload.any(),editProductController);
router.post("/delete-product/:id",adminMiddleware,deleteProductController
);
router.post("/restore-product/:id",adminMiddleware,restoreProductController);
router.post("/permanent-delete-product/:id",adminMiddleware,permanentDeleteProductController);


export default router;
