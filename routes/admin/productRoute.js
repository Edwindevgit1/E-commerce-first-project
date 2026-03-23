import express from "express";
import upload from "../../middleware/user/upload.js";

import {
  getProductController,
  getAddProductPage,
  addProductController,
  getEditProductPage,
  editProductController,
  deleteProductController
} from "../../controllers/admin/productController.js";

const router = express.Router();

router.get(
  "/products",
  getProductController
);

router.get(
  "/add-product",
  getAddProductPage
);

router.post(
  "/add-product",
  upload.array("images", 10),
  addProductController
);

router.get(
  "/edit-product/:id",
  getEditProductPage
);

router.post(
  "/edit-product/:id",
  upload.array("images", 10),
  editProductController
);

router.post(
  "/delete-product/:id",
  deleteProductController
);


export default router;
