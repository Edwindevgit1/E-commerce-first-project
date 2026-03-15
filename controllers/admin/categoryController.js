import { getCategoryService ,addCategoryService, editCategoryService, deleteCatrgoryService } from "../../services/categoryServices.js";

export const getCategoryController = async (req,res)=>{
  try{
      const search = req.query.search || "";
      const page = parseInt(req.query.page) || 1;
      const limit = 5;
      const sort = req.query.sort || "newest"

      const {categories,totalPages,totalCategories} = await getCategoryService(search,page,limit,sort)

      res.render("admin/category-management",{
        categories: categories || [],
        currentPage:page,
        totalPages,
        totalCategories,
        search,
        sort,
        error:null
      })

  }catch(error){
    console.log(error,'Get category controller error')
  }
}

export const addCategoryController = async (req,res)=>{
  try{
    await addCategoryService(req.body)
    res.redirect("/api/admin/category")
  }catch(error){
    const { categories, totalPages, totalCategories } = await getCategoryService("", 1, 5, "newest")
    res.render('admin/category-management',{
      categories: categories || [],
      currentPage:1,
      totalPages,
      totalCategories,
      search:"",
      sort:"newest",
      error:error.message
    })
  }
}

export const editCategoryController = async (req,res)=>{
  try{
    await editCategoryService(req.params.id,req.body);
    res.redirect('/api/admin/category')
  }catch(error){
    const { categories, totalPages, totalCategories } = await getCategoryService("", 1, 5, "newest")
    res.render('admin/category-management',{
      categories: categories || [],
      currentPage:1,
      totalPages,
      totalCategories,
      search:"",
      sort:"newest",
      error:error.message
    })
  }
}
export const softdeleteCategoryController = async (req,res)=>{
  try{
    await deleteCatrgoryService(req.params.id)
    res.redirect('/api/admin/category')
  }catch(error){
    const { categories, totalPages, totalCategories } = await getCategoryService("", 1, 5, "newest")
    return res.render("admin/category-management",{
      categories: categories || [],
      currentPage:1,
      totalPages,
      totalCategories,
      search:"",
      sort:"newest",
      error:error.message
    })
  }
}
