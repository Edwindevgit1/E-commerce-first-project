import Category from "../../models/Category.js";
import Cart from "../../models/Cart.js";

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

  try {
    const userId = req.user?._id || req.session?.user?.id;

    if (!userId) {
      res.locals.navbarCartCount = 0;
      return next();
    }

    const cart = await Cart.findOne({ user: userId }).select("items.quantity").lean();
    res.locals.navbarCartCount = Array.isArray(cart?.items)
      ? cart.items.length
      : 0;
  } catch (error) {
    res.locals.navbarCartCount = 0;
  }

  next();
};

export default loadNavbarCategories;
