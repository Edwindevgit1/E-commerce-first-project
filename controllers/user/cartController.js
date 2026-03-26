import {
  getCartService,
  addToCartService,
  removeFromCartService,
  updateCartQuantityService,
  isExpectedCartError
} from "../../services/cartServices.js";


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
      canCheckout
    })
  }catch(error){
    console.log(error,'Get cart items error') 
    return res.render("user/cart",{
      cartItems:[],
      grandTotal:0,
      hasUnavailableItems:false,
      canCheckout:false
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
    return res.redirect("/api/user/products")
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
    return res.redirect("/api/user/cart");
  }catch(error){
   console.log(error,"Remove from cart error") 
   return res.redirect("/api/user/cart");
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
    return res.redirect("/api/user/cart")
  }
}
