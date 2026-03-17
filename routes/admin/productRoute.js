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


/* ===============================
   PRODUCT LIST PAGE
================================ */

router.get(
  "/products",
  getProductController
);


/* ===============================
   ADD PRODUCT PAGE
================================ */

router.get(
  "/add-product",
  getAddProductPage
);


/* ===============================
   ADD PRODUCT
================================ */

router.post(
  "/add-product",
  upload.array("images", 5),
  addProductController
);


/* ===============================
   EDIT PRODUCT PAGE
================================ */

router.get(
  "/edit-product/:id",
  getEditProductPage
);


/* ===============================
   UPDATE PRODUCT
================================ */

router.post(
  "/edit-product/:id",
  upload.array("images", 5),
  editProductController
);


/* ===============================
   SOFT DELETE PRODUCT
================================ */

router.post(
  "/delete-product/:id",
  deleteProductController
);


export default router;