import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { getEffectiveProductPricing } from "../utils/pricing.js";

const isActiveCategory = (category) =>
  Boolean(category) && category.isDeleted !== true && category.status === "active";

const getProductImage = (product) => {
  const mainImageIndex = Number(product?.mainImageIndex) || 0;

  return (
    product?.images?.[mainImageIndex] ||
    product?.images?.[0] ||
    "https://placehold.co/500x360?text=Product"
  );
};

const normalizeProductCard = (product) => {
  const pricing = getEffectiveProductPricing(product);

  return {
    _id: product._id,
    productName: product.productName,
    categoryName: product.category?.name || "Product",
    image: getProductImage(product),
    price: pricing.effectivePrice,
    originalPrice: pricing.basePrice,
    hasDiscount: pricing.hasDiscount,
    discountSource: pricing.discountSource,
    categoryOfferPercentage: pricing.categoryOfferPercentage
  };
};

const filterVisibleProducts = (products = []) =>
  products.filter((product) => isActiveCategory(product.category));

export const loadHome = async (req, res) => {
  try {
    const activeCategoryQuery = {
      isDeleted: false,
      status: "active"
    };
    const activeProductQuery = {
      isDeleted: false,
      isBlocked: false,
      status: "active"
    };

    const [categories, activeCategoryIds, offerCategoryIds] = await Promise.all([
      Category
        .find(activeCategoryQuery)
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      Category.distinct("_id", activeCategoryQuery),
      Category.distinct("_id", {
        ...activeCategoryQuery,
        offerPercentage: { $gt: 0 }
      })
    ]);

    const visibleProductQuery = {
      ...activeProductQuery,
      category: { $in: activeCategoryIds }
    };

    const [latestProductsRaw, offerProductsRaw] = await Promise.all([
      Product
        .find(visibleProductQuery)
        .populate("category")
        .sort({ createdAt: -1 })
        .limit(6),
      Product
        .find({
          ...visibleProductQuery,
          $or: [
            { offerPrice: { $gt: 0 } },
            { category: { $in: offerCategoryIds } }
          ]
        })
        .populate("category")
        .sort({ createdAt: -1 })
        .limit(8)
    ]);

    const latestProducts = filterVisibleProducts(latestProductsRaw)
      .map(normalizeProductCard);
    const offerProducts = filterVisibleProducts(offerProductsRaw)
      .map(normalizeProductCard)
      .filter((product) => product.hasDiscount)
      .slice(0, 6);

    res.render("user/home", {
      user: req.user,
      categories,
      latestProducts,
      offerProducts
    });
  } catch (error) {
    console.log(error, "Home page error");

    res.render("user/home", {
      user: req.user,
      categories: [],
      latestProducts: [],
      offerProducts: []
    });
  }
};
