import Category from "../models/Category.js";
import Product from "../models/Product.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeSearchTerm = (value = "") => String(value).trim().replace(/\s+/g, " ");

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

  const name = data.name?.trim();

  if (!name) {
    throw new Error("Name is required");
  }

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
    name: name,
    status: data.status,
    description: data.description,
    offerPercentage: normalizeOfferPercentage(data.offerPercentage),
    isDeleted:false
  });
  return category.save();
};
export const editCategoryService = async (id,data)=>{
  const name = data.name?.trim()
  if(!name){
    throw new Error("Category name is required");
  }
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
  category.status = data.status || category.status;
  category.description = typeof data.description === "string"
    ? data.description.trim()
    : "";
  category.offerPercentage = normalizeOfferPercentage(data.offerPercentage);

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
