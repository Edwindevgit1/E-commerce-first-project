import Cart from "../models/Cart.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Coupon from "../models/Coupon.js";
import { generateOrderId } from "../utils/orderId.js";
import { getEffectiveProductPricing } from "../utils/pricing.js";
import { cartVariantHelpers } from "./cartServices.js";
import { validateCouponForCheckout } from "./couponServices.js";
import { debitWallet } from "./walletServices.js";

const { buildCartItemId, getProductVariant } = cartVariantHelpers;
const MAX_CART_QUANTITY = 5;

export const placeOrderService = async (userId, selectedCartItemIds = [], addressId,options={}) => {
  if (!userId) {
    throw new Error("User is required");
  }

  const normalizedSelectedIds = (Array.isArray(selectedCartItemIds)
    ? selectedCartItemIds
    : [selectedCartItemIds]
  )
    .map((id) => String(id || "").trim())
    .filter(Boolean);

  if (!normalizedSelectedIds.length) {
    throw new Error("No valid cart items selected");
  }
  const cart = await Cart.findOne({ user: userId });

  if (!cart || !cart.items.length) {
    throw new Error("Your cart is empty");
  }

  const selectedIdSet = new Set(normalizedSelectedIds);
  const itemsToOrder = cart.items.filter((item) =>
    selectedIdSet.has(buildCartItemId(item.product, item.size, item.color))
  );

  if (itemsToOrder.length !== normalizedSelectedIds.length) {
    throw new Error("Some selected items are invalid or not in your cart");
  }

  if (!itemsToOrder.length) {
    throw new Error("No valid cart items selected");
  }

  const orderItems = [];
  const productsToSave = [];
  let grandTotal = 0;

  for (const item of itemsToOrder) {
    const product = await Product.findById(item.product).populate("category");

    if (!product) {
      throw new Error("One of the cart products no longer exists");
    }

    if (
      product.isDeleted ||
      product.isBlocked ||
      product.status !== "active" ||
      !product.category ||
      product.category.isDeleted ||
      product.category.status !== "active"
    ) {
      throw new Error(`${product.productName} is no longer available`);
    }

    const selectedVariant = getProductVariant(product, item.size, item.color);

    if (!selectedVariant) {
      throw new Error(`${product.productName} selected variant is unavailable`);
    }

    if (selectedVariant.stock <= 0) {
      throw new Error(`${product.productName} is out of stock`);
    }

    if (item.quantity > selectedVariant.stock) {
      throw new Error(
        `${product.productName} only has ${selectedVariant.stock} item(s) available`
      );
    }

    if (item.quantity > MAX_CART_QUANTITY) {
      throw new Error(
        `${product.productName} exceeds the maximum allowed quantity`
      );
    }

    const pricing = getEffectiveProductPricing({
      ...product.toObject(),
      price: Number(selectedVariant.price) || 0,
      offerPrice: Number(selectedVariant.offerPrice) || 0
    });
    const price = pricing.effectivePrice;
    const subtotal = price * item.quantity;
    const imageIndex = selectedVariant.mainImageIndex ?? 0;

    orderItems.push({
      product: product._id,
      productName: product.productName,
      productImage:
        selectedVariant.images?.[imageIndex] ||
        selectedVariant.images?.[0] ||
        product.images?.[product.mainImageIndex ?? 0] ||
        product.images?.[0] ||
        "",
      category: product.category?.name || "",
      price,
      quantity: item.quantity,
      size: item.size || "",
      color: item.color || "",
      subtotal
    });

    grandTotal += subtotal;

    selectedVariant.stock -= item.quantity;
    product.stock = (product.variants || []).reduce(
      (sum, variant) => sum + (Number(variant.stock) || 0),
      0
    );

    productsToSave.push(product);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const selectedAddress = user.addresses.id(addressId);

  if (!selectedAddress) {
    throw new Error("Please select a delivery address");
  }

  const orderId = await generateOrderId();
  const shippingCharge = grandTotal >= 1000 ? 0 : 50;
  const tax = 0;
  const couponResult = await validateCouponForCheckout(options.couponCode || "", grandTotal);
  const discount = couponResult.discount;
  const totalBeforeWallet = Math.max(0,grandTotal + shippingCharge + tax - discount);
  const selectedPaymentMethod = String(options.paymentMethod || "COD").toUpperCase();
  const useWalletPayment = selectedPaymentMethod === "WALLET" || options.useWallet === true;
  const requestedWalletAmount = useWalletPayment
    ? Math.min(Number(options.walletAmount) || totalBeforeWallet, totalBeforeWallet)
    : 0;

  if (useWalletPayment && requestedWalletAmount < totalBeforeWallet) {
    throw new Error("Wallet payment must cover the full order amount");
  }

  if (requestedWalletAmount > 0 && requestedWalletAmount > Number(user.wallet?.balance || 0)) {
    throw new Error("Insufficient wallet balance");
  }

  const remainingPayable = Math.max(0, totalBeforeWallet - requestedWalletAmount);
  let paymentMethod = "COD";
  let paymentStatus = "pending";

  if (selectedPaymentMethod === "WALLET") {
    paymentMethod = "WALLET";
    paymentStatus = remainingPayable === 0 ? "paid" : "pending";
  } else if (selectedPaymentMethod === "RAZORPAY") {
    paymentMethod = "RAZORPAY";
    paymentStatus = "pending";
  }

  if (options.paymentStatus) {
    paymentStatus = String(options.paymentStatus).toLowerCase();
  }

  const razorpayDetails = paymentMethod === "RAZORPAY"
    ? {
        orderId: String(options.razorpayOrderId || ""),
        paymentId: String(options.razorpayPaymentId || ""),
        signature: String(options.razorpaySignature || ""),
        paidAt: paymentStatus === "paid" ? new Date() : null
      }
    : undefined;

  const order = await Order.create({
    orderId,
    user: userId,
    address: selectedAddress.toObject(),
    items: orderItems,
    subtotal: grandTotal,
    discount,
    coupon: couponResult.coupon
      ? { code: couponResult.coupon.code, discount }
      : { code: "", discount: 0 },
    tax,
    shippingCharge,
    grandTotal: totalBeforeWallet,
    paymentMethod,
    paymentStatus,
    razorpay: razorpayDetails,
    walletAmountUsed:requestedWalletAmount,
    status: "pending"
  });

  if (requestedWalletAmount > 0) {
    try {
      await debitWallet(userId, requestedWalletAmount, "Order payment using wallet", order._id);
    } catch (error) {
      await Order.findByIdAndDelete(order._id);
      throw error;
    }
  }

  if (couponResult.coupon) {
    await Coupon.findByIdAndUpdate(couponResult.coupon._id, {
      $inc: { usedCount: 1 }
    });
  }

  await Promise.all(productsToSave.map((product) => product.save()));

  cart.items = cart.items.filter(
    (item) => !selectedIdSet.has(buildCartItemId(item.product, item.size, item.color))
  );

  await cart.save();

  return order;
};
