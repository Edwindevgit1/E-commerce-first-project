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

const handleProductUpload = (req, res, next) => {
  upload.any()(req, res, (error) => {
    if (error) {
      req.uploadError = error;
    }

    next();
  });
};

router.get("/products",noCache,adminMiddleware,getProductController);
router.get("/add-product",noCache,adminMiddleware,getAddProductPage);
router.post("/add-product",adminMiddleware,handleProductUpload,addProductController);
router.get("/edit-product/:id",noCache,adminMiddleware,getEditProductPage);
router.post("/edit-product/:id",adminMiddleware,handleProductUpload,editProductController);
router.post("/delete-product/:id",adminMiddleware,deleteProductController
);
router.post("/restore-product/:id",adminMiddleware,restoreProductController);
router.post("/permanent-delete-product/:id",adminMiddleware,permanentDeleteProductController);


export default router;
