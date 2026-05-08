import express from "express";
import User from "../../models/User.js";
import { validateCartForCheckoutService } from "../../services/cartServices.js";
import { validateCouponForCheckout } from "../../services/couponServices.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "../../services/razorpayServices.js";
import { placeOrderService } from "../../services/orderServices.js";

const router = express.Router()
const buildSelectedItemsQuery = (selectedProductIds = []) =>
  selectedProductIds
    .map((id) => `selectedCartItemIds=${encodeURIComponent(id)}`)
    .join("&");

const buildCheckoutUrl = (selectedProductIds = []) => {
  const query = buildSelectedItemsQuery(selectedProductIds);
  return `/api/user/checkout${query ? `?${query}` : ""}`;
};

const getCheckoutSummary = async (userId, selectedProductIds, couponCode = "") => {
  const { checkoutItems, grandTotal } = await validateCartForCheckoutService(
    userId,
    selectedProductIds
  );
  const couponResult = await validateCouponForCheckout(couponCode, grandTotal);
  const shipping = grandTotal >= 1000 ? 0 : 50;
  const tax = 0;
  const finalTotal = Math.max(0, grandTotal + shipping + tax - couponResult.discount);

  return {
    checkoutItems,
    grandTotal,
    coupon: couponResult.coupon,
    couponDiscount: couponResult.discount,
    shipping,
    tax,
    finalTotal
  };
};

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
    const summary = await getCheckoutSummary(
      userId,
      selectedProductIds,
      req.session.checkoutCouponCode || ""
    );
    const user = await User.findById(userId);

    return res.render("user/checkout", {
      addresses: user?.addresses || [],
      checkoutItems: summary.checkoutItems,
      grandTotal: summary.grandTotal,
      coupon: summary.coupon,
      couponDiscount: summary.couponDiscount,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
      walletBalance: user?.wallet?.balance || 0,
      selectedProductIds,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.log(error, "Checkout page load error");
    const message = encodeURIComponent(
      error?.message || "Unable to continue checkout. Please review your cart."
    );
    return res.redirect(`/api/user/cart?error=${message}`);
  }
})

router.post("/checkout/coupon/apply", async (req, res) => {
  try {
    const selectedProductIds = Array.isArray(req.body.selectedCartItemIds)
      ? req.body.selectedCartItemIds.filter(Boolean)
      : [req.body.selectedCartItemIds].filter(Boolean);
    const query = buildSelectedItemsQuery(selectedProductIds);

    if (!selectedProductIds.length) {
      return res.redirect("/api/user/cart?error=No items selected");
    }

    const { grandTotal } = await validateCartForCheckoutService(req.user._id, selectedProductIds);
    const result = await validateCouponForCheckout(req.body.couponCode || "", grandTotal);

    if (!result.coupon) {
      throw new Error("Invalid coupon code");
    }

    req.session.checkoutCouponCode = result.coupon.code;
    return res.redirect(`/api/user/checkout?${query}&message=Coupon applied`);
  } catch (error) {
    const selectedProductIds = Array.isArray(req.body.selectedCartItemIds)
      ? req.body.selectedCartItemIds.filter(Boolean)
      : [req.body.selectedCartItemIds].filter(Boolean);
    const query = buildSelectedItemsQuery(selectedProductIds);
    return res.redirect(`/api/user/checkout?${query}&error=${encodeURIComponent(error.message || "Unable to apply coupon")}`);
  }
});

router.post("/checkout/coupon/remove", (req, res) => {
  const selectedProductIds = Array.isArray(req.body.selectedCartItemIds)
    ? req.body.selectedCartItemIds.filter(Boolean)
    : [req.body.selectedCartItemIds].filter(Boolean);
  const query = buildSelectedItemsQuery(selectedProductIds);
  req.session.checkoutCouponCode = "";
  return res.redirect(`/api/user/checkout?${query}&message=Coupon removed`);
});

router.post("/checkout/razorpay/create-order", async (req, res) => {
  try {
    const selectedCartItemIds = Array.isArray(req.body.selectedCartItemIds)
      ? req.body.selectedCartItemIds.filter(Boolean)
      : [req.body.selectedCartItemIds].filter(Boolean);
    const addressId = String(req.body.addressId || "").trim();

    if (!selectedCartItemIds.length) {
      return res.status(400).json({ success: false, message: "No items selected" });
    }

    if (!addressId) {
      return res.status(400).json({ success: false, message: "Please select a delivery address" });
    }

    const summary = await getCheckoutSummary(
      req.user._id,
      selectedCartItemIds,
      req.session.checkoutCouponCode || ""
    );

    const receipt = `rcpt_${Date.now()}`;
    const razorpayOrder = await createRazorpayOrder({
      amount: summary.finalTotal,
      receipt,
      notes: {
        userId: String(req.user._id),
        addressId
      }
    });

    req.session.pendingRazorpayCheckout = {
      selectedCartItemIds,
      addressId,
      couponCode: req.session.checkoutCouponCode || "",
      amount: summary.finalTotal,
      razorpayOrderId: razorpayOrder.id,
      retryUrl: buildCheckoutUrl(selectedCartItemIds)
    };

    return res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: Math.round(summary.finalTotal * 100),
      currency: "INR",
      orderId: razorpayOrder.id
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to initiate Razorpay payment"
    });
  }
});

router.post("/checkout/razorpay/verify", async (req, res) => {
  try {
    const pending = req.session.pendingRazorpayCheckout;

    if (!pending) {
      throw new Error("Payment session expired");
    }

    const isValidSignature = verifyRazorpaySignature({
      razorpayOrderId: req.body.razorpay_order_id,
      razorpayPaymentId: req.body.razorpay_payment_id,
      razorpaySignature: req.body.razorpay_signature
    });

    if (!isValidSignature || pending.razorpayOrderId !== req.body.razorpay_order_id) {
      throw new Error("Payment verification failed");
    }

    const order = await placeOrderService(
      req.user._id,
      pending.selectedCartItemIds,
      pending.addressId,
      {
        paymentMethod: "RAZORPAY",
        paymentStatus: "paid",
        couponCode: pending.couponCode || "",
        razorpayOrderId: req.body.razorpay_order_id,
        razorpayPaymentId: req.body.razorpay_payment_id,
        razorpaySignature: req.body.razorpay_signature
      }
    );

    req.session.checkoutCouponCode = "";
    req.session.pendingRazorpayCheckout = null;

    return res.json({
      success: true,
      redirectUrl: `/api/user/order-success/${order._id}`
    });
  } catch (error) {
    const retryUrl = req.session.pendingRazorpayCheckout?.retryUrl || "/api/user/cart";
    req.session.pendingRazorpayCheckout = null;
    return res.status(400).json({
      success: false,
      message: error.message || "Payment verification failed",
      redirectUrl: `/api/user/payment-failure?message=${encodeURIComponent(error.message || "Payment verification failed")}&retryUrl=${encodeURIComponent(retryUrl)}`
    });
  }
});

export default router
