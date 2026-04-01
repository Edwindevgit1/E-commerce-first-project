import Wishlist from "../models/Wishlist.js";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import { getEffectiveProductPricing } from "../utils/pricing.js";

export const getWishlistService = async (userId) => {
  if(!userId){
    throw new Error("User is required")
  }
  let wishlist = await Wishlist.findOne({user:userId})
  .populate({
    path:"products",
    select:"productName price offerPrice images mainImageIndex stock status isBlocked isDeleted category",
    populate:{
      path:"category",
      select:"name offerPercentage"
    }
  })
  .lean()
  const products = (wishlist?.products || []).map((product)=>{
    const pricing = getEffectiveProductPricing(product);
    const price = pricing.effectivePrice;

    const imageIndex = product.mainImageIndex ?? 0;
    return{
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
      stock:product.stock,
      status:product.status,
      isBlocked:product.isBlocked,
      isDeleted:product.isDeleted,
      isAvailable:
        !product.isDeleted &&
        !product.isBlocked &&
        product.status === "active" &&
        product.stock > 0
    }
  })
  return {
    wishlist : wishlist || null,
    products
  }
}
export const addToWishlistService = async (userId, productId) => {
  if(!userId || !productId){
    throw new Error("User and product are required")
  }
  const cart = await Cart.findOne({ user: userId }).lean();
  const isAlreadyInCart = cart?.items?.some(
    (item) => String(item.product) === String(productId)
  );

  if (isAlreadyInCart) {
    throw new Error("Product already exists in cart");
  }

  const product = await Product.findById(productId);
  if(
    !product ||
    product.isDeleted === true ||
    product.isBlocked === true ||
    product.status !== "active"
  ){
    throw new Error("Product is unavailable")
  }
  let wishlist = await Wishlist.findOne({user:userId});
  if(!wishlist){
    wishlist = new Wishlist({
      user:userId,
      products:[]
    })
  }
  const alreadyExists = wishlist.products.some(
    (item)=>String(item) === String(productId)
  )
  if(!alreadyExists){
    wishlist.products.push(productId);
    await wishlist.save()
  }
  return wishlist;
}
export const removeFromWishlistService = async (userId, productId) => {
  if(!userId || !productId){
    throw new Error("User and product are required")
  }
  const wishlist = await Wishlist.findOne({user:userId})
  if(!wishlist){
    return null;
  }
  if(!wishlist.products.length){
    return wishlist;
  }
  wishlist.products = wishlist.products.filter(
    (item) => String(item) !== String(productId)
  )
  return await wishlist.save()
}
