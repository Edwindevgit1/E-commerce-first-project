import {
  getCategoryService,
  addCategoryService,
  editCategoryService,
  deleteCatrgoryService,
  restoreCategoryService
} from "../../services/categoryServices.js";
const isValidationError = (error) => Boolean(error?.fieldErrors && typeof error.fieldErrors === "object");

const buildPaginationItems = (currentPage, totalPages) => {
  const startPage = Math.max(1, currentPage - 1);
  const endPage = Math.min(totalPages, currentPage + 1);
  const paginationItems = [];

  for (let page = startPage; page <= endPage; page += 1) {
    paginationItems.push(page);
  }

  return paginationItems;
};

const buildCategoryFormData = (source = {}) => ({
  name: source.name || "",
  status: source.status || "active",
  description: source.description || "",
  offerPercentage: source.offerPercentage ?? ""
});

const renderCategoryPage = async (res, options = {}) => {
  const search = options.search || "";
  const page = options.currentPage || 1;
  const limit = 5;
  const sort = options.sort || "newest";

  const { categories, totalPages, totalCategories } =
    await getCategoryService(search, page, limit, sort);

  return res.render("admin/category-management", {
    categories: categories || [],
    currentPage: page,
    totalPages,
    totalCategories,
    paginationItems: buildPaginationItems(page, totalPages || 1),
    search,
    sort,
    formError: options.formError || null,
    listError: options.listError || null,
    validationErrors: options.validationErrors || {},
    formData: options.formData || buildCategoryFormData(),
    editValidationErrors: options.editValidationErrors || {},
    editFormData: options.editFormData || null
  });
};

export const getCategoryController = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const sort = req.query.sort || "newest";

    return await renderCategoryPage(res, {
      search,
      currentPage: page,
      sort
    });
  } catch (error) {
    console.log(error, "Get category controller error");
  }
};

export const addCategoryController = async (req, res) => {
  try {
    await addCategoryService(req.body);
    return res.redirect("/api/admin/category");
  } catch (error) {
    return await renderCategoryPage(res, {
      formError: error.message,
      validationErrors: isValidationError(error) ? error.fieldErrors : {},
      formData: buildCategoryFormData(req.body)
    });
  }
};

export const editCategoryController = async (req, res) => {
  try {
    await editCategoryService(req.params.id, req.body);
    return res.redirect("/api/admin/category");
  } catch (error) {
    return await renderCategoryPage(res, {
      listError: error.message,
      editValidationErrors: isValidationError(error) ? error.fieldErrors : {},
      editFormData: {
        id: req.params.id,
        ...buildCategoryFormData(req.body)
      }
    });
  }
};

export const softdeleteCategoryController = async (req, res) => {
  try {
    await deleteCatrgoryService(req.params.id);
    return res.redirect("/api/admin/category");
  } catch (error) {
    return await renderCategoryPage(res, {
      listError: error.message
    });
  }
};

export const restoreCategoryController = async (req, res) => {
  try {
    await restoreCategoryService(req.params.id);
    return res.redirect("/api/admin/category");
  } catch (error) {
    return res.redirect("/api/admin/category");
  }
};
