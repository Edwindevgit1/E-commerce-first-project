import Category from "../models/Category.js";

export const getCategoryService = async (search,page,limit,sort) => {
  const query = {isDeleted:false};
  if(search){
    query.name = { $regex: search, $options: "i" };
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

export const addCategoryService = async(data)=>{
  const existing = await Category.findOne({
   name: { $regex: `^${data.name}$`, $options: "i" }
  })
  if(!data.name){
    throw new Error("Name is required")
  }
  if(existing){
    throw new Error("Category already exists")
  }
  const category = new Category({
    name:data.name,
    status:data.status,
    description:data.description
  })
  return category.save()
}

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
  category.description=data.description || category.description;

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
