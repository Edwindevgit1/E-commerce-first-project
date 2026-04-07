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

const processProductImage = async (file) => {
  const metadata = await sharp(file.buffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image file");
  }

  return await sharp(file.buffer)
    .resize(800, 800, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toBuffer();
};

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

const processVariantUploads = async (files = []) => {
  const groupedUploads = {};

  await Promise.all(
    files.map(async (file) => {
      if (!file.fieldname.startsWith("variantImages-")) return;

      const processedBuffer = await processProductImage(file);
      const imageUrl = await uploadImageBuffer(processedBuffer);

      if (!groupedUploads[file.fieldname]) {
        groupedUploads[file.fieldname] = [];
      }

      groupedUploads[file.fieldname].push(imageUrl);
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
    const currentPage = Math.max(1, Number(req.query.page) || 1);
    const limit = 5;

    const { products, categories, totalPages, totalProducts } = await getProductService(
      search,
      selectedCategory,
      selectedStatus,
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
    const uploadedVariantImagesMap = await processVariantUploads(req.files || []);
    await addProductService(req.body, uploadedVariantImagesMap);

    res.redirect("/api/admin/products");
  } catch (error) {
    console.log(error, "Add product controller error");

    if (error.code === "PRODUCT_SOFT_DELETED") {
      const search = "";
      const selectedCategory = "";
      const selectedStatus = "";
      const currentPage = 1;
      const limit = 5;

      const { products, categories, totalPages, totalProducts } = await getProductService(
        search,
        selectedCategory,
        selectedStatus,
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
    const uploadedVariantImagesMap = await processVariantUploads(req.files || []);
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
