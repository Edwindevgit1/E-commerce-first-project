import Category from "../models/Category.js";
import Product from "../models/Product.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeSearchTerm = (value = "") => String(value).trim().replace(/\s+/g, " ");
const CATEGORY_STATUSES = new Set(["active", "inactive"]);
const createValidationError = (fieldErrors, message = "Please correct the highlighted fields.") => {
  const error = new Error(message);
  error.name = "AppValidationError";
  error.fieldErrors = fieldErrors;
  return error;
};

const validateCategoryInput = (data = {}) => {
  const fieldErrors = {};
  const name = String(data.name || "").trim().replace(/\s+/g, " ");
  const description = typeof data.description === "string"
    ? data.description.trim()
    : "";
  const status = String(data.status || "active").trim();
  const rawOfferPercentage = data.offerPercentage;

  if (!name) {
    fieldErrors.name = "Category name is required.";
  } else if (name.length < 2) {
    fieldErrors.name = "Category name must be at least 2 characters.";
  } else if (name.length > 60) {
    fieldErrors.name = "Category name must be 60 characters or less.";
  }

  if (!CATEGORY_STATUSES.has(status)) {
    fieldErrors.status = "Select a valid category status.";
  }

  if (description.length > 240) {
    fieldErrors.description = "Description must be 240 characters or less.";
  }

  let normalizedOfferPercentage = 0;

  if (rawOfferPercentage !== "" && rawOfferPercentage !== null && rawOfferPercentage !== undefined) {
    const offerPercentage = Number(rawOfferPercentage);

    if (Number.isNaN(offerPercentage)) {
      fieldErrors.offerPercentage = "Category offer must be a number.";
    } else if (offerPercentage < 0 || offerPercentage > 90) {
      fieldErrors.offerPercentage = "Category offer must be between 0 and 90.";
    } else {
      normalizedOfferPercentage = offerPercentage;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw createValidationError(fieldErrors);
  }

  return {
    name,
    status,
    description,
    offerPercentage: normalizedOfferPercentage
  };
};

const normalizeOfferPercentage = (value) => {
  const offerPercentage = Number(value);

  if (Number.isNaN(offerPercentage)) {
    return 0;
  }

  if (offerPercentage < 0 || offerPercentage > 90) {
    throw new Error("Category offer must be between 0 and 90");
  }

  return offerPercentage;
};

const ensureCategoryHasNoProducts = async (categoryId) => {
  const linkedProductsCount = await Product.countDocuments({
    category: categoryId
  });

  if (linkedProductsCount > 0) {
    throw new Error("This category has products. Remove or reassign them before deleting.");
  }
};

export const getCategoryService = async (search,page,limit,sort) => {
  const query = {};
  const normalizedSearch = normalizeSearchTerm(search);
  if(normalizedSearch){
    const searchPattern = normalizedSearch
      .split(" ")
      .map((term) => escapeRegex(term))
      .join("\\s+");

    query.name = { $regex: searchPattern, $options: "i" };
  }
  const totalCategories = await Category.countDocuments(query)
  let sortOption = { createdAt: -1 };

  if (sort === "oldest") {
    sortOption = { createdAt: 1 };
  } else if (sort === "az") {
    sortOption = { name: 1 };
  } else if (sort === "za") {
    sortOption = { name: -1 };
  }

  const categories = await Category
    .find(query)
    .sort(sortOption)
    .skip((page - 1) * limit)
    .limit(limit)
    const totalPages = Math.ceil(totalCategories / limit);
  return {categories , totalPages ,totalCategories};
}
export const addCategoryService = async (data) => {
  const validatedData = validateCategoryInput(data);
  const name = validatedData.name;

  const existingActive = await Category.findOne({
    name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    isDeleted: false
  });

  if (existingActive) {
    throw new Error("Category already exists");
  }
  const existingDeleted = await Category.findOne({
    name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    isDeleted: true
  });
  if (existingDeleted) {
    const error = new Error("This category already exists in soft deleted state. Restore it from the category list.");
    throw error;
  }

  const category = new Category({
    name,
    status: validatedData.status,
    description: validatedData.description,
    offerPercentage: normalizeOfferPercentage(validatedData.offerPercentage),
    isDeleted:false
  });
  return category.save();
};
export const editCategoryService = async (id,data)=>{
  const validatedData = validateCategoryInput(data);
  const name = validatedData.name;
  const category = await Category.findById(id);
  if(!category || category.isDeleted){
    throw new Error("Category not found");
  }
  const existing = await Category.findOne({
    _id:{$ne:id},
    name: { $regex: `^${name}$`, $options: "i" },
    isDeleted:false
  })
  if(existing){
    throw new Error("Category is already exists")
  }
  category.name = name;
  category.status = validatedData.status || category.status;
  category.description = validatedData.description;
  category.offerPercentage = normalizeOfferPercentage(validatedData.offerPercentage);

  return await category.save()
}

export const deleteCatrgoryService = async (id)=>{
  const category = await Category.findById(id);

  if(!category || category.isDeleted){
    throw new Error ("Category not found")
  }

  category.isDeleted = true;
  return await category.save()
}
export const restoreCategoryService = async (id) => {
  const category = await Category.findById(id);
  if(!category){
    throw new Error("Category not found")
  }
  category.isDeleted=false;
  category.status="active";
  return await category.save();
}

export const permanentDeleteCategoryService = async (id) => {
  const category = await Category.findById(id);

  if (!category) {
    throw new Error("Category not found");
  }

  await ensureCategoryHasNoProducts(id);

  await Category.findByIdAndDelete(id);
};
