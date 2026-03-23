import Category from "../../models/Category.js";

const loadNavbarCategories = async (req, res, next) => {
  try {
    const navbarCategories = await Category.find({
      isDeleted: false,
      status: "active"
    }).sort({ name: 1 });

    res.locals.navbarCategories = navbarCategories;
  } catch (error) {
    res.locals.navbarCategories = [];
  }

  next();
};

export default loadNavbarCategories;
