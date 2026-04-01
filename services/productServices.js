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

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeSearchTerm = (value = "") => String(value).trim().replace(/\s+/g, " ");

const normalizeOfferPrice = (value, basePrice) => {
  const parsedValue = Number(value);

  if (value === "" || value === null || value === undefined || Number.isNaN(parsedValue)) {
    return 0;
  }

  if (parsedValue < 0) {
    throw new Error("Offer price cannot be negative");
  }

  if (parsedValue > 0 && parsedValue >= Number(basePrice)) {
    throw new Error("Offer price must be lower than the regular price");
  }

  return parsedValue;
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

export const getProductService = async (search, category, status, page = 1, limit = 10) => {

  const query = {};
  const normalizedSearch = normalizeSearchTerm(search);

  if (normalizedSearch) {
    const searchPattern = normalizedSearch
      .split(" ")
      .map((term) => escapeRegex(term))
      .join("\\s+");

    query.productName = {
      $regex: searchPattern,
      $options: "i"
    };
  }

  if (category) {
    query.category = category;
  }

  if (status === "soft_deleted") {
    query.isDeleted = true;
  } else if (status) {
    query.isDeleted = false;
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

export const addProductService = async (data) => {

  const {
    productName,
    category,
    price,
    stock,
    status,
    description,
    shippingInfo,
    offerPrice,
    couponCode,
    couponDescription,
    sizes,
    colors,
    highlights,
    images,
    mainImageKey
  } = data;

  if (!productName || !category || price === undefined || stock === undefined) {
    throw new Error("Required fields missing");
  }

  const normalizedProductName = String(productName).trim();

  const existingActive = await Product.findOne({
    productName: { $regex: `^${escapeRegex(normalizedProductName)}$`, $options: "i" },
    isDeleted: false
  });

  if (existingActive) {
    throw new Error("Product already exists");
  }

  const existingDeleted = await Product.findOne({
    productName: { $regex: `^${escapeRegex(normalizedProductName)}$`, $options: "i" },
    isDeleted: true
  });

  if (existingDeleted) {
    const error = new Error("Product exists in deleted state");
    error.code = "PRODUCT_SOFT_DELETED";
    error.productId = existingDeleted._id.toString();
    error.productName = existingDeleted.productName;
    throw error;
  }

  if (!images || images.length < 3) {
    throw new Error("Minimum 3 images required");
  }

  const product = new Product({
    productName: normalizedProductName,
    category,
    price,
    stock,
    offerPrice: normalizeOfferPrice(offerPrice, price),
    sizes: parseListField(sizes),
    colors: parseListField(colors),
    highlights: parseListField(highlights),
    status,
    description,
    shippingInfo: shippingInfo || "",
    couponCode: couponCode?.trim() || "",
    couponDescription: couponDescription?.trim() || "",
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

export const getProductByIdService = async (id) => {

  const product = await Product
    .findById(id)
    .populate("category");

  if (!product || product.isDeleted) {
    throw new Error("Product not found");
  }

  return product;

};

export const editProductService = async (id, data) => {

  const product = await Product.findById(id);

  if (!product || product.isDeleted) {
    throw new Error("Product not found");
  }

  if (data.productName) product.productName = data.productName;
  if (data.category) product.category = data.category;

  if (data.price !== undefined) product.price = data.price;
  if (data.stock !== undefined) product.stock = data.stock;
  product.offerPrice = normalizeOfferPrice(data.offerPrice, data.price ?? product.price);

  product.sizes = parseListField(data.sizes);
  product.colors = parseListField(data.colors);
  product.highlights = parseListField(data.highlights);

  if (data.status) product.status = data.status;
  product.description = data.description || "";
  product.shippingInfo = data.shippingInfo || "";
  product.couponCode = data.couponCode?.trim() || "";
  product.couponDescription = data.couponDescription?.trim() || "";


  /* ===== IMAGE MANAGEMENT ===== */

  const removeIndexes = Array.isArray(data.removeImages) ? data.removeImages : [];

  const remainingImages = (product.images || []).filter(
    (_, index) => !removeIndexes.includes(index)
  );

  const uploadedImages = Array.isArray(data.newImages) ? data.newImages : [];

  const updatedImages = [...remainingImages, ...uploadedImages];

  

  if (updatedImages.length < 3) {
    throw new Error("Minimum 3 images required");
  }


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


export const deleteProductService = async (id) => {

  const product = await Product.findById(id);

  if (!product || product.isDeleted) {
    throw new Error("Product not found");
  }

  product.isDeleted = true;

  return await product.save();

};

export const restoreProductService = async (id) => {
  const product = await Product.findById(id);

  if (!product) {
    throw new Error("Product not found");
  }

  product.isDeleted = false;
  product.status = "active";

  return await product.save();
};

export const permanentDeleteProductService = async (id) => {
  const product = await Product.findById(id);

  if (!product) {
    throw new Error("Product not found");
  }

  await Product.findByIdAndDelete(id);
};
