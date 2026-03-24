import Product from "../models/Product.js";
import Category from "../models/Category.js";


/* ==============================
   HELPER
================================ */

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

const resolveMainImageIndex = ({ mainImageKey, images, remainingImages, uploadedImages }) => {
  if (typeof mainImageKey === "string" && mainImageKey.length > 0) {
    if (mainImageKey.startsWith("existing:")) {
      const originalIndex = Number(mainImageKey.split(":")[1]);
      if (!Number.isNaN(originalIndex) && Array.isArray(images)) {
        let currentIndex = 0;

        for (let index = 0; index < images.length; index += 1) {
          if (!remainingImages.includes(images[index])) continue;
          if (index === originalIndex) return currentIndex;
          currentIndex += 1;
        }
      }
    }

    if (mainImageKey.startsWith("new:")) {
      const newIndex = Number(mainImageKey.split(":")[1]);
      if (!Number.isNaN(newIndex) && newIndex >= 0 && newIndex < uploadedImages.length) {
        return remainingImages.length + newIndex;
      }
    }
  }

  return 0;
};


/* ==============================
   GET PRODUCTS
================================ */

export const getProductService = async (search, category, status, page = 1, limit = 10) => {

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

  const skip = (page - 1) * limit;

  const [products, totalProducts, categories] = await Promise.all([
    Product
      .find(query)
      .populate("category")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(query),
    Category.find({
      isDeleted: false
    })
  ]);

  return {
    products,
    categories,
    totalProducts,
    totalPages: Math.max(1, Math.ceil(totalProducts / limit))
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
    shippingInfo,
    sizes,
    colors,
    highlights,
    images,
    mainImageKey
  } = data;

  if (!productName || !category || price === undefined || stock === undefined) {
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
    highlights: parseListField(highlights),
    status,
    description,
    shippingInfo: shippingInfo || "",
    images,
    mainImageIndex: resolveMainImageIndex({
      mainImageKey,
      images: [],
      remainingImages: [],
      uploadedImages: images
    })
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

  /* ===== BASIC FIELD UPDATES ===== */

  if (data.productName) product.productName = data.productName;
  if (data.category) product.category = data.category;

  if (data.price !== undefined) product.price = data.price;
  if (data.stock !== undefined) product.stock = data.stock;

  product.sizes = parseListField(data.sizes);
  product.colors = parseListField(data.colors);
  product.highlights = parseListField(data.highlights);

  if (data.status) product.status = data.status;
  product.description = data.description || "";
  product.shippingInfo = data.shippingInfo || "";


  /* ===== IMAGE MANAGEMENT ===== */

  const removeIndexes = Array.isArray(data.removeImages) ? data.removeImages : [];

  const remainingImages = (product.images || []).filter(
    (_, index) => !removeIndexes.includes(index)
  );

  const uploadedImages = Array.isArray(data.newImages) ? data.newImages : [];

  const updatedImages = [...remainingImages, ...uploadedImages];

  /* enforce minimum images */

  if (updatedImages.length < 3) {
    throw new Error("Minimum 3 images required");
  }

  /* ===== MAIN IMAGE INDEX HANDLING ===== */

  product.mainImageIndex = resolveMainImageIndex({
    mainImageKey: data.mainImageKey,
    images: product.images || [],
    remainingImages,
    uploadedImages
  });

  if (product.mainImageIndex >= updatedImages.length) {
    product.mainImageIndex = 0;
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
