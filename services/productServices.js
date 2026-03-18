import Product from "../models/Product.js";
import Category from "../models/Category.js";

const parseListField = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};


/* ==============================
   GET PRODUCTS
================================ */

export const getProductService = async (search, category, status) => {

  const query = { isDeleted: false };

  if (search) {
    query.productName = {
      $regex: search,
      $options: "i"
    };
  }

  if (category) {
    query.category = category;
  }

  if (status) {
    query.status = status;
  }

  const products = await Product
    .find(query)
    .populate("category")
    .sort({ createdAt: -1 });

  const categories = await Category.find({
    isDeleted: false
  });

  return {
    products,
    categories
  };

};



/* ==============================
   ADD PRODUCT
================================ */

export const addProductService = async (data) => {

  const {
    productName,
    category,
    price,
    stock,
    status,
    description,
    sizes,
    colors,
    images
  } = data;

  if (!productName || !category || !price || !stock) {
    throw new Error("Required fields missing");
  }

  if (!images || images.length < 3) {
    throw new Error("Minimum 3 images required");
  }

  const product = new Product({
    productName,
    category,
    price,
    stock,
    sizes: parseListField(sizes),
    colors: parseListField(colors),
    status,
    description,
    images
  });

  return await product.save();

};



/* ==============================
   GET PRODUCT BY ID
================================ */

export const getProductByIdService = async (id) => {

  const product = await Product
    .findById(id)
    .populate("category");

  if (!product || product.isDeleted) {
    throw new Error("Product not found");
  }

  return product;

};



/* ==============================
   EDIT PRODUCT
================================ */

export const editProductService = async (id, data) => {

  const product = await Product.findById(id);

  if (!product || product.isDeleted) {
    throw new Error("Product not found");
  }

  product.productName = data.productName || product.productName;
  if (data.category) {
    product.category = data.category;
  }
  product.price = data.price || product.price;
  product.stock = data.stock || product.stock;
  product.sizes = parseListField(data.sizes);
  product.colors = parseListField(data.colors);
  product.status = data.status || product.status;
  product.description = data.description || product.description;

  const removeIndexes = Array.isArray(data.removeImages) ? data.removeImages : [];
  const remainingImages = (product.images || []).filter((_, index) => !removeIndexes.includes(index));
  const uploadedImages = Array.isArray(data.newImages) ? data.newImages : [];
  const updatedImages = [...remainingImages, ...uploadedImages];

  if (updatedImages.length < 3) {
    throw new Error("Minimum 3 images required");
  }

  product.images = updatedImages;

  return await product.save();

};



/* ==============================
   SOFT DELETE PRODUCT
================================ */

export const deleteProductService = async (id) => {

  const product = await Product.findById(id);

  if (!product || product.isDeleted) {
    throw new Error("Product not found");
  }

  product.isDeleted = true;

  return await product.save();

};
