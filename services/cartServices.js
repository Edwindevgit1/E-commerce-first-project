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
  "Your cart is empty",
  "No valid cart items selected",
  "One of the cart products no longer exists"
]);
const isPurchasableProduct = (product, desiredQuantity = 1) =>
  Boolean(
    product &&
    !product.isDeleted &&
    !product.isBlocked &&
    product.status === "active" &&
    product.category &&
    !product.category.isDeleted &&
    product.category.status === "active" &&
    product.stock > 0 &&
    desiredQuantity <= product.stock
  );

const getCartItemAvailabilityMessage = (product, quantity) => {
  if (!product || product.isDeleted || product.isBlocked || product.status !== "active") {
    return "This product is currently unavailable.";
  }

  if (!product.category || product.category.isDeleted) {
    return "This product is unavailable.";
  }

  if (product.category.status !== "active") {
    return "This product is temporarily unavailable.";
  }

  if (product.stock <= 0) {
    return "This product is out of stock.";
  }

  if (quantity > product.stock) {
    return `This product only has ${product.stock} stock available. Please reduce the quantity.`;
  }

  return null;
};


export const getCartService = async (userId)=>{
  if(!userId){
    throw new Error("User is required")
  }
  let cart = await Cart.findOne({user:userId})
  .populate({
    path:"items.product",
      select:
        "productName price offerPrice images mainImageIndex stock status isBlocked isDeleted category couponCode couponDescription",
      populate: {
        path: "category",
        select: "name offerPercentage status isDeleted"
      }
  })
  .lean();
  if(!cart){
    cart={
      user:userId,
      items:[]
    }
  }
  const validItems = (cart.items || []).filter((item)=> item.product);
  const cartItems = validItems.map((item)=>{
    const product = item.product;
    const pricing = getEffectiveProductPricing(product);
    const price = pricing.effectivePrice;
    const imageIndex = product.mainImageIndex ?? 0;
    const subtotal = price * item.quantity;
    return {
      productId:product._id,
      productName:product.productName,
      productImage:
        product.images?.[imageIndex] ||
        product.images?.[0] ||
        "",
      category:product.category?.name || "",
      price,
      originalPrice: pricing.basePrice,
      hasDiscount: pricing.hasDiscount,
      quantity:item.quantity,
      stock:product.stock,
      status:product.status,
      isBlocked:product.isBlocked,
      isDeleted:product.isDeleted,
      subtotal,
      isAvailable: isPurchasableProduct(product, item.quantity),
      availabilityMessage: getCartItemAvailabilityMessage(product, item.quantity)
    }
  }) 
  const grandTotal = cartItems.reduce((sum,item)=>sum + item.subtotal,0)
  const hasUnavailableItems = cartItems.some((item) => !item.isAvailable);
  const canCheckout = cartItems.length > 0 && !hasUnavailableItems;
  return {
    cart,
    cartItems,
    grandTotal,
    hasUnavailableItems,
    canCheckout
  }
}

export const addToCartService = async (userId, productId)=>{
  if(!userId || !productId){
    throw new Error("User and product are required");
  }
  const product = await Product.findById(productId).populate("category");
  if(!product ||
    product.isDeleted === true ||
    product.isBlocked === true ||
    product.status !=="active" ||
    !product.category ||
    product.category.isDeleted === true ||
    product.category.status !== "active"
  ){
    throw new Error("Product is unavailable");
  }
  if(product.stock <= 0){
    throw new Error("Product is out of stock");
  }
  let cart = await Cart.findOne({user:userId});
  if(!cart){
    cart = new Cart({
      user:userId,
      items:[]
    })
  }
  const existingItem = cart.items.find((item)=>String(item.product) === String(productId))
  if(existingItem){
    const newQuantity = existingItem.quantity+1;
    if(newQuantity > MAX_CART_QUANTITY){
      throw new Error(`Maximum ${MAX_CART_QUANTITY} quantity allowed for this product`);
    }
    if(newQuantity > product.stock){
      throw new Error("Cannot add more than available stock");
    }
    existingItem.quantity = newQuantity;
  }else{
    if(product.stock < 1){
      throw new Error("Product is out of stock");
    }
    cart.items.push({
      product:productId,
      quantity:1
    })
  }
  const savedCart = await cart.save()
  try{
    await removeFromWishlistService(userId,productId)
  }catch(error){
    console.log(error,"Wishlist removal failed")
  }
  return savedCart
}
export const removeFromCartService = async (userId, productId)=>{
  if(!userId || !productId){
    throw new Error("User and product is required");
  }
  const cart = await Cart.findOne({user:userId})
  if(!cart){
    throw new Error("Cart not found")
  }
  cart.items = cart.items.filter((item)=>String(item.product) !== String(productId))
  return await cart.save()
}

export const updateCartQuantityService = async (userId, productId, action)=>{
  if(!userId || !productId){
    throw new Error("User and product are required")
  }
  if(!["increment","decrement"].includes(action)){
    throw new Error("Invalid action");
  }
  const cart = await Cart.findOne({user:userId});
  if(!cart){
    throw new Error("Cart not found")
  }
  const item = cart.items.find((cartItem)=>String(cartItem.product)===String(productId))
  if(!item){
    throw new Error("Product not found in the cart");
  }

  if(action === "decrement"){
    if(item.quantity === 1){
      cart.items = cart.items.filter(
        (cartItem)=>String(cartItem.product) !== String(productId))
    }else{
      item.quantity -=1;
    }
    return await cart.save()
  }

  const product = await Product.findById(productId).populate("category");
  if(
    !product ||
    product.isDeleted === true ||
    product.isBlocked === true ||
    product.status !=="active" ||
    !product.category ||
    product.category.isDeleted === true ||
    product.category.status !== "active"
  ){
    throw new Error("Product is unavailable")
  }
  if(product.stock <= 0){
    throw new Error("Product is out of stock");
  }
  if(action === "increment"){
    const newQuantity = item.quantity + 1;
    if(newQuantity > MAX_CART_QUANTITY){
      throw new Error(`Maximum ${MAX_CART_QUANTITY} quantity is allowed`)
    }
    if(newQuantity > product.stock){
      throw new Error("Cannot exceed available stock")
    }
    item.quantity = newQuantity;
  }
  return await cart.save()
}

export const isExpectedCartError = (error) =>
  Boolean(error?.message && EXPECTED_CART_ERRORS.has(error.message));

export const validateCartForCheckoutService = async (
  userId,
  selectedProductIds = []
) => {
  if (!userId) {
    throw new Error("User is required");
  }

  const cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    populate: {
      path: "category",
      select: "name offerPercentage"
    }
  });

  if (!cart || !cart.items.length) {
    throw new Error("Your cart is empty");
  }

  const selectedIdSet = new Set(
    (Array.isArray(selectedProductIds) ? selectedProductIds : [selectedProductIds])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );

  const itemsToValidate =
    selectedIdSet.size > 0
      ? cart.items.filter((item) => selectedIdSet.has(String(item.product?._id)))
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

    if (
      product.isDeleted === true ||
      product.isBlocked === true ||
      product.status !== "active" ||
      !product.category ||
      product.category.isDeleted === true ||
      product.category.status !== "active"
    ) {
      throw new Error(`${product.productName} is unavailable`);
    }

    if (product.stock <= 0) {
      throw new Error(`${product.productName} is out of stock`);
    }

    if (item.quantity > product.stock) {
      throw new Error(
        `${product.productName} only has ${product.stock} item(s) available`
      );
    }

    if (item.quantity > MAX_CART_QUANTITY) {
      throw new Error(
        `${product.productName} exceeds the maximum allowed quantity`
      );
    }

    const pricing = getEffectiveProductPricing(product);
    const price = pricing.effectivePrice;
    const subtotal = price * item.quantity;
    const imageIndex = product.mainImageIndex ?? 0;

    checkoutItems.push({
      productId: product._id,
      productName: product.productName,
      productImage:
        product.images?.[imageIndex] ||
        product.images?.[0] ||
        "",
      category: product.category?.name || "",
      price,
      quantity: item.quantity,
      subtotal
    });

    grandTotal += subtotal;
  }

  return {
    checkoutItems,
    grandTotal
  };
};
