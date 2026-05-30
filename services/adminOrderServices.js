import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Coupon from "../models/Coupon.js";
import { creditWallet } from "./walletServices.js";
import { calculateCouponDiscount } from "./couponServices.js";

// Defines which statuses each order status can transition to
const STATUS_TRANSITIONS = {
  pending:              ["shipped", "cancelled"],
  shipped:              ["out_for_delivery", "cancelled"],
  out_for_delivery:     ["delivered", "cancelled"],
  delivered:            [],
  cancellation_requested:["cancelled"],
  return_requested:     ["returned", "return_rejected"],
  cancelled:            [],
  returned:             [],
  return_rejected:      []
};

const getAllowedStatusTransitions = (order) => {
  if (order.status !== "partially_cancelled") {
    return STATUS_TRANSITIONS[order.status] || [];
  }

  const activeStatuses = order.items
    .filter((item) => !["cancelled", "cancellation_requested", "returned", "return_rejected"].includes(item.status))
    .map((item) => item.status);

  if (activeStatuses.includes("out_for_delivery")) {
    return ["delivered", "cancelled"];
  }

  if (activeStatuses.includes("shipped")) {
    return ["out_for_delivery", "cancelled"];
  }

  if (activeStatuses.includes("pending")) {
    return ["shipped", "cancelled"];
  }

  return ["cancelled"];
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeSearchTerm = (value = "") => String(value).trim().replace(/\s+/g, " ");
const normalizeVariantValue = (value = "") => String(value || "").trim().toLowerCase();
const activeFinancialStatuses = new Set([
  "pending",
  "shipped",
  "out_for_delivery",
  "delivered",
  "return_requested",
  "return_rejected",
  "failed"
]);

const findRestockVariant = (product, item) => {
  const variants = product.variants || [];
  const size = normalizeVariantValue(item.size);
  const color = normalizeVariantValue(item.color);

  if (size || color) {
    const exactVariant = variants.find((variant) =>
      normalizeVariantValue(variant.size) === size &&
      normalizeVariantValue(variant.color) === color
    );

    if (exactVariant) {
      return exactVariant;
    }
  }

  return variants.find((variant) => String(variant.price) === String(item.price));
};

const restockOrderItem = async (item) => {
  if (!item?.product || item.stockRestored) {
    throw new Error("This item cannot be restocked.");
  }

  const product = await Product.findById(item.product);
  if (!product) {
    throw new Error("Product not found for this order item.");
  }

  const variant = findRestockVariant(product, item);
  if (variant) {
    variant.stock += Number(item.quantity) || 0;
  } else if (!product.variants?.length) {
    product.stock += Number(item.quantity) || 0;
  } else {
    throw new Error("Matching product variant not found for restock.");
  }

  if (product.variants?.length) {
    product.stock = product.variants.reduce(
      (sum, variantItem) => sum + (Number(variantItem.stock) || 0),
      0
    );
  }

  await product.save();
};

const getActiveOrderSubtotal = (order) =>
  order.items.reduce((sum, item) => {
    if (!activeFinancialStatuses.has(item.status)) return sum;
    return sum + (Number(item.subtotal) || 0);
  }, 0);

const revalidateOrderCouponAfterItemFinalization = async (order) => {
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

const getAlreadyRefundedAmount = (order) =>
  (order.items || []).reduce(
    (sum, item) => sum + (Number(item.refundAmount) || 0),
    0
  );

export const getAdminOrdersService = async ({
  search = "",
  status = "",
  sort = "newest",
  page = 1,
  limit = 8
} = {}) => {
  const query = {};
  const normalizedSearch = normalizeSearchTerm(search);

  if (status) {
    query.status = status;
  }

  if (normalizedSearch) {
    const searchPattern = new RegExp(escapeRegex(normalizedSearch), "i");
    const matchingUsers = await User.find({
      $or: [
        { name: searchPattern },
        { email: searchPattern }
      ]
    }).select("_id");

    const matchingUserIds = matchingUsers.map((user) => user._id);

    query.$or = [
      { orderId: searchPattern },
      ...(matchingUserIds.length ? [{ user: { $in: matchingUserIds } }] : [])
    ];
  }

  let sortOption = { createdAt: -1 };

  if (sort === "oldest") {
    sortOption = { createdAt: 1 };
  } else if (sort === "amount_high") {
    sortOption = { grandTotal: -1, createdAt: -1 };
  } else if (sort === "amount_low") {
    sortOption = { grandTotal: 1, createdAt: -1 };
  } else if (sort === "status_az") {
    sortOption = { status: 1, createdAt: -1 };
  }

  const skip = (page - 1) * limit;

  const [orders, totalOrders] = await Promise.all([
    Order.find(query)
      .populate("user", "name email")
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(query)
  ]);

  return {
    orders,
    totalOrders,
    totalPages: Math.max(1, Math.ceil(totalOrders / limit))
  };
};

export const getAdminOrderByIdService = async (id) => {
  const order = await Order.findById(id)
    .populate("user", "name email")
    .lean();

  if (!order) {
    throw new Error("Order not found");
  }

  return order;
};

export const updateAdminOrderStatusService = async (id, status) => {
  const order = await Order.findById(id);

  if (!order) {
    throw new Error("Order not found");
  }

  const allowedTransitions = getAllowedStatusTransitions(order);

  if (!allowedTransitions.length) {
    throw new Error(`Orders with status "${order.status}" cannot be changed.`);
  }

  if (!allowedTransitions.includes(status)) {
    throw new Error(
      `Cannot change status from "${order.status}" to "${status}". Allowed: ${allowedTransitions.join(", ")}.`
    );
  }

  if (status === "cancelled") {
    const currentGrandTotal = Number(order.grandTotal || 0);
    const alreadyRefundedAmount = getAlreadyRefundedAmount(order);
    const fullWalletUsage = Number(order.walletAmountUsed || 0);

    for (const item of order.items) {
      if (item.status === "cancelled") continue;

      if (!item.stockRestored && !["return_requested", "returned"].includes(item.status)) {
        await restockOrderItem(item);
        item.stockRestored = true;
        item.restockVerifiedAt = new Date();
      }

      item.status = "cancelled";
    }

    let refundAmount = 0;
    if (order.paymentMethod === "COD") {
      refundAmount = Math.max(0, Math.min(currentGrandTotal, fullWalletUsage - alreadyRefundedAmount));
    } else {
      refundAmount = Math.max(0, currentGrandTotal);
    }

    if (refundAmount > 0) {
      await creditWallet(
        order.user,
        refundAmount,
        "Refund for admin cancelled order",
        order._id
      );
    }

    order.items.forEach((item) => {
      if (!item.refundedAt) {
        item.refundedAt = refundAmount > 0 ? new Date() : item.refundedAt;
      }
    });

    order.status = "cancelled";
    order.refundStatus = refundAmount > 0 ? "refunded" : "none";
    await order.save();
    return order;
  }

  order.status = status;

  for (const item of order.items) {
    if (["cancelled", "cancellation_requested", "return_requested", "returned", "return_rejected"].includes(item.status)) {
      continue;
    }
    item.status = status;
  }

  await order.save();
  return order;
};

export const verifyAndRestockOrderItemService = async (id, itemIndex) => {
  const order = await Order.findById(id);

  if (!order) {
    throw new Error("Order not found");
  }

  const index = Number(itemIndex);
  const item = order.items[index];

  if (!item) {
    throw new Error("Order item not found");
  }

  if (!["cancelled", "cancellation_requested", "return_requested", "returned"].includes(item.status)) {
    throw new Error("Only cancelled, cancellation-requested, or return-requested items can be restocked after verification.");
  }

  if (item.stockRestored) {
    throw new Error("This item has already been restocked.");
  }

  await restockOrderItem(item);
  if (item.status === "cancellation_requested") {
    item.status = "cancelled";
  }
  if (item.status === "return_requested") {
    item.status = "returned";
  }
  item.stockRestored = true;
  item.restockVerifiedAt = new Date();

  const recalculation = await revalidateOrderCouponAfterItemFinalization(order);
  const refundDelta = recalculation.refundDelta;
  if (recalculation.couponMessage) {
    order.userNotice = recalculation.couponMessage;
  }

  const orderWillBeFullyCancelledAfterVerify = order.items.every((orderItem, orderItemIndex) => {
    if (orderItemIndex === index) return true;
    return orderItem.status === "cancelled";
  });

  const acceptedRefundAmount = orderWillBeFullyCancelledAfterVerify && order.paymentMethod !== "COD"
    ? recalculation.previousGrandTotal
    : orderWillBeFullyCancelledAfterVerify
      ? Math.min(Number(order.walletAmountUsed || 0), recalculation.previousGrandTotal)
      : order.paymentMethod === "COD"
        ? Math.min(Number(order.walletAmountUsed || 0), refundDelta)
        : refundDelta;

  item.refundAmount = acceptedRefundAmount;
  item.refundedAt = acceptedRefundAmount > 0 ? (item.refundedAt || new Date()) : item.refundedAt;

  if (acceptedRefundAmount > 0 && (order.paymentMethod !== "COD" || Number(order.walletAmountUsed || 0) > 0)) {
    await creditWallet(
      order.user,
      acceptedRefundAmount,
      item.status === "returned" ? "Refund for accepted return" : "Refund for accepted cancellation",
      order._id
    );
  }

  const returnItems = order.items.filter((orderItem) =>
    ["return_requested", "returned", "return_rejected"].includes(orderItem.status)
  );
  if (returnItems.length && returnItems.every((orderItem) => orderItem.status === "returned")) {
    order.status = "returned";
    order.refundStatus = "refunded";
  }

  const cancellationItems = order.items.filter((orderItem) =>
    ["cancelled", "cancellation_requested"].includes(orderItem.status)
  );
  if (cancellationItems.length) {
    if (order.items.every((orderItem) => orderItem.status === "cancelled")) {
      order.status = "cancelled";
      order.refundStatus = order.paymentMethod === "COD" ? "none" : "refunded";
    } else if (order.items.some((orderItem) => orderItem.status === "cancellation_requested")) {
      order.status = "partially_cancelled";
      order.refundStatus = "pending";
    } else if (order.status !== "returned") {
      order.status = "partially_cancelled";
    }
  }

  await order.save();
  return {
    order,
    couponMessage: recalculation.couponMessage
  };
};

export const rejectCancellationRequestService = async (id, itemIndex) => {
  const order = await Order.findById(id);

  if (!order) {
    throw new Error("Order not found");
  }

  const index = Number(itemIndex);
  const item = order.items[index];

  if (!item) {
    throw new Error("Order item not found");
  }

  if (item.status !== "cancellation_requested") {
    throw new Error("Only pending cancellation requests can be rejected.");
  }

  item.status = "shipped";
  item.cancellationRejected = true;
  item.stockRestored = false;
  item.restockVerifiedAt = null;

  const nonCancelledStatuses = order.items
    .filter((orderItem) => !["cancelled", "returned", "return_rejected"].includes(orderItem.status))
    .map((orderItem) => orderItem.status);

  if (nonCancelledStatuses.includes("cancellation_requested")) {
    order.status = "partially_cancelled";
    order.refundStatus = "pending";
  } else if (nonCancelledStatuses.includes("out_for_delivery")) {
    order.status = "out_for_delivery";
    order.refundStatus = "none";
  } else if (nonCancelledStatuses.includes("shipped")) {
    order.status = order.items.some((orderItem) => orderItem.status === "cancelled")
      ? "partially_cancelled"
      : "shipped";
    order.refundStatus = "none";
  } else {
    order.status = "pending";
    order.refundStatus = "none";
  }

  await order.save();
  return order;
};

export const rejectReturnRequestService = async (id, itemIndex) => {
  const order = await Order.findById(id);

  if (!order) {
    throw new Error("Order not found");
  }

  const index = Number(itemIndex);
  const item = order.items[index];

  if (!item) {
    throw new Error("Order item not found");
  }

  if (item.status !== "return_requested") {
    throw new Error("Only pending return requests can be rejected.");
  }

  item.status = "return_rejected";
  item.stockRestored = false;
  item.restockVerifiedAt = null;

  const returnItems = order.items.filter((orderItem) =>
    ["return_requested", "returned", "return_rejected"].includes(orderItem.status)
  );

  if (returnItems.length && returnItems.every((orderItem) => orderItem.status === "return_rejected")) {
    order.status = "return_rejected";
  }

  await order.save();
  return order;
};
