import {
  getCartService,
  addToCartService,
  removeFromCartService,
  updateCartQuantityService,
  isExpectedCartError,
  validateCartForCheckoutService
} from "../../services/cartServices.js";
import { placeOrderService } from "../../services/orderServices.js";
import User from "../../models/User.js";
import Order from "../../models/Order.js";

const buildRedirectWithMessage = (target, message, key = "error") => {
  const encodedMessage = encodeURIComponent(
    message || "Something went wrong. Please try again."
  );
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}${key}=${encodedMessage}`;
};

const getCartFriendlyMessage = (error, fallback) => {
  if (/^Maximum \d+ quantity/.test(error?.message || "")) {
    return "Maximum quantity reached for this product.";
  }

  switch (error?.message) {
    case "Product is unavailable":
      return "This product is no longer available.";
    case "Product is out of stock":
      return "This product is currently out of stock.";
    case "Cannot add more than available stock":
    case "Cannot exceed available stock":
      return "You cannot add more than the available stock.";
    case "Cart not found":
      return "Your cart could not be found. Please try again.";
    case "Product not found in the cart":
      return "This product is no longer in your cart.";
    default:
      return error?.message || fallback;
  }
};

const isAjaxRequest = (req) =>
  req.xhr ||
  req.get("x-requested-with") === "XMLHttpRequest" ||
  String(req.get("accept") || "").includes("application/json");

export const getCartController = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect("/api/auth/login");
    }
    const userId = req.user._id;
    const { cartItems, grandTotal, hasUnavailableItems, canCheckout } = await getCartService(userId);
    return res.render("user/cart", {
      cartItems,
      grandTotal,
      hasUnavailableItems,
      canCheckout,
      checkoutError: req.query.error || null,
      cartMessage: req.query.message || null
    })
  } catch (error) {
    console.log(error, 'Get cart items error')
    return res.render("user/cart", {
      cartItems: [],
      grandTotal: 0,
      hasUnavailableItems: false,
      canCheckout: false,
      checkoutError: req.query.error || null,
      cartMessage: req.query.message || null
    })
  }
}
export const addToCartController = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect("/api/auth/login");
    }
    const userId = req.user._id;
    const { productId } = req.params;
    if (!productId) {
      return res.redirect("/api/user/products");
    }
    await addToCartService(userId, productId, {
      size: req.body.size,
      color: req.body.color
    })
    return res.redirect("/api/user/cart");
  } catch (error) {
    if (!isExpectedCartError(error)) {
      console.log(error, 'Add to cart error')
    }
    const fallbackUrl = "/api/user/products";
    const referer = req.get("referer");
    const target = referer && referer.includes("/api/user/products/")
      ? referer
      : fallbackUrl;
    return res.redirect(
      buildRedirectWithMessage(
        target,
        getCartFriendlyMessage(error, "Unable to add this product to your cart."),
        "message"
      )
    );
  }
}
export const removeFromCartController = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect("/api/auth/login");
    }
    const userId = req.user._id;
    const { productId } = req.params;
    if (!productId) {
      return res.redirect("/api/user/cart")
    }
    await removeFromCartService(userId, productId, {
      size: req.body.size,
      color: req.body.color
    });
    return res.redirect(
      buildRedirectWithMessage("/api/user/cart", "Item removed from your cart.", "message")
    );
  } catch (error) {
    console.log(error, "Remove from cart error")
    return res.redirect(
      buildRedirectWithMessage(
        "/api/user/cart",
        getCartFriendlyMessage(error, "Unable to remove this item right now."),
        "message"
      )
    );
  }
}
export const updateCartQuantityController = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      if (isAjaxRequest(req)) {
        return res.status(401).json({
          success: false,
          message: "Please log in to update your cart."
        });
      }
      return res.redirect("/api/auth/login");
    }
    const userId = req.user._id;
    const { productId } = req.params;
    const { action } = req.body;
    if (!productId || !action) {
      if (isAjaxRequest(req)) {
        return res.status(400).json({
          success: false,
          message: "Invalid cart update request."
        });
      }
      return res.redirect("/api/user/cart");
    }
    await updateCartQuantityService(userId, productId, action, {
      size: req.body.size,
      color: req.body.color
    });
    if (isAjaxRequest(req)) {
      const { cartItems, grandTotal, hasUnavailableItems, canCheckout } = await getCartService(userId);
      return res.json({
        success: true,
        message: "Cart updated.",
        cartItems,
        grandTotal,
        hasUnavailableItems,
        canCheckout
      });
    }
    return res.redirect("/api/user/cart");
  } catch (error) {
    if (!isExpectedCartError(error)) {
      console.log(error, 'Update cart quantity error')
    }
    if (isAjaxRequest(req)) {
      return res.status(400).json({
        success: false,
        message: getCartFriendlyMessage(error, "Unable to update cart quantity right now.")
      });
    }
    return res.redirect(
      buildRedirectWithMessage(
        "/api/user/cart",
        getCartFriendlyMessage(error, "Unable to update cart quantity right now."),
        "message"
      )
    )
  }
}

export const updateCartQuantityAjaxController = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Please log in to update your cart."
      });
    }

    const userId = req.user._id;
    const { productId } = req.params;
    const { action } = req.body;

    if (!productId || !action) {
      return res.status(400).json({
        success: false,
        message: "Invalid cart update request."
      });
    }

    await updateCartQuantityService(userId, productId, action, {
      size: req.body.size,
      color: req.body.color
    });
    const { cartItems, grandTotal, hasUnavailableItems, canCheckout } = await getCartService(userId);

    return res.json({
      success: true,
      message: "Cart updated.",
      cartItems,
      grandTotal,
      hasUnavailableItems,
      canCheckout
    });
  } catch (error) {
    if (!isExpectedCartError(error)) {
      console.log(error, "Update cart quantity ajax error");
    }

    return res.status(400).json({
      success: false,
      message: getCartFriendlyMessage(error, "Unable to update cart quantity right now.")
    });
  }
}

export const checkoutCartController = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect("/api/auth/login");
    }

    const userId = req.user._id;
    const selectedProductIds = req.body.selectedCartItemIds || req.body.selectedProductIds || [];

    const { checkoutItems, grandTotal } = await validateCartForCheckoutService(
      userId,
      selectedProductIds
    );

    const user = await User.findById(userId);

    return res.render("user/checkout", {
      checkoutItems,
      grandTotal,
      addresses: user?.addresses || [],
      walletBalance:user?.wallet?.balance || 0,
      selectedProductIds: Array.isArray(selectedProductIds)
        ? selectedProductIds
        : [selectedProductIds]
    });
  } catch (error) {
    if (!isExpectedCartError(error)) {
      console.log(error, "Checkout validation error");
    }
    const message = encodeURIComponent(
      error?.message || "Unable to continue checkout. Please review your cart."
    );
    return res.redirect(`/api/user/cart?error=${message}`);
  }
};
export const placeOrderController = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect("/api/auth/login");
    }

    const userId = req.user._id;
    const { addressId } = req.body;

    const selectedCartItemIds = req.body.selectedCartItemIds || req.body.selectedProductIds;
    const selectedProductIds = Array.isArray(selectedCartItemIds)
      ? selectedCartItemIds
      : [selectedCartItemIds];

    if (!selectedProductIds.length || !selectedProductIds[0]) {
      return res.redirect("/api/user/cart?error=No items selected");
    }

    const order = await placeOrderService(userId, selectedProductIds, addressId,{
      paymentMethod:req.body.paymentMethod,
      useWallet:req.body.paymentMethod === "WALLET",
      walletAmount:req.body.walletAmount
    });

    return res.redirect(`/api/user/order-success/${order._id}`);

  } catch (error) {
    console.log(error, "Place order error");

    const message = encodeURIComponent(
      error?.message || "Unable to place the order. Please review your cart."
    );

    return res.redirect(`/api/user/cart?error=${message}`);
  }
};

export const getOrderSuccessController = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect("/api/auth/login");
    }

    const { orderId } = req.params;
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    });

    if (!order) {
      return res.redirect("/api/user/cart?error=Order not found");
    }

    return res.render("user/order-success", {
      order
    });
  } catch (error) {
    console.log(error, "Get order success page error");
    return res.redirect("/api/user/cart?error=Unable to load order success page");
  }
};
