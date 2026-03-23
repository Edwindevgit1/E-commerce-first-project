import sharp from "sharp";
import cloudinary from "../../config/cloudinary.js";
import Category from "../../models/Category.js";
import Product from "../../models/Product.js";

import {
  getProductService,
  addProductService,
  getProductByIdService,
  editProductService,
  deleteProductService
} from "../../services/productServices.js";


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

const normalizeColorList = (items = []) => {
  const seen = new Set();

  return items
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1).toLowerCase())
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.localeCompare(right));
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeSearchTerm = (value = "") => String(value).trim().replace(/\s+/g, " ");

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

export const addProductController = async (req, res) => {
  try {

    const files = req.files || [];

    if (files.length < 3) {
      throw new Error("Minimum 3 images required");
    }

    const uploadPromises = files.map(async (file) => {

      const processedBuffer = await processProductImage(file);

      return await new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
          { folder: "products" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          }
        );

        stream.end(processedBuffer);

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

export const editProductController = async (req, res) => {
  try {

    const removeImages = req.body.removeImages
      ? req.body.removeImages.split(",").map(Number)
      : [];

    let newImages = [];

    if (req.files && req.files.length > 0) {

      const uploadPromises = req.files.map(async (file) => {

        const processedBuffer = await processProductImage(file);

        return await new Promise((resolve, reject) => {

          const stream = cloudinary.uploader.upload_stream(
            { folder: "products" },
            (error, result) => {
              if (error) return reject(error);
              resolve(result.secure_url);
            }
          );

          stream.end(processedBuffer);

        });

      });

      newImages = await Promise.all(uploadPromises);

    }

    await editProductService(req.params.id, {
      ...req.body,
      newImages,
      removeImages
    });

    res.redirect("/api/admin/products");

  } catch (error) {

    console.log(error, "Edit product error");

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

export const deleteProductController = async (req, res) => {
  try {

    await deleteProductService(req.params.id);
    res.redirect("/api/admin/products");

  } catch (error) {

    console.log(error, "Delete product error");
    res.redirect("/api/admin/products");

  }
};
export const getSortStage = (sort)=>{
  switch(sort){
    case "price_asc":
      return {offerPrice:1,price:1};
    case "price_desc":
      return {offerPrice:-1,price:-1};
    case "az":
      return {productName:1};
    case "za":
      return {productName:-1};
    default:
      return {createdAt:-1};
  }
};

export const getProductListingPage = async (req,res)=>{
  try{
    const page = Number(req.query.page) || 1;
    const limit = 6;
    const skip = (page-1)*limit;

    const search = normalizeSearchTerm(req.query.search || "");
    const category = req.query.category || "";
    const priceRange = req.query.priceRange || "";
    const sort = req.query.sort || "";
    const size = req.query.size || "";
    const color = req.query.color || "";
    const andConditions = [];
    const query = {
      isDeleted:false,
      isBlocked:false,
      status:"active"
    };
    if(search){
      const searchPattern = search
        .split(" ")
        .map((term) => escapeRegex(term))
        .join("\\s+");

      query.productName = {$regex:searchPattern, $options:"i"};
    }
    if(category){
      query.category=category;
    }
    if (size) {
      andConditions.push({
        $or: [
          { sizes: size },
          { "variants.size": size }
        ]
      });
    }
    if (color) {
      const colorPattern = new RegExp(`^${escapeRegex(String(color).trim())}$`, "i");
      andConditions.push({
        $or: [
          { colors: colorPattern },
          { "variants.color": colorPattern }
        ]
      });
    }
    if (priceRange) {
      const [min, max] = priceRange.split("-").map(Number);
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        andConditions.push({
          $expr: {
            $and: [
              {
                $gte: [
                  { $cond: [{ $gt: ["$offerPrice", 0] }, "$offerPrice", "$price"] },
                  min
                ]
              },
              {
                $lte: [
                  { $cond: [{ $gt: ["$offerPrice", 0] }, "$offerPrice", "$price"] },
                  max
                ]
              }
            ]
          }
        });
      }
    }
    if (andConditions.length) {
      query.$and = andConditions;
    }
    const baseQuery = {
      isDeleted:false,
      isBlocked:false,
      status:"active"
    };
    const [products,totalProducts,categories,sizeOptions,colorOptions,variantSizeOptions,variantColorOptions] = await Promise.all([
      Product.find(query)
      .populate("category")
      .sort(getSortStage(sort))
      .skip(skip)
      .limit(limit),
      Product.countDocuments(query),
      Category.find({isDeleted:false,status:"active"}).sort({name:1}),
      Product.distinct("sizes", baseQuery),
      Product.distinct("colors", baseQuery),
      Product.distinct("variants.size", baseQuery),
      Product.distinct("variants.color", baseQuery)
    ]);
    const viewData = {
      products,
      categories,
      sizeOptions: [...new Set([...(sizeOptions || []), ...(variantSizeOptions || [])])]
        .filter(Boolean)
        .sort((left, right) => Number(left) - Number(right)),
      colorOptions: normalizeColorList([...(colorOptions || []), ...(variantColorOptions || [])]),
      search,
      category,
      priceRange,
      sort,
      size,
      color,
      currentPage:page,
      totalPages:Math.ceil(totalProducts/limit)
    };

    if (req.query.partial === "1") {
      return res.render("user/partials/product-listing-content", viewData);
    }

    res.render("user/product-listing", viewData)
  }catch(error){
    console.log(error,'product listing page error')
  }
}

export const getProductDetailsPage = async (req,res)=>{
  try{
    const product = await Product.findOne({
      _id:req.params.id,
      isDeleted:false,
      isBlocked:false,
      status:"active"
    }).populate("category");

    if(!product){
      return res.redirect("/api/user/products")
    }
    const relatedProducts = await Product.find({
      _id:{$ne:product._id},
      category:product.category?._id,
      isDeleted:false,
      isBlocked:false,
      status:"active"
    })
    .limit(4)
    .sort({createdAt:-1});

    const hasStock = product.stock>0;
    const availableVariants = (product.variants || []).filter((variant)=>variant.stock > 0);
    const displaySizes = [...new Set([
      ...(product.sizes || []),
      ...availableVariants.map((variant) => variant.size)
    ])].filter(Boolean);
    const displayColors = normalizeColorList([
      ...(product.colors || []),
      ...availableVariants.map((variant) => variant.color)
    ]);

    res.render("user/product-detail",{
      product,
      relatedProducts,
      hasStock,
      availableVariants,
      displaySizes,
      displayColors
    })
  }catch(error){
    console.log(error,'product details error')
    res.redirect("/api/user/products");
  }
}
