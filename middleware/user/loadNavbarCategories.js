import Category from "../../models/Category.js";
import Cart from "../../models/Cart.js";
import Wishlist from "../../models/Wishlist.js";

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
      res.locals.navbarWishlistCount = 0;
      return next();
    }

    const [cart, wishlist] = await Promise.all([
      Cart.findOne({ user: userId }).select("items.quantity").lean(),
      Wishlist.findOne({ user: userId }).select("products").lean()
    ]);
    res.locals.navbarCartCount = Array.isArray(cart?.items)
      ? cart.items.length
      : 0;
    res.locals.navbarWishlistCount = Array.isArray(wishlist?.products)
      ? wishlist.products.length
      : 0;
  } catch (error) {
    res.locals.navbarCartCount = 0;
    res.locals.navbarWishlistCount = 0;
  }

  next();
};

export default loadNavbarCategories;
