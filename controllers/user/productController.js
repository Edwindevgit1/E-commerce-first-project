import Category from "../../models/Category.js";
import Cart from "../../models/Cart.js";
import Product from "../../models/Product.js";
import { getEffectiveProductPricing } from "../../utils/pricing.js";

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
const buildPaginationItems = (currentPage, totalPages) => {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages, start + 2);
  const adjustedStart = Math.max(1, end - 2);

  return Array.from(
    { length: end - adjustedStart + 1 },
    (_, index) => adjustedStart + index
  );
};

const getSortStage = (sort) => {
  switch (sort) {
    case "price_asc":
      return { offerPrice: 1, price: 1 };
    case "price_desc":
      return { offerPrice: -1, price: -1 };
    case "az":
      return { productName: 1 };
    case "za":
      return { productName: -1 };
    default:
      return { createdAt: -1 };
  }
};

const enrichProductPricing = (product) => {
  const pricing = getEffectiveProductPricing(product);

  return {
    ...product.toObject(),
    displayPrice: pricing.effectivePrice,
    originalPrice: pricing.basePrice,
    hasDiscount: pricing.hasDiscount,
    discountSource: pricing.discountSource,
    categoryOfferPercentage: pricing.categoryOfferPercentage
  };
};

const getCategoryAvailabilityState = (category) => {
  if (!category || category.isDeleted === true) {
    return "deleted";
  }

  if (category.status !== "active") {
    return "inactive";
  }

  return "active";
};

const enrichProductState = (product) => {
  const enrichedProduct = enrichProductPricing(product);
  const categoryAvailability = getCategoryAvailabilityState(product.category);
  const productAvailability = product.status === "active" ? "active" : "inactive";
  const isUnavailable = categoryAvailability !== "active" || productAvailability !== "active";

  return {
    ...enrichedProduct,
    categoryAvailability,
    productAvailability,
    isUnavailableBecauseOfCategory: isUnavailable,
    canUserPurchase:
      !product.isDeleted &&
      !product.isBlocked &&
      productAvailability === "active" &&
      categoryAvailability === "active"
  };
};

export const getProductListingPage = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const search = normalizeSearchTerm(req.query.search || "");
    const category = req.query.category || "";
    const priceRange = req.query.priceRange || "";
    const sort = req.query.sort || "";
    const size = req.query.size || "";
    const color = req.query.color || "";
    const andConditions = [];
    const query = {
      isDeleted: false,
      isBlocked: false
    };

    if (search) {
      const searchPattern = search
        .split(" ")
        .map((term) => escapeRegex(term))
        .join("\\s+");

      query.productName = { $regex: searchPattern, $options: "i" };
    }

    if (category) {
      query.category = category;
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
      isDeleted: false,
      isBlocked: false
    };

    const [products, totalProducts, categories, sizeOptions, colorOptions, variantSizeOptions, variantColorOptions] = await Promise.all([
      Product.find(query)
        .populate("category")
        .sort(getSortStage(sort))
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query),
      Category.find({ isDeleted: false, status: "active" }).sort({ name: 1 }),
      Product.distinct("sizes", baseQuery),
      Product.distinct("colors", baseQuery),
      Product.distinct("variants.size", baseQuery),
      Product.distinct("variants.color", baseQuery)
    ]);

    const pricedProducts = products.map(enrichProductState);

    const viewData = {
      products: pricedProducts,
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
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      paginationItems: buildPaginationItems(
        page,
        Math.ceil(totalProducts / limit)
      )
    };

    if (req.query.partial === "1") {
      return res.render("user/partials/product-listing-content", viewData);
    }

    res.render("user/product-listing", viewData);
  } catch (error) {
    console.log(error, "product listing page error");
  }
};
export const getProductDetailsPage = async (req, res) => {
  try {
    // Fetch product WITHOUT filtering
    const product = await Product.findById(req.params.id).populate("category");

    // Case 1: Product not found
    if (!product) {
      return res.render("user/product-unavailable", {
        message: "This product does not exist or may have been removed."
      });
    }

    // Case 2: Blocked / Deleted / Inactive
    if (
      product.isDeleted === true ||
      product.isBlocked === true
    ) {
      return res.render("user/product-unavailable", {
        message: "This item is currently unavailable."
      });
    }
    

    // Cart quantity
    let cartQuantity = 0;

    if (req.user?._id) {
      const cart = await Cart.findOne({ user: req.user._id }).lean();
      const cartItem = cart?.items?.find(
        (item) => String(item.product) === String(product._id)
      );
      cartQuantity = cartItem?.quantity || 0;
    }

    // Related products
    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      category: product.category?._id,
      isDeleted: false,
      isBlocked: false,
      status: "active"
    })
      .limit(4)
      .sort({ createdAt: -1 });

    // Stock logic
    const hasStock = product.stock > 0;
    const categoryAvailability = getCategoryAvailabilityState(product.category);

    const availableVariants = (product.variants || []).filter(
      (variant) => variant.stock > 0
    );

    const hasVariantStock =
      !product.variants?.length || availableVariants.length > 0;

    const isLowStock = hasStock && product.stock < 4;
    const productAvailability = product.status === "active" ? "active" : "inactive";
    const canAddToCart =
      hasStock &&
      hasVariantStock &&
      productAvailability === "active" &&
      categoryAvailability === "active";
    const isInCart = cartQuantity > 0;

    // Availability message
    let availabilityState = "available";
    let availabilityMessage = "Ready to order.";

    if (productAvailability === "inactive") {
      availabilityState = "product_inactive";
      availabilityMessage = "This product is temporarily unavailable.";
    } else if (categoryAvailability === "deleted") {
      availabilityState = "category_deleted";
      availabilityMessage = "This product is unavailable.";
    } else if (categoryAvailability === "inactive") {
      availabilityState = "category_inactive";
      availabilityMessage = "This product is temporarily unavailable.";
    } else if (!hasStock) {
      availabilityState = "sold_out";
      availabilityMessage =
        "This product is currently sold out. Please check back later.";
    } else if (!hasVariantStock) {
      availabilityState = "variant_unavailable";
      availabilityMessage =
        "This product is in stock, but no selectable size or color is currently available.";
    } else if (isLowStock) {
      availabilityState = "low_stock";
      availabilityMessage = "Almost few pieces left. Hurry up.";
    }

    // Sizes & colors
    const displaySizes = [
      ...new Set([
        ...(product.sizes || []),
        ...availableVariants.map((variant) => variant.size)
      ])
    ].filter(Boolean);

    const displayColors = normalizeColorList([
      ...(product.colors || []),
      ...availableVariants.map((variant) => variant.color)
    ]);

    // Pricing
    const pricedProduct = enrichProductState(product);
    const pricedRelatedProducts = relatedProducts.map(enrichProductState);

    // Render page
    return res.render("user/product-detail", {
      product: pricedProduct,
      relatedProducts: pricedRelatedProducts,
      hasStock,
      hasVariantStock,
      isLowStock,
      availabilityState,
      availabilityMessage,
      canAddToCart,
      isInCart,
      cartQuantity,
      availableVariants,
      displaySizes,
      displayColors,
      productAvailability,
      categoryAvailability,
      pageMessage: req.query.message || null
    });

  } catch (error) {
    console.log(error, "product detail page error");

    return res.render("user/product-unavailable", {
      message: "Something went wrong while loading this product."
    });
  }
};
