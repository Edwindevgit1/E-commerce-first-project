import express from "express";
import User from "../../models/User.js";
import { validateCartForCheckoutService } from "../../services/cartServices.js";

const router = express.Router()
router.get('/checkout', async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect("/api/auth/login");
    }

    const rawSelectedIds = req.query.selectedCartItemIds || req.query.selectedProductIds || [];
    const selectedProductIds = Array.isArray(rawSelectedIds)
      ? rawSelectedIds.filter(Boolean)
      : [rawSelectedIds].filter(Boolean);

    if (!selectedProductIds.length) {
      return res.redirect("/api/user/cart?error=No items selected");
    }

    const userId = req.user._id;
    const { checkoutItems, grandTotal } = await validateCartForCheckoutService(
      userId,
      selectedProductIds
    );
    const user = await User.findById(userId);

    return res.render("user/checkout", {
      addresses: user?.addresses || [],
      checkoutItems,
      grandTotal,
      walletBalance: user?.wallet?.balance || 0,
      selectedProductIds
    });
  } catch (error) {
    console.log(error, "Checkout page load error");
    const message = encodeURIComponent(
      error?.message || "Unable to continue checkout. Please review your cart."
    );
    return res.redirect(`/api/user/cart?error=${message}`);
  }
})

export default router
