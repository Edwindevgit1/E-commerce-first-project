import cloudinary from "../../config/cloudinary.js";
import Category from "../../models/Category.js";

import {
  getProductService,
  addProductService,
  getProductByIdService,
  editProductService,
  deleteProductService
} from "../../services/productServices.js";


/* =================================
   PRODUCT LIST PAGE
================================= */

export const getProductController = async (req, res) => {

  try {

    const search = req.query.search || "";
    const selectedCategory = req.query.category || "";
    const selectedStatus = req.query.status || "";
    const currentPage = 1;

    const { products, categories } = await getProductService(
      search,
      selectedCategory,
      selectedStatus
    );

    res.render("admin/product-management", {
      products: products || [],
      categories: categories || [],
      search,
      selectedCategory,
      selectedStatus,
      currentPage,
      error: null
    });

  } catch (error) {

    console.log(error, "Product page error");

    res.render("admin/product-management", {
      products: [],
      categories: [],
      search: "",
      selectedCategory: "",
      selectedStatus: "",
      currentPage: 1,
      error: "Failed to load products"
    });

  }

};



/* =================================
   ADD PRODUCT PAGE
================================= */

export const getAddProductPage = async (req, res) => {

  try {

    const categories = await Category.find({ isDeleted: false });

    res.render("admin/add-edit-product-management", {
      pageTitle: "Add Product",
      formTitle: "Add Product",
      formAction: "/api/admin/add-product",
      submitLabel: "Save Product",
      categories,
      product: null,
      error: null
    });

  } catch (error) {

    console.log(error, "Add product page error");

  }

};



/* =================================
   ADD PRODUCT
================================= */

export const addProductController = async (req, res) => {

  try {

    const files = req.files || [];

    if (files.length < 3) {
      throw new Error("Minimum 3 images required");
    }

    const uploadPromises = files.map((file) => {

      return new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
          { folder: "products" },
          (error, result) => {

            if (error) return reject(error);

            resolve(result.secure_url);

          }
        );

        stream.end(file.buffer);

      });

    });

    const images = await Promise.all(uploadPromises);

    await addProductService({
      ...req.body,
      images
    });

    res.redirect("/api/admin/products");

  } catch (error) {

    console.log(error, "Add product controller error");

    const categories = await Category.find({ isDeleted: false });

    res.render("admin/add-edit-product-management", {
      pageTitle: "Add Product",
      formTitle: "Add Product",
      formAction: "/api/admin/add-product",
      submitLabel: "Save Product",
      categories,
      product: req.body,
      error: error.message
    });

  }

};



/* =================================
   EDIT PRODUCT PAGE
================================= */

export const getEditProductPage = async (req, res) => {

  try {

    const product = await getProductByIdService(req.params.id);
    const categories = await Category.find({ isDeleted: false });

    res.render("admin/add-edit-product-management", {
      pageTitle: "Edit Product",
      formTitle: "Edit Product",
      formAction: `/api/admin/edit-product/${product._id}`,
      submitLabel: "Update Product",
      categories,
      product,
      error: null
    });

  } catch (error) {

    console.log(error, "Edit product page error");

    res.redirect("/api/admin/products");

  }

};



/* =================================
   EDIT PRODUCT
================================= */
export const editProductController = async (req, res) => {

  try {

    const removeImages = req.body.removeImages
      ? req.body.removeImages.split(",").map(Number)
      : [];

    let newImages = [];

    if (req.files && req.files.length > 0) {

      const uploadPromises = req.files.map((file) => {

        return new Promise((resolve, reject) => {

          const stream = cloudinary.uploader.upload_stream(
            { folder: "products" },
            (error, result) => {

              if (error) return reject(error);

              resolve(result.secure_url);

            }
          );

          stream.end(file.buffer);

        });

      });

      newImages = await Promise.all(uploadPromises);

    }

    await editProductService(req.params.id,{
      ...req.body,
      newImages,
      removeImages
    });

    res.redirect("/api/admin/products");

  } catch(error){

    console.log(error,"Edit product error");

    const [product, categories] = await Promise.all([
      getProductByIdService(req.params.id),
      Category.find({ isDeleted: false })
    ]);

    res.render("admin/add-edit-product-management", {
      pageTitle: "Edit Product",
      formTitle: "Edit Product",
      formAction: `/api/admin/edit-product/${req.params.id}`,
      submitLabel: "Update Product",
      categories,
      product: {
        ...product.toObject(),
        ...req.body,
      },
      error: error.message
    });

  }

};
/* =================================
   DELETE PRODUCT (SOFT DELETE)
================================= */

export const deleteProductController = async (req, res) => {

  try {

    await deleteProductService(req.params.id);

    res.redirect("/api/admin/products");

  } catch (error) {

    console.log(error, "Delete product error");

    res.redirect("/api/admin/products");

  }

};
