import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import { removeFromWishlistService } from "./wishlistService.js";
import { getEffectiveProductPricing } from "../utils/pricing.js";

const MAX_CART_QUANTITY = 5;
const EXPECTED_CART_ERRORS = new Set([
  "User is required",
  "User and product are required",
  "User and product is required",
  "Invalid action",
  "Cart not found",
  "Product not found in the cart",
  "Product is unavailable",
  "Product is out of stock",
  "Cannot exceed available stock",
  "Cannot add more than available stock",
  "Your cart is empty",
  "No valid cart items selected",
  "One of the cart products no longer exists",
  "Selected variant is unavailable",
  "Selected variant is required"
]);

const normalizeVariantValue = (value = "") => String(value || "").trim().toLowerCase();
const buildVariantKey = (size = "", color = "") =>
  `${normalizeVariantValue(size)}__${normalizeVariantValue(color)}`;
const buildCartItemId = (productId, size = "", color = "") =>
  `${String(productId)}::${buildVariantKey(size, color)}`;

const getProductVariant = (product, size = "", color = "") => {
  const normalizedSize = normalizeVariantValue(size);
  const normalizedColor = normalizeVariantValue(color);
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  if (!variants.length) {
    return {
      size: normalizedSize,
      color: normalizedColor,
      price: Number(product?.price) || 0,
      offerPrice: Number(product?.offerPrice) || 0,
      stock: Number(product?.stock) || 0,
      images: Array.isArray(product?.images) ? product.images : [],
      mainImageIndex: Number(product?.mainImageIndex) || 0
    };
  }

  return variants.find((variant) =>
    normalizeVariantValue(variant.size) === normalizedSize &&
    normalizeVariantValue(variant.color) === normalizedColor
  ) || null;
};

const getDefaultVariant = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  if (!variants.length) {
    return {
      size: "",
      color: "",
      price: Number(product?.price) || 0,
      offerPrice: Number(product?.offerPrice) || 0,
      stock: Number(product?.stock) || 0,
      images: Array.isArray(product?.images) ? product.images : [],
      mainImageIndex: Number(product?.mainImageIndex) || 0
    };
  }

  return variants.find((variant) => Number(variant.stock) > 0) || variants[0] || null;
};

const getProductWithVariantPricing = (product, variant) => {
  const productObject =
    typeof product?.toObject === "function" ? product.toObject() : { ...(product || {}) };

  return {
    ...productObject,
    price: Number(variant?.price) || 0,
    offerPrice: Number(variant?.offerPrice) || 0
  };
};

const getCartVariantAvailabilityMessage = (product, variant, quantity) => {
  if (!product || product.isDeleted) {
    return "This item is no longer available.";
  }

  if (product.isBlocked || product.status !== "active") {
    return "This product is currently unavailable.";
  }

  if (!product.category || product.category.isDeleted) {
    return "This product is unavailable.";
  }

  if (product.category.status !== "active") {
    return "This product is temporarily unavailable.";
  }

  if (!variant) {
    return "This selected variant is unavailable.";
  }

  if (variant.stock <= 0) {
    return "This selected variant is out of stock.";
  }

  if (quantity > variant.stock) {
    return `This variant only has ${variant.stock} stock available. Please reduce the quantity.`;
  }

  return null;
};

const isPurchasableCartItem = (product, variant, desiredQuantity = 1) =>
  Boolean(
    product &&
    variant &&
    !product.isDeleted &&
    !product.isBlocked &&
    product.status === "active" &&
    product.category &&
    !product.category.isDeleted &&
    product.category.status === "active" &&
    variant.stock > 0 &&
    desiredQuantity <= variant.stock
  );

const requireAvailableProduct = (product) => {
  if (
    !product ||
    product.isDeleted === true ||
    product.isBlocked === true ||
    product.status !== "active" ||
    !product.category ||
    product.category.isDeleted === true ||
    product.category.status !== "active"
  ) {
    throw new Error("Product is unavailable");
  }
};

const resolveSelectedVariant = (product, selection = {}) => {
  const requestedSize = normalizeVariantValue(selection.size);
  const requestedColor = normalizeVariantValue(selection.color);

  if (!Array.isArray(product?.variants) || !product.variants.length) {
    return getDefaultVariant(product);
  }

  if (!requestedSize && !requestedColor) {
    return getDefaultVariant(product);
  }

  const matchedVariant = getProductVariant(product, requestedSize, requestedColor);
  if (!matchedVariant) {
    throw new Error("Selected variant is unavailable");
  }

  return matchedVariant;
};

export const getCartService = async (userId) => {
  if (!userId) {
    throw new Error("User is required");
  }

  let cart = await Cart.findOne({ user: userId })
    .populate({
      path: "items.product",
      select:
        "productName price offerPrice images mainImageIndex stock status isBlocked isDeleted category couponCode couponDescription variants",
      populate: {
        path: "category",
        select: "name offerPercentage status isDeleted"
      }
    })
    .lean();

  if (!cart) {
    cart = {
      user: userId,
      items: []
    };
  }

  const validItems = (cart.items || []).filter((item) => item.product);

  const cartItems = validItems.map((item) => {
    const product = item.product;
    const variant = getProductVariant(product, item.size, item.color) || getDefaultVariant(product);
    const pricing = getEffectiveProductPricing(getProductWithVariantPricing(product, variant));
    const price = pricing.effectivePrice;
    const imageIndex = variant?.mainImageIndex ?? 0;
    const subtotal = price * item.quantity;

    return {
      cartItemId: buildCartItemId(product._id, item.size, item.color),
      productId: String(product._id),
      productName: product.productName,
      productImage:
        variant?.images?.[imageIndex] ||
        variant?.images?.[0] ||
        product.images?.[product.mainImageIndex ?? 0] ||
        product.images?.[0] ||
        "",
      category: product.category?.name || "",
      price,
      originalPrice: pricing.basePrice,
      hasDiscount: pricing.hasDiscount,
      quantity: item.quantity,
      stock: Number(variant?.stock) || 0,
      status: product.status,
      isBlocked: product.isBlocked,
      isDeleted: product.isDeleted,
      subtotal,
      size: normalizeVariantValue(item.size),
      color: normalizeVariantValue(item.color),
      variantKey: buildVariantKey(item.size, item.color),
      isAvailable: isPurchasableCartItem(product, variant, item.quantity),
      availabilityMessage: getCartVariantAvailabilityMessage(product, variant, item.quantity),
      disableDecrement: product.isDeleted === true || product.status !== "active"
    };
  });

  const grandTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const hasUnavailableItems = cartItems.some((item) => !item.isAvailable);
  const canCheckout = cartItems.length > 0 && !hasUnavailableItems;

  return {
    cart,
    cartItems,
    grandTotal,
    hasUnavailableItems,
    canCheckout
  };
};

export const addToCartService = async (userId, productId, selection = {}) => {
  if (!userId || !productId) {
    throw new Error("User and product are required");
  }

  const product = await Product.findById(productId).populate("category");
  requireAvailableProduct(product);

  const selectedVariant = resolveSelectedVariant(product, selection);

  if (!selectedVariant) {
    throw new Error("Selected variant is required");
  }

  if (selectedVariant.stock <= 0) {
    throw new Error("Product is out of stock");
  }

  const size = normalizeVariantValue(selectedVariant.size);
  const color = normalizeVariantValue(selectedVariant.color);

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({
      user: userId,
      items: []
    });
  }

  const existingItem = cart.items.find((item) =>
    String(item.product) === String(productId) &&
    normalizeVariantValue(item.size) === size &&
    normalizeVariantValue(item.color) === color
  );

  if (existingItem) {
    const newQuantity = existingItem.quantity + 1;
    if (newQuantity > MAX_CART_QUANTITY) {
      throw new Error(`Maximum ${MAX_CART_QUANTITY} quantity allowed for this product`);
    }
    if (newQuantity > selectedVariant.stock) {
      throw new Error("Cannot add more than available stock");
    }
    existingItem.quantity = newQuantity;
  } else {
    cart.items.push({
      product: productId,
      size,
      color,
      quantity: 1
    });
  }

  const savedCart = await cart.save();
  try {
    await removeFromWishlistService(userId, productId);
  } catch (error) {
    console.log(error, "Wishlist removal failed");
  }

  return savedCart;
};

export const removeFromCartService = async (userId, productId, selection = {}) => {
  if (!userId || !productId) {
    throw new Error("User and product is required");
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new Error("Cart not found");
  }

  const size = normalizeVariantValue(selection.size);
  const color = normalizeVariantValue(selection.color);

  cart.items = cart.items.filter((item) =>
    !(String(item.product) === String(productId) &&
      normalizeVariantValue(item.size) === size &&
      normalizeVariantValue(item.color) === color)
  );

  return await cart.save();
};

export const updateCartQuantityService = async (userId, productId, action, selection = {}) => {
  if (!userId || !productId) {
    throw new Error("User and product are required");
  }

  if (!["increment", "decrement"].includes(action)) {
    throw new Error("Invalid action");
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw new Error("Cart not found");
  }

  const size = normalizeVariantValue(selection.size);
  const color = normalizeVariantValue(selection.color);

  const item = cart.items.find((cartItem) =>
    String(cartItem.product) === String(productId) &&
    normalizeVariantValue(cartItem.size) === size &&
    normalizeVariantValue(cartItem.color) === color
  );

  if (!item) {
    throw new Error("Product not found in the cart");
  }

  if (action === "decrement") {
    if (item.quantity === 1) {
      cart.items = cart.items.filter((cartItem) => !(
        String(cartItem.product) === String(productId) &&
        normalizeVariantValue(cartItem.size) === size &&
        normalizeVariantValue(cartItem.color) === color
      ));
    } else {
      item.quantity -= 1;
    }

    return await cart.save();
  }

  const product = await Product.findById(productId).populate("category");
  requireAvailableProduct(product);
  const selectedVariant = getProductVariant(product, size, color);

  if (!selectedVariant) {
    throw new Error("Selected variant is unavailable");
  }

  if (selectedVariant.stock <= 0) {
    throw new Error("Product is out of stock");
  }

  const newQuantity = item.quantity + 1;
  if (newQuantity > MAX_CART_QUANTITY) {
    throw new Error(`Maximum ${MAX_CART_QUANTITY} quantity is allowed`);
  }
  if (newQuantity > selectedVariant.stock) {
    throw new Error("Cannot exceed available stock");
  }
  item.quantity = newQuantity;

  return await cart.save();
};

export const isExpectedCartError = (error) =>
  Boolean(error?.message && EXPECTED_CART_ERRORS.has(error.message));

export const validateCartForCheckoutService = async (
  userId,
  selectedCartItemIds = []
) => {
  if (!userId) {
    throw new Error("User is required");
  }

  const cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    populate: {
      path: "category",
      select: "name offerPercentage status isDeleted"
    }
  });

  if (!cart || !cart.items.length) {
    throw new Error("Your cart is empty");
  }

  const selectedIdSet = new Set(
    (Array.isArray(selectedCartItemIds) ? selectedCartItemIds : [selectedCartItemIds])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );

  const itemsToValidate =
    selectedIdSet.size > 0
      ? cart.items.filter((item) =>
          selectedIdSet.has(
            buildCartItemId(item.product?._id || item.product, item.size, item.color)
          )
        )
      : cart.items;

  if (!itemsToValidate.length) {
    throw new Error("No valid cart items selected");
  }

  const checkoutItems = [];
  let grandTotal = 0;

  for (const item of itemsToValidate) {
    const productId = item.product?._id;
    const product = await Product.findById(productId).populate("category");

    if (!product) {
      throw new Error("One of the cart products no longer exists");
    }

    requireAvailableProduct(product);
    const selectedVariant = getProductVariant(product, item.size, item.color);

    if (!selectedVariant) {
      throw new Error(`${product.productName} selected variant is unavailable`);
    }

    if (selectedVariant.stock <= 0) {
      throw new Error(`${product.productName} is out of stock`);
    }

    if (item.quantity > selectedVariant.stock) {
      throw new Error(
        `${product.productName} only has ${selectedVariant.stock} item(s) available`
      );
    }

    if (item.quantity > MAX_CART_QUANTITY) {
      throw new Error(
        `${product.productName} exceeds the maximum allowed quantity`
      );
    }

    const pricing = getEffectiveProductPricing(
      getProductWithVariantPricing(product, selectedVariant)
    );
    const price = pricing.effectivePrice;
    const subtotal = price * item.quantity;
    const imageIndex = selectedVariant.mainImageIndex ?? 0;

    checkoutItems.push({
      cartItemId: buildCartItemId(product._id, item.size, item.color),
      productId: String(product._id),
      productName: product.productName,
      productImage:
        selectedVariant.images?.[imageIndex] ||
        selectedVariant.images?.[0] ||
        product.images?.[product.mainImageIndex ?? 0] ||
        product.images?.[0] ||
        "",
      category: product.category?.name || "",
      price,
      quantity: item.quantity,
      subtotal,
      size: normalizeVariantValue(item.size),
      color: normalizeVariantValue(item.color)
    });

    grandTotal += subtotal;
  }

  return {
    checkoutItems,
    grandTotal
  };
};

export const cartVariantHelpers = {
  normalizeVariantValue,
  buildVariantKey,
  buildCartItemId,
  getProductVariant,
  getDefaultVariant
};
