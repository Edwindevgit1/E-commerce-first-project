import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import { removeFromWishlistService } from "./wishlistService.js";

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
  "Cannot exceed available stock"
]);
const isPurchasableProduct = (product, desiredQuantity = 1) =>
  Boolean(
    product &&
    !product.isDeleted &&
    !product.isBlocked &&
    product.status === "active" &&
    product.stock > 0 &&
    desiredQuantity <= product.stock
  );


export const getCartService = async (userId)=>{
  if(!userId){
    throw new Error("User is required")
  }
  let cart = await Cart.findOne({user:userId})
  .populate({
    path:"items.product",
    select:
        "productName price offerPrice images mainImageIndex stock status isBlocked isDeleted category",
      populate: {
        path: "category",
        select: "name"
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
    const price = 
    product.offerPrice && product.offerPrice > 0
    ? product.offerPrice
    : product.price;
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
      quantity:item.quantity,
      stock:product.stock,
      status:product.status,
      isBlocked:product.isBlocked,
      isDeleted:product.isDeleted,
      subtotal,
      isAvailable: isPurchasableProduct(product, item.quantity)
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
  const product = await Product.findById(productId);
  if(!product ||
    product.isDeleted === true ||
    product.isBlocked === true ||
    product.status !=="active"
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

  const product = await Product.findById(productId);
  if(
    !product ||
    product.isDeleted === true ||
    product.isBlocked === true ||
    product.status !=="active" 
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
