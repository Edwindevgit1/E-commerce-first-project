import sharp from "sharp";
import cloudinary from "../../config/cloudinary.js";
import Category from "../../models/Category.js";
import {
  getProductService,
  addProductService,
  getProductByIdService,
  editProductService,
  deleteProductService,
  restoreProductService,
  permanentDeleteProductService,
  buildProductFormValues
} from "../../services/productServices.js";
const isValidationError = (error) => Boolean(error?.fieldErrors && typeof error.fieldErrors === "object");
const getUploadErrorMessage = (error) => {
  if (!error) return null;
  if (error.code === "INVALID_FILE_TYPE") {
    return error.message;
  }
  return "Unable to upload the selected file. Only JPG and PNG images are allowed.";
};

const normalizeCropData = (cropData = {}, metadata = {}) => {
  const width = Number(cropData?.width);
  const height = Number(cropData?.height);
  const left = Number(cropData?.x);
  const top = Number(cropData?.y);

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  const maxWidth = Number(metadata.width) || 0;
  const maxHeight = Number(metadata.height) || 0;
  if (!maxWidth || !maxHeight) return null;

  const boundedLeft = Math.max(0, Math.min(Math.round(left), maxWidth - 1));
  const boundedTop = Math.max(0, Math.min(Math.round(top), maxHeight - 1));
  const boundedWidth = Math.max(1, Math.min(Math.round(width), maxWidth - boundedLeft));
  const boundedHeight = Math.max(1, Math.min(Math.round(height), maxHeight - boundedTop));

  return {
    left: boundedLeft,
    top: boundedTop,
    width: boundedWidth,
    height: boundedHeight
  };
};

const processProductImage = async (file, cropData = null) => {
  const metadata = await sharp(file.buffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image file");
  }

  let pipeline = sharp(file.buffer);
  const normalizedCrop = normalizeCropData(cropData, metadata);

  if (normalizedCrop) {
    pipeline = pipeline.extract(normalizedCrop);
  }

  return await pipeline
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
};

const processOriginalProductImage = async (file) =>
  await sharp(file.buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

const uploadImageBuffer = async (buffer) =>
  await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "products" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );

    stream.end(buffer);
  });

const processVariantUploads = async (files = [], variantsPayload = []) => {
  const groupedUploads = {};
  const uploadCounters = {};

  await Promise.all(
    files.map(async (file) => {
      if (!file.fieldname.startsWith("variantImages-")) return;

      const variantIndex = Number(file.fieldname.split("variantImages-")[1]);
      const uploadIndex = uploadCounters[file.fieldname] || 0;
      uploadCounters[file.fieldname] = uploadIndex + 1;

      const cropData = variantsPayload?.[variantIndex]?.newImagesMeta?.[uploadIndex]?.cropData || null;
      const [processedBuffer, originalBuffer] = await Promise.all([
        processProductImage(file, cropData),
        processOriginalProductImage(file)
      ]);
      const [imageUrl, originalUrl] = await Promise.all([
        uploadImageBuffer(processedBuffer),
        uploadImageBuffer(originalBuffer)
      ]);

      if (!groupedUploads[file.fieldname]) {
        groupedUploads[file.fieldname] = [];
      }

      groupedUploads[file.fieldname].push({
        url: imageUrl,
        originalUrl,
        cropData
      });
    })
  );

  return groupedUploads;
};

const buildPaginationItems = (currentPage, totalPages) => {
  const startPage = Math.max(1, currentPage - 1);
  const endPage = Math.min(totalPages, currentPage + 1);
  const paginationItems = [];

  for (let page = startPage; page <= endPage; page += 1) {
    paginationItems.push(page);
  }

  return paginationItems;
};

const safeParseVariantsPayload = (value) => {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const renderProductForm = async (res, options) => {
  const categories = await Category.find({ isDeleted: false, status: "active" });

  return res.render("admin/add-edit-product-management", {
    pageTitle: options.pageTitle,
    formTitle: options.formTitle,
    formAction: options.formAction,
    submitLabel: options.submitLabel,
    categories,
    product: options.product || null,
    formData: options.formData || buildProductFormValues(options.product),
    error: options.error || null,
    validationErrors: options.validationErrors || {}
  });
};

export const getProductController = async (req, res) => {
  try {
    const search = req.query.search || "";
    const selectedCategory = req.query.category || "";
    const selectedStatus = req.query.status || "";
    const selectedStock = req.query.stock || "";
    const currentPage = Math.max(1, Number(req.query.page) || 1);
    const limit = 5;

    const { products, categories, totalPages, totalProducts } = await getProductService(
      search,
      selectedCategory,
      selectedStatus,
      selectedStock,
      currentPage,
      limit
    );

    res.render("admin/product-management", {
      products: products || [],
      categories: categories || [],
      totalProducts: totalProducts || 0,
      totalPages: totalPages || 1,
      search,
      selectedCategory,
      selectedStatus,
      selectedStock,
      currentPage,
      limit,
      paginationItems: buildPaginationItems(currentPage, totalPages || 1),
      error: null,
      restorePrompt: null
    });
  } catch (error) {
    console.log(error, "Product page error");

    res.render("admin/product-management", {
      products: [],
      categories: [],
      totalProducts: 0,
      totalPages: 1,
      search: "",
      selectedCategory: "",
      selectedStatus: "",
      selectedStock: "",
      currentPage: 1,
      limit: 5,
      paginationItems: [1],
      error: "Failed to load products",
      restorePrompt: null
    });
  }
};

export const getAddProductPage = async (req, res) => {
  try {
    await renderProductForm(res, {
      pageTitle: "Add Product",
      formTitle: "Add Product",
      formAction: "/api/admin/add-product",
      submitLabel: "Save Product",
      product: null,
      formData: buildProductFormValues()
    });
  } catch (error) {
    console.log(error, "Add product page error");
  }
};

export const addProductController = async (req, res) => {
  try {
    if (req.uploadError) {
      return await renderProductForm(res, {
        pageTitle: "Add Product",
        formTitle: "Add Product",
        formAction: "/api/admin/add-product",
        submitLabel: "Save Product",
        product: null,
        formData: buildProductFormValues({
          ...req.body,
          variants: safeParseVariantsPayload(req.body.variantsPayload)
        }),
        error: getUploadErrorMessage(req.uploadError),
        validationErrors: {}
      });
    }

    const parsedVariantsPayload = safeParseVariantsPayload(req.body.variantsPayload);
    const uploadedVariantImagesMap = await processVariantUploads(req.files || [], parsedVariantsPayload);
    await addProductService(req.body, uploadedVariantImagesMap);

    res.redirect("/api/admin/products");
  } catch (error) {
    console.log(error, "Add product controller error");

    if (error.code === "PRODUCT_SOFT_DELETED") {
      const search = "";
      const selectedCategory = "";
      const selectedStatus = "";
      const selectedStock = "";
      const currentPage = 1;
      const limit = 5;

      const { products, categories, totalPages, totalProducts } = await getProductService(
        search,
        selectedCategory,
        selectedStatus,
        selectedStock,
        currentPage,
        limit
      );

      return res.render("admin/product-management", {
        products: products || [],
        categories: categories || [],
        totalProducts: totalProducts || 0,
        totalPages: totalPages || 1,
        search,
        selectedCategory,
        selectedStatus,
        selectedStock,
        currentPage,
        limit,
        paginationItems: buildPaginationItems(currentPage, totalPages || 1),
        error: null,
        restorePrompt: {
          id: error.productId,
          name: error.productName
        }
      });
    }

    return await renderProductForm(res, {
      pageTitle: "Add Product",
      formTitle: "Add Product",
      formAction: "/api/admin/add-product",
      submitLabel: "Save Product",
      product: null,
      formData: buildProductFormValues({
        ...req.body,
        variants: safeParseVariantsPayload(req.body.variantsPayload)
      }),
      error: error.message,
      validationErrors: isValidationError(error) ? error.fieldErrors : {}
    });
  }
};

export const getEditProductPage = async (req, res) => {
  try {
    const product = await getProductByIdService(req.params.id);

    await renderProductForm(res, {
      pageTitle: "Edit Product",
      formTitle: "Edit Product",
      formAction: `/api/admin/edit-product/${product._id}`,
      submitLabel: "Update Product",
      product,
      formData: buildProductFormValues(product)
    });
  } catch (error) {
    console.log(error, "Edit product page error");
    res.redirect("/api/admin/products");
  }
};

export const editProductController = async (req, res) => {
  try {
    if (req.uploadError) {
      const product = await getProductByIdService(req.params.id);

      return await renderProductForm(res, {
        pageTitle: "Edit Product",
        formTitle: "Edit Product",
        formAction: `/api/admin/edit-product/${req.params.id}`,
        submitLabel: "Update Product",
        product,
        formData: buildProductFormValues({
          ...product.toObject(),
          ...req.body,
          variants: safeParseVariantsPayload(req.body.variantsPayload)
        }),
        error: getUploadErrorMessage(req.uploadError),
        validationErrors: {}
      });
    }

    const parsedVariantsPayload = safeParseVariantsPayload(req.body.variantsPayload);
    const uploadedVariantImagesMap = await processVariantUploads(req.files || [], parsedVariantsPayload);
    await editProductService(req.params.id, req.body, uploadedVariantImagesMap);

    res.redirect("/api/admin/products");
  } catch (error) {
    console.log(error, "Edit product error");

    const product = await getProductByIdService(req.params.id);

    return await renderProductForm(res, {
      pageTitle: "Edit Product",
      formTitle: "Edit Product",
      formAction: `/api/admin/edit-product/${req.params.id}`,
      submitLabel: "Update Product",
      product,
      formData: buildProductFormValues({
        ...product.toObject(),
        ...req.body,
        variants: safeParseVariantsPayload(req.body.variantsPayload)
      }),
      error: error.message,
      validationErrors: isValidationError(error) ? error.fieldErrors : {}
    });
  }
};

export const deleteProductController = async (req, res) => {
  try {
    await deleteProductService(req.params.id);
    res.redirect("/api/admin/products");
  } catch (error) {
    console.log(error, "Delete product error");
    res.redirect("/api/admin/products");
  }
};

export const restoreProductController = async (req, res) => {
  try {
    await restoreProductService(req.params.id);
    res.redirect("/api/admin/products");
  } catch (error) {
    console.log(error, "Restore product error");
    res.redirect("/api/admin/products");
  }
};

export const permanentDeleteProductController = async (req, res) => {
  try {
    await permanentDeleteProductService(req.params.id);
    res.redirect("/api/admin/products");
  } catch (error) {
    console.log(error, "Permanent delete product error");
    res.redirect("/api/admin/products");
  }
};
