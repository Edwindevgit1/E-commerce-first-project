import { getWishlistService,addToWishlistService,removeFromWishlistService} from "../../services/wishlistService.js";

const buildRedirectWithMessage = (target, message) => {
  const encodedMessage = encodeURIComponent(
    message || "Something went wrong. Please try again."
  );
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}message=${encodedMessage}`;
};

const getWishlistFriendlyMessage = (error, fallback) => {
  switch (error?.message) {
    case "Product already exists in cart":
      return "This product is already in your cart.";
    case "Product is unavailable":
      return "This product is no longer available.";
    default:
      return error?.message || fallback;
  }
};

export const getWishlistController = async (req,res) => {
  try{
    if(!req.user || !req.user._id){
      return res.redirect("/api/auth/login")
    }
    const userId = req.user._id;
    const {products} = await getWishlistService(userId);
    return res.render("user/wishlist",{
      wishlistProducts: products,
      pageMessage: req.query.message || null
    })
  }catch(error){
    console.log(error,"Get wishlist error");
    return res.render("user/wishlist",{
      wishlistProducts:[],
      pageMessage: req.query.message || null
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
    return res.redirect(
      buildRedirectWithMessage("/api/user/wishlist", "Item added to your wishlist.")
    );
  }catch(error){
    console.log(error,"add to wishlist error")
    const fallbackUrl = "/api/user/products";
    const referer = req.get("referer");
    const target = referer && referer.includes("/api/user/products/")
      ? referer
      : fallbackUrl;
    return res.redirect(
      buildRedirectWithMessage(
        target,
        getWishlistFriendlyMessage(error, "Unable to add this product to your wishlist.")
      )
    );
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
    return res.redirect(
      buildRedirectWithMessage("/api/user/wishlist", "Item removed from your wishlist.")
    )
  }catch(error){
    console.log(error,"remove from wishlist error")
    return res.redirect(
      buildRedirectWithMessage(
        "/api/user/wishlist",
        getWishlistFriendlyMessage(error, "Unable to remove this wishlist item.")
      )
    )
  }
}
