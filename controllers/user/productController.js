import Category from "../../models/Category.js";
import Product from "../../models/Product.js";

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
      isBlocked: false,
      status: "active"
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
      isBlocked: false,
      status: "active"
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

    const viewData = {
      products,
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
      totalPages: Math.ceil(totalProducts / limit)
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
    const product = await Product.findOne({
      _id: req.params.id,
      isDeleted: false,
      isBlocked: false,
      status: "active"
    }).populate("category");

    if (!product) {
      return res.redirect("/api/user/products");
    }

    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      category: product.category?._id,
      isDeleted: false,
      isBlocked: false,
      status: "active"
    })
      .limit(4)
      .sort({ createdAt: -1 });

    const hasStock = product.stock > 0;
    const availableVariants = (product.variants || []).filter((variant) => variant.stock > 0);
    const hasVariantStock = !product.variants?.length || availableVariants.length > 0;
    const isLowStock = hasStock && product.stock < 4;
    const canAddToCart = product.stock >= 3 && hasVariantStock;
    let availabilityState = "available";
    let availabilityMessage = "Ready to order.";

    if (!hasStock) {
      availabilityState = "sold_out";
      availabilityMessage = "This product is currently sold out. Please check back later.";
    } else if (product.stock < 3) {
      availabilityState = "cart_restricted";
      availabilityMessage = "This product cannot be added to cart when stock is below 3 pieces.";
    } else if (!hasVariantStock) {
      availabilityState = "variant_unavailable";
      availabilityMessage = "This product is in stock, but no selectable size or color is currently available.";
    } else if (isLowStock) {
      availabilityState = "low_stock";
      availabilityMessage = "Almost few pieces left. Hurry up.";
    }

    const displaySizes = [...new Set([
      ...(product.sizes || []),
      ...availableVariants.map((variant) => variant.size)
    ])].filter(Boolean);
    const displayColors = normalizeColorList([
      ...(product.colors || []),
      ...availableVariants.map((variant) => variant.color)
    ]);

    res.render("user/product-detail", {
      product,
      relatedProducts,
      hasStock,
      hasVariantStock,
      isLowStock,
      availabilityState,
      availabilityMessage,
      canAddToCart,
      availableVariants,
      displaySizes,
      displayColors
    });
  } catch (error) {
    console.log(error, "product details error");
    res.redirect("/api/user/products");
  }
};
