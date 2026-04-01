import {
  getCartService,
  addToCartService,
  removeFromCartService,
  updateCartQuantityService,
  isExpectedCartError,
  validateCartForCheckoutService
} from "../../services/cartServices.js";
import { placeOrderService } from "../../services/orderServices.js";

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

export const getCartController = async (req,res)=>{
  try{
    if(!req.user || !req.user._id){
      return res.redirect("/api/auth/login");
    }
    const userId = req.user._id;
    const { cartItems, grandTotal, hasUnavailableItems, canCheckout } = await getCartService(userId);
    return res.render("user/cart",{
      cartItems,
      grandTotal,
      hasUnavailableItems,
      canCheckout,
      checkoutError: req.query.error || null,
      cartMessage: req.query.message || null
    })
  }catch(error){
    console.log(error,'Get cart items error') 
    return res.render("user/cart",{
      cartItems:[],
      grandTotal:0,
      hasUnavailableItems:false,
      canCheckout:false,
      checkoutError: req.query.error || null,
      cartMessage: req.query.message || null
    })
  }
}
export const addToCartController = async (req,res)=>{
  try{
    if(!req.user || !req.user._id){
      return res.redirect("/api/auth/login");
    }
    const userId = req.user._id;
    const { productId } = req.params;
    if(!productId){
      return res.redirect("/api/user/products");
    }
    await addToCartService(userId,productId)
    return res.redirect("/api/user/cart");
  }catch(error){
    if(!isExpectedCartError(error)){
      console.log(error,'Add to cart error')
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
export const removeFromCartController = async (req,res)=>{
  try{
    if(!req.user || !req.user._id){
      return res.redirect("/api/auth/login");
    }
    const userId = req.user._id;
    const { productId } = req.params;
    if(!productId){
      return res.redirect("/api/user/cart")
    }
    await removeFromCartService(userId, productId);
    return res.redirect(
      buildRedirectWithMessage("/api/user/cart", "Item removed from your cart.", "message")
    );
  }catch(error){
   console.log(error,"Remove from cart error") 
   return res.redirect(
    buildRedirectWithMessage(
      "/api/user/cart",
      getCartFriendlyMessage(error, "Unable to remove this item right now."),
      "message"
    )
   );
  }
}
export const updateCartQuantityController = async (req,res)=>{
  try{
    if(!req.user || !req.user._id){
      return res.redirect("/api/auth/login");
    }
    const userId = req.user._id;
    const {productId} = req.params;
    const {action} = req.body;
    if(!productId || !action){
      return res.redirect("/api/user/cart");
    }
    await updateCartQuantityService(userId, productId, action);
    return res.redirect("/api/user/cart");
  }catch(error){
    if(!isExpectedCartError(error)){
      console.log(error,'Update cart quantity error')
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

export const checkoutCartController = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect("/api/auth/login");
    }

    const userId = req.user._id;
    const selectedProductIds = req.body.selectedProductIds || [];

    const { checkoutItems, grandTotal } = await validateCartForCheckoutService(
      userId,
      selectedProductIds
    );

    return res.render("user/checkout", {
      checkoutItems,
      grandTotal,
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

    const selectedProductIds = Array.isArray(req.body.selectedProductIds)
      ? req.body.selectedProductIds
      : [req.body.selectedProductIds];

    if (!selectedProductIds.length || !selectedProductIds[0]) {
      return res.redirect("/api/user/cart?error=No items selected");
    }

    await placeOrderService(userId, selectedProductIds);

    return res.redirect("/api/user/cart?message=Order%20placed%20successfully.");

  } catch (error) {
    console.log(error, "Place order error");

    const message = encodeURIComponent(
      error?.message || "Unable to place the order. Please review your cart."
    );

    return res.redirect(`/api/user/cart?error=${message}`);
  }
};