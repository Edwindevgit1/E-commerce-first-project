import { getWishlistService,addToWishlistService,removeFromWishlistService} from "../../services/wishlistService.js";

export const getWishlistController = async (req,res) => {
  try{
    if(!req.user || !req.user._id){
      return res.redirect("/api/auth/login")
    }
    const userId = req.user._id;
    const {products} = await getWishlistService(userId);
    return res.render("user/wishlist",{
      wishlistProducts: products
    })
  }catch(error){
    console.log(error,"Get wishlist error");
    return res.render("user/wishlist",{
      wishlistProducts:[]
    })
  }
}
export const addToWishlistController = async (req,res) => {
  try{
    if(!req.user || !req.user._id){
      return res.redirect("/api/auth/login");
    }
    const userId = req.user._id;
    const { productId } = req.params;
    if(!productId){
      return res.redirect("/api/user/products");
    }
    await addToWishlistService(userId,productId);
    return res.redirect("/api/user/wishlist");
  }catch(error){
    console.log(error,"add to wishlist error")
    return res.redirect("/api/user/products")
  }
}
export const removeFromWishlistController = async (req,res) => {
  try{
    if(!req.user || !req.user._id){
      return res.redirect("/api/auth/login")
    }
    const userId = req.user._id;
    const { productId } = req.params;
    if(!productId){
      return res.redirect("/api/user/wishlist")
    }
    await removeFromWishlistService(userId, productId);
    return res.redirect("/api/user/wishlist")
  }catch(error){
    console.log(error,"remove from wishlist error")
    return res.redirect("/api/user/wishlist")
  }
}
