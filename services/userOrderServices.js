import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import { creditWallet } from "./walletServices.js";
import { calculateCouponDiscount } from "./couponServices.js";

const normalizeVariantValue = (value = "") => String(value || "").trim().toLowerCase();

const findRestockVariant = (product, item) => {
  const variants = product.variants || [];
  const size = normalizeVariantValue(item.size);
  const color = normalizeVariantValue(item.color);

  return variants.find((variant) =>
    normalizeVariantValue(variant.size) === size &&
    normalizeVariantValue(variant.color) === color
  ) || variants.find((variant) => String(variant.price) === String(item.price));
}

const restockOrderItem = async (item) => {
  if(!item?.product || item.stockRestored) return;
  const product = await Product.findById(item.product);
  if(!product)return;
  const variant = findRestockVariant(product,item);
  if(variant){
    variant.stock += Number(item.quantity) || 0;
  }else{
    product.stock += Number(item.quantity) || 0;
  }
  if(product.variants?.length){
    product.stock = product.variants.reduce(
      (sum, variantItem) => sum + (Number(variantItem.stock) || 0),
      0
    );
  }
  await product.save();
  item.stockRestored = true;
  item.restockVerifiedAt = new Date();
}
const refundCancelledOrder = async (order,amount,reason) => {
  const refundable = order.walletAmountUsed > 0 || (["paid","pending"].includes(order.paymentStatus) && order.paymentMethod !=="COD")
  if(!refundable || amount <= 0)return;
  await creditWallet(order.user,amount,reason,order._id);
}

const canRequestCancellation = (item) =>
  ["pending", "shipped"].includes(item.status) && !item.cancellationRejected;

const activeFinancialStatuses = new Set([
  "pending",
  "shipped",
  "out_for_delivery",
  "delivered",
  "return_requested",
  "return_rejected",
  "failed"
]);

const getActiveOrderSubtotal = (order) =>
  order.items.reduce((sum, item) => {
    if (!activeFinancialStatuses.has(item.status)) return sum;
    return sum + (Number(item.subtotal) || 0);
  }, 0);

const revalidateOrderCouponAfterCancellation = async (order) => {
  const previousGrandTotal = Number(order.grandTotal || 0);
  const previousCouponCode = String(order.coupon?.code || "").trim();
  const activeSubtotal = getActiveOrderSubtotal(order);
  const shippingCharge = activeSubtotal <= 0 ? 0 : activeSubtotal >= 1000 ? 0 : 50;
  const tax = Number(order.tax || 0);
  let discount = 0;
  let couponMessage = "";

  if (previousCouponCode) {
    const coupon = await Coupon.findOne({ code: previousCouponCode });
    const minimumAmount = Number(coupon?.minOrderAmount || 0);
    const couponExpired = Boolean(coupon?.expiresAt && new Date(coupon.expiresAt) < new Date());
    const couponInactive = Boolean(!coupon || !coupon.isActive || couponExpired);
    const belowMinimum = activeSubtotal < minimumAmount;

    if (couponInactive || belowMinimum) {
      order.coupon = { code: "", discount: 0 };
      order.discount = 0;
      couponMessage = belowMinimum && minimumAmount > 0
        ? `Coupon removed because remaining product total is Rs. ${activeSubtotal}, below minimum purchase of Rs. ${minimumAmount}.`
        : "Coupon removed because it is no longer valid.";

      if (coupon) {
        coupon.usedCount = Math.max(0, Number(coupon.usedCount || 0) - 1);
        await coupon.save();
      }
    } else {
      discount = calculateCouponDiscount(coupon, activeSubtotal);
      if (discount <= 0 || discount >= activeSubtotal) {
        order.coupon = { code: "", discount: 0 };
        order.discount = 0;
        couponMessage = `Coupon removed because it is no longer applicable for remaining product total of Rs. ${activeSubtotal}.`;
        coupon.usedCount = Math.max(0, Number(coupon.usedCount || 0) - 1);
        await coupon.save();
      } else {
        order.coupon = { code: coupon.code, discount };
        order.discount = discount;
      }
    }
  } else {
    order.coupon = { code: "", discount: 0 };
    order.discount = 0;
  }

  order.subtotal = activeSubtotal;
  order.shippingCharge = shippingCharge;
  order.grandTotal = Math.max(0, activeSubtotal + shippingCharge + tax - Number(order.discount || 0));

  return {
    previousGrandTotal,
    refundDelta: Math.max(0, previousGrandTotal - Number(order.grandTotal || 0)),
    couponMessage
  };
};

export const getOrdersService = async (userId, search = "", page = 1, limit = 5) => {
  const query = { user: userId };

  if (search) {
    query.orderId = { $regex: search, $options: "i" };
  }

  const totalOrders = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    orders,
    totalPages: Math.ceil(totalOrders / limit)
  };
};

export const getOrderDetailService = async (userId, orderId) => {
  return Order.findOne({ _id: orderId, user: userId })
    .populate("user", "name email")
    .lean();
};

export const clearOrderUserNoticeService = async (userId, orderId) => {
  await Order.updateOne(
    { _id: orderId, user: userId },
    { $set: { userNotice: "" } }
  );
};

export const cancelOrderService = async (userId, orderId, reason = "") => {
  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) {
    throw new Error("Order not found");
  }

  if (["out_for_delivery", "delivered", "cancelled", "cancellation_requested", "return_requested", "returned", "return_rejected"].includes(order.status)) {
    throw new Error("This order cannot be cancelled");
  }

  const trimmedReason = String(reason || "").trim();
  const hasShippedItem = order.items.some((item) =>
    item.status === "shipped" && !item.cancellationRejected
  );
  if (hasShippedItem && !trimmedReason) {
    throw new Error("Cancellation reason is required after shipping.");
  }

  for (const item of order.items) {
    if (["cancelled", "cancellation_requested"].includes(item.status) || item.cancellationRejected) continue;
    const needsAdminApproval = item.status === "shipped";
    item.status = needsAdminApproval ? "cancellation_requested" : "cancelled";
    item.cancellationReason = trimmedReason;
    item.stockRestored = false;
    item.restockVerifiedAt = null;
    if (!needsAdminApproval) {
      await restockOrderItem(item);
      item.refundAmount = item.refundAmount || item.subtotal;
      item.refundedAt = item.refundedAt || new Date();
    }
  }

  if (!order.items.some((item) => ["cancelled", "cancellation_requested"].includes(item.status))) {
    throw new Error("No cancellable items found for this order");
  }

  const hasCancellationRequest = order.items.some((item) => item.status === "cancellation_requested");
  const hasActiveItems = order.items.some((item) =>
    !["cancelled", "cancellation_requested", "returned", "return_rejected"].includes(item.status)
  );

  if (hasCancellationRequest) {
    order.status = hasActiveItems ? "partially_cancelled" : "cancellation_requested";
  } else {
    order.status = hasActiveItems ? "partially_cancelled" : "cancelled";
  }
  order.cancellationReason = trimmedReason;
  let couponMessage = "";
  if (order.status === "cancelled") {
    const recalculation = await revalidateOrderCouponAfterCancellation(order);
    couponMessage = recalculation.couponMessage;
    order.refundStatus = order.paymentMethod === "COD" ? "none" : "refunded";
    const fullRefundAmount = order.paymentMethod === "COD"
    ? Math.min(Number(order.walletAmountUsed || 0), recalculation.previousGrandTotal || Number(order.walletAmountUsed || 0))
    : recalculation.previousGrandTotal;

    order.items.forEach((item) => {
      if (item.status === "cancelled") {
        item.refundedAt = item.refundedAt || new Date();
      }
    });
    await refundCancelledOrder(order,fullRefundAmount,"Refund for cancelled order");
  } else if (hasCancellationRequest) {
    order.refundStatus = "pending";
  } else {
    const recalculation = await revalidateOrderCouponAfterCancellation(order);
    couponMessage = recalculation.couponMessage;
    order.refundStatus = order.paymentMethod === "COD" ? "none" : "refunded";
    await refundCancelledOrder(
      order,
      order.paymentMethod === "COD"
        ? Math.min(Number(order.walletAmountUsed || 0), recalculation.refundDelta)
        : recalculation.refundDelta,
      "Refund for cancelled order"
    );
  }
  await order.save();

  return { order, couponMessage };
};

export const cancelOrderItemService = async (userId, orderId, itemIndex, reason = "") => {
  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) {
    throw new Error("Order not found");
  }

  const index = Number(itemIndex);
  const item = order.items[index];

  if (!item) {
    throw new Error("Order item not found");
  }

  if (!canRequestCancellation(item)) {
    throw new Error("This item cannot be cancelled");
  }

  const needsAdminApproval = item.status === "shipped";
  const trimmedReason = String(reason || "").trim();
  if (needsAdminApproval && !trimmedReason) {
    throw new Error("Cancellation reason is required after shipping.");
  }

  item.status = needsAdminApproval ? "cancellation_requested" : "cancelled";
  item.cancellationReason = trimmedReason;
  item.stockRestored = false;
  item.restockVerifiedAt = null;

  if (!needsAdminApproval) {
    await restockOrderItem(item);
  }

  const activeItems = order.items.filter((orderItem) => !["cancelled", "cancellation_requested"].includes(orderItem.status));
  if (!activeItems.length) {
    order.status = needsAdminApproval ? "cancellation_requested" : "cancelled";
  } else if (order.items.some((orderItem) => orderItem.status === "cancellation_requested")) {
    order.status = "partially_cancelled";
  } else {
    order.status = "partially_cancelled";
  }

  order.refundStatus = needsAdminApproval
    ? "pending"
    : order.paymentMethod === "COD"
      ? "none"
      : "refunded";

  let couponMessage = "";
  if (!needsAdminApproval) {
    const recalculation = await revalidateOrderCouponAfterCancellation(order);
    couponMessage = recalculation.couponMessage;
    const isFullOrderCancellation = order.status === "cancelled";
    const immediateRefundAmount = isFullOrderCancellation && order.paymentMethod !== "COD"
      ? recalculation.previousGrandTotal
      : isFullOrderCancellation
        ? Math.min(Number(order.walletAmountUsed || 0), recalculation.previousGrandTotal)
        : order.paymentMethod === "COD"
          ? Math.min(Number(order.walletAmountUsed || 0), recalculation.refundDelta)
          : recalculation.refundDelta;

    item.refundAmount = immediateRefundAmount;
    item.refundedAt = immediateRefundAmount > 0 ? (item.refundedAt || new Date()) : item.refundedAt;
    await refundCancelledOrder(
      order,
      immediateRefundAmount,
      "Refund for cancelled item"
    );
  }

  await order.save();
  return { order, couponMessage };
};

export const returnOrderService = async (userId, orderId, reason = "") => {
  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "delivered") {
    throw new Error("Only delivered orders can be returned");
  }

  const trimmedReason = String(reason || "").trim();

  if (!trimmedReason) {
    throw new Error("Please provide a reason for the return request.");
  }

  if (trimmedReason.length < 5) {
    throw new Error("Return reason must be at least 5 characters long.");
  }

  order.status = "return_requested";
  order.cancellationReason = trimmedReason;

  for (const item of order.items) {
    if (["cancelled", "return_requested", "returned", "return_rejected"].includes(item.status)) continue;
    item.status = "return_requested";
    item.returnReason = trimmedReason;
    item.stockRestored = false;
    item.restockVerifiedAt = null;
  }

  await order.save();
  return order;
};

export const returnOrderItemService = async (userId, orderId, itemIndex, reason = "") => {
  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) {
    throw new Error("Order not found");
  }

  const index = Number(itemIndex);
  const item = order.items[index];

  if (!item) {
    throw new Error("Order item not found");
  }

  if (item.status !== "delivered") {
    throw new Error("Only delivered items can be returned");
  }

  const trimmedReason = String(reason || "").trim();

  if (!trimmedReason) {
    throw new Error("Please provide a reason for the return request.");
  }

  if (trimmedReason.length < 5) {
    throw new Error("Return reason must be at least 5 characters long.");
  }

  item.status = "return_requested";
  item.returnReason = trimmedReason;
  item.stockRestored = false;
  item.restockVerifiedAt = null;

  const allReturnRelated = order.items.every((orderItem) =>
    ["cancelled", "return_requested", "returned", "return_rejected"].includes(orderItem.status)
  );
  if (allReturnRelated) {
    order.status = "return_requested";
    order.cancellationReason = trimmedReason;
  }

  await order.save();
  return order;
};
