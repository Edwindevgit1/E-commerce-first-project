import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";

const PRODUCT_STATUSES = new Set(["active", "inactive"]);
const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeSearchTerm = (value = "") => String(value).trim().replace(/\s+/g, " ");
const createValidationError = (fieldErrors, message = "Please correct the highlighted fields.") => {
  const error = new Error(message);
  error.name = "AppValidationError";
  error.fieldErrors = fieldErrors;
  return error;
};

const normalizeListField = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const uniqueValues = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = String(item).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeOfferPrice = (value, basePrice, fieldKey = "offerPrice", fieldErrors = {}) => {
  const parsedValue = Number(value);

  if (value === "" || value === null || value === undefined) {
    return 0;
  }

  if (Number.isNaN(parsedValue)) {
    fieldErrors[fieldKey] = "Offer price must be a valid number.";
    return 0;
  }

  if (parsedValue < 0) {
    fieldErrors[fieldKey] = "Offer price cannot be negative.";
    return 0;
  }

  if (parsedValue > 0 && parsedValue >= Number(basePrice)) {
    fieldErrors[fieldKey] = "Offer price must be lower than the regular price.";
    return 0;
  }

  return parsedValue;
};

const resolveMainImageIndex = (mainImageKey, existingImages, remainingImages, uploadedImages) => {
  if (typeof mainImageKey === "string" && mainImageKey.length > 0) {
    if (mainImageKey.startsWith("existing:")) {
      const originalIndex = Number(mainImageKey.split(":")[1]);

      if (!Number.isNaN(originalIndex)) {
        let currentIndex = 0;

        for (let index = 0; index < existingImages.length; index += 1) {
          if (!remainingImages.includes(existingImages[index])) continue;
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

const getLegacyVariant = (product) => ({
  size: product?.sizes?.[0] || "",
  color: product?.colors?.[0] || "",
  price: Number(product?.price) || 0,
  offerPrice: Number(product?.offerPrice) || 0,
  stock: Number(product?.stock) || 0,
  images: Array.isArray(product?.images) ? product.images : [],
  imageOriginals: Array.isArray(product?.images) ? product.images : [],
  imageCropData: Array.isArray(product?.images) ? product.images.map(() => null) : [],
  mainImageIndex: Number(product?.mainImageIndex) || 0
});

export const buildProductFormValues = (source = {}) => {
  const sourceVariants = Array.isArray(source?.variants) && source.variants.length
    ? source.variants
    : source?.price !== undefined || source?.stock !== undefined || Array.isArray(source?.images)
      ? [getLegacyVariant(source)]
      : [];

  return {
    productName: source?.productName || "",
    category: String(source?.category?._id || source?.category || ""),
    status: source?.status || "active",
    couponCode: source?.couponCode || "",
    couponDescription: source?.couponDescription || "",
    description: source?.description || "",
    shippingInfo: source?.shippingInfo || "",
    highlights: Array.isArray(source?.highlights)
      ? source.highlights
      : normalizeListField(source?.highlights),
    variants: sourceVariants.map((variant) => ({
      size: variant?.size || "",
      color: variant?.color || "",
      price: variant?.price ?? "",
      offerPrice: variant?.offerPrice ?? "",
      stock: variant?.stock ?? "",
      images: Array.isArray(variant?.images)
        ? variant.images.map((image, index) => {
            if (typeof image === "string") {
              return {
                url: image,
                originalUrl: Array.isArray(variant?.imageOriginals) ? (variant.imageOriginals[index] || image) : image,
                cropData: Array.isArray(variant?.imageCropData) ? (variant.imageCropData[index] || null) : null
              };
            }

            return {
              url: image?.url || "",
              originalUrl: image?.originalUrl || image?.url || "",
              cropData: image?.cropData || null
            };
          })
        : Array.isArray(variant?.existingImages)
          ? variant.existingImages.map((image) => ({
              url: typeof image === "string" ? image : (image?.url || ""),
              originalUrl: typeof image === "string" ? image : (image?.originalUrl || image?.url || ""),
              cropData: typeof image === "string" ? null : (image?.cropData || null)
            }))
          : [],
      mainImageIndex: Number.isInteger(variant?.mainImageIndex) ? variant.mainImageIndex : 0
    }))
  };
};

const parseProductVariants = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw createValidationError({
      variants: "Variant data could not be read. Please add the variants again."
    });
  }
};

const validateProductInput = async (data = {}, existingProductId = null) => {
  const fieldErrors = {};
  const productName = String(data.productName || "").trim().replace(/\s+/g, " ");
  const category = String(data.category || "").trim();
  const status = String(data.status || "active").trim();
  const description = typeof data.description === "string"
    ? data.description.trim()
    : "";
  const shippingInfo = typeof data.shippingInfo === "string"
    ? data.shippingInfo.trim()
    : "";
  const couponCode = typeof data.couponCode === "string"
    ? data.couponCode.trim()
    : "";
  const couponDescription = typeof data.couponDescription === "string"
    ? data.couponDescription.trim()
    : "";
  const highlights = uniqueValues(normalizeListField(data.highlights));
  const variants = parseProductVariants(data.variantsPayload);

  if (!productName) {
    fieldErrors.productName = "Product name is required.";
  } else if (productName.length < 3) {
    fieldErrors.productName = "Product name must be at least 3 characters.";
  } else if (productName.length > 120) {
    fieldErrors.productName = "Product name must be 120 characters or less.";
  }

  if (!category) {
    fieldErrors.category = "Category is required.";
  } else if (!mongoose.Types.ObjectId.isValid(category)) {
    fieldErrors.category = "Select a valid category.";
  } else {
    const categoryRecord = await Category.findOne({
      _id: category,
      isDeleted: false
    }).select("_id status");

    if (!categoryRecord) {
      fieldErrors.category = "Selected category does not exist.";
    } else if (categoryRecord.status !== "active") {
      fieldErrors.category = "Selected category must be active.";
    }
  }

  if (!PRODUCT_STATUSES.has(status)) {
    fieldErrors.status = "Select a valid product status.";
  }

  if (description.length > 1200) {
    fieldErrors.description = "Description must be 1200 characters or less.";
  }

  if (shippingInfo.length > 600) {
    fieldErrors.shippingInfo = "Shipping info must be 600 characters or less.";
  }

  if (couponCode.length > 40) {
    fieldErrors.couponCode = "Coupon code must be 40 characters or less.";
  }

  if (couponDescription.length > 160) {
    fieldErrors.couponDescription = "Coupon description must be 160 characters or less.";
  }

  const duplicateNameQuery = {
    productName: { $regex: `^${escapeRegex(productName)}$`, $options: "i" }
  };

  if (existingProductId) {
    duplicateNameQuery._id = { $ne: existingProductId };
  }

  const [existingActive, existingDeleted] = productName
    ? await Promise.all([
        Product.findOne({ ...duplicateNameQuery, isDeleted: false }).select("_id"),
        Product.findOne({ ...duplicateNameQuery, isDeleted: true }).select("_id productName")
      ])
    : [null, null];

  if (existingActive) {
    fieldErrors.productName = "Product already exists.";
  }

  if (!existingProductId && existingDeleted) {
    const error = createValidationError({
      productName: "A soft-deleted product already uses this name. Restore it from the product list."
    });
    error.code = "PRODUCT_SOFT_DELETED";
    error.productId = existingDeleted._id.toString();
    error.productName = existingDeleted.productName;
    throw error;
  }

  if (!variants.length) {
    fieldErrors.variants = "Add at least one variant.";
  }

  const sanitizedVariants = [];
  const variantKeys = new Set();

  variants.forEach((variant, index) => {
    const size = String(variant?.size || "").trim();
    const color = String(variant?.color || "").trim();
    const priceValue = variant?.price;
    const stockValue = variant?.stock;
    const price = Number(priceValue);
    const stock = Number(stockValue);
    const existingImages = Array.isArray(variant?.existingImages)
      ? variant.existingImages
          .map((image) => {
            if (typeof image === "string") {
              const url = String(image || "").trim();
              return url ? { url, originalUrl: url, cropData: null } : null;
            }

            const url = String(image?.url || "").trim();
            if (!url) return null;

            return {
              url,
              originalUrl: String(image?.originalUrl || url).trim() || url,
              cropData: image?.cropData || null
            };
          })
          .filter(Boolean)
      : [];
    const removedImageIndexes = Array.isArray(variant?.removedImageIndexes)
      ? variant.removedImageIndexes
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0)
      : [];
    const variantFieldPrefix = `variants.${index}`;

    if (!size) {
      fieldErrors[`${variantFieldPrefix}.size`] = "Size is required.";
    }

    if (!color) {
      fieldErrors[`${variantFieldPrefix}.color`] = "Color is required.";
    }

    if (priceValue === "" || priceValue === null || priceValue === undefined) {
      fieldErrors[`${variantFieldPrefix}.price`] = "Price is required.";
    } else if (Number.isNaN(price) || price <= 0) {
      fieldErrors[`${variantFieldPrefix}.price`] = "Price must be greater than 0.";
    }

    if (stockValue === "" || stockValue === null || stockValue === undefined) {
      fieldErrors[`${variantFieldPrefix}.stock`] = "Stock is required.";
    } else if (!Number.isInteger(stock) || stock < 0) {
      fieldErrors[`${variantFieldPrefix}.stock`] = "Stock must be a whole number 0 or above.";
    }

    const offerPrice = normalizeOfferPrice(
      variant?.offerPrice,
      price,
      `${variantFieldPrefix}.offerPrice`,
      fieldErrors
    );

    const duplicateKey = `${size.toLowerCase()}::${color.toLowerCase()}`;
    if (size && color) {
      if (variantKeys.has(duplicateKey)) {
        fieldErrors[`${variantFieldPrefix}.size`] = "This size and color combination already exists.";
        fieldErrors[`${variantFieldPrefix}.color`] = "This size and color combination already exists.";
      } else {
        variantKeys.add(duplicateKey);
      }
    }

    sanitizedVariants.push({
      size,
      color,
      price: Number.isNaN(price) ? 0 : price,
      offerPrice,
      stock: Number.isNaN(stock) ? 0 : stock,
      existingImages,
      removedImageIndexes,
      newImagesMeta: Array.isArray(variant?.newImagesMeta)
        ? variant.newImagesMeta.map((image) => ({
            cropData: image?.cropData || null
          }))
        : [],
      mainImageKey: typeof variant?.mainImageKey === "string" ? variant.mainImageKey : "",
      uploadedFieldName: `variantImages-${index}`
    });
  });

  if (Object.keys(fieldErrors).length > 0) {
    throw createValidationError(fieldErrors);
  }

  return {
    productName,
    category,
    status,
    description,
    shippingInfo,
    couponCode,
    couponDescription,
    highlights,
    variants: sanitizedVariants
  };
};

const buildPersistedVariants = (variants, uploadedVariantImagesMap = {}) => {
  const fieldErrors = {};
  const persistedVariants = variants.map((variant, index) => {
    const existingImages = variant.existingImages || [];
    const removedIndexes = new Set(variant.removedImageIndexes || []);
    const remainingImages = existingImages.filter((_, imageIndex) => !removedIndexes.has(imageIndex));
    const uploadedImages = uploadedVariantImagesMap[variant.uploadedFieldName] || [];
    const images = [
      ...remainingImages.map((image) => image.url),
      ...uploadedImages.map((image) => image.url)
    ];
    const imageOriginals = [
      ...remainingImages.map((image) => image.originalUrl || image.url),
      ...uploadedImages.map((image) => image.originalUrl || image.url)
    ];
    const imageCropData = [
      ...remainingImages.map((image) => image.cropData || null),
      ...uploadedImages.map((image) => image.cropData || null)
    ];

    if (images.length < 3) {
      fieldErrors[`variants.${index}.images`] = "Each variant must have at least 3 images.";
    }

    const mainImageIndex = resolveMainImageIndex(
      variant.mainImageKey,
      existingImages,
      remainingImages,
      uploadedImages
    );

    return {
      size: variant.size,
      color: variant.color,
      price: variant.price,
      offerPrice: variant.offerPrice,
      stock: variant.stock,
      images,
      imageOriginals,
      imageCropData,
      mainImageIndex: mainImageIndex >= images.length ? 0 : mainImageIndex
    };
  });

  if (Object.keys(fieldErrors).length > 0) {
    throw createValidationError(fieldErrors);
  }

  return persistedVariants;
};

const deriveProductFieldsFromVariants = (variants) => {
  const representativeVariant = variants[0];

  return {
    price: representativeVariant.price,
    offerPrice: representativeVariant.offerPrice,
    stock: variants.reduce((sum, variant) => sum + variant.stock, 0),
    sizes: uniqueValues(variants.map((variant) => variant.size)),
    colors: uniqueValues(variants.map((variant) => variant.color)),
    images: representativeVariant.images,
    mainImageIndex: representativeVariant.mainImageIndex ?? 0
  };
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

export const addProductService = async (data, uploadedVariantImagesMap = {}) => {
  const validatedData = await validateProductInput(data);
  const persistedVariants = buildPersistedVariants(validatedData.variants, uploadedVariantImagesMap);
  const derivedFields = deriveProductFieldsFromVariants(persistedVariants);

  const product = new Product({
    productName: validatedData.productName,
    category: validatedData.category,
    status: validatedData.status,
    description: validatedData.description,
    shippingInfo: validatedData.shippingInfo,
    couponCode: validatedData.couponCode,
    couponDescription: validatedData.couponDescription,
    highlights: validatedData.highlights,
    variants: persistedVariants,
    ...derivedFields
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

export const editProductService = async (id, data, uploadedVariantImagesMap = {}) => {
  const product = await Product.findById(id);

  if (!product || product.isDeleted) {
    throw new Error("Product not found");
  }

  const validatedData = await validateProductInput(data, id);
  const persistedVariants = buildPersistedVariants(validatedData.variants, uploadedVariantImagesMap);
  const derivedFields = deriveProductFieldsFromVariants(persistedVariants);

  product.productName = validatedData.productName;
  product.category = validatedData.category;
  product.status = validatedData.status;
  product.description = validatedData.description;
  product.shippingInfo = validatedData.shippingInfo;
  product.couponCode = validatedData.couponCode;
  product.couponDescription = validatedData.couponDescription;
  product.highlights = validatedData.highlights;
  product.variants = persistedVariants;
  product.price = derivedFields.price;
  product.offerPrice = derivedFields.offerPrice;
  product.stock = derivedFields.stock;
  product.sizes = derivedFields.sizes;
  product.colors = derivedFields.colors;
  product.images = derivedFields.images;
  product.mainImageIndex = derivedFields.mainImageIndex;

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
