import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { creditWallet } from "./walletServices.js";

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

export const cancelOrderService = async (userId, orderId, reason = "") => {
  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) {
    throw new Error("Order not found");
  }

  if (["out_for_delivery", "delivered", "cancelled", "cancellation_requested", "return_requested", "returned", "return_rejected"].includes(order.status)) {
    throw new Error("This order cannot be cancelled");
  }

  for (const item of order.items) {
    if (["cancelled", "cancellation_requested"].includes(item.status) || item.cancellationRejected) continue;
    item.status = item.status === "shipped" ? "cancellation_requested" : "cancelled";
    item.cancellationReason = reason || "";
    item.stockRestored = false;
    item.restockVerifiedAt = null;
    if (item.status === "cancelled") {
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
  order.cancellationReason = reason || "";
  if (order.status === "cancelled") {
    order.refundStatus = order.paymentMethod === "COD" ? "none" : "refunded";
    const fullRefundAmount = order.paymentMethod === "COD"
    ? Number(order.walletAmountUsed || 0)
    : Math.max(Number(order.grandTotal || 0), Number(order.walletAmountUsed || 0));
    await refundCancelledOrder(order,fullRefundAmount,"Refund for cancelled order");
  } else {
    order.refundStatus = "pending";
  }
  await order.save();

  return order;
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
  item.status = needsAdminApproval ? "cancellation_requested" : "cancelled";
  item.cancellationReason = reason || "";
  item.stockRestored = false;
  item.restockVerifiedAt = null;

  if (!needsAdminApproval) {
    item.refundAmount = item.refundAmount || item.subtotal;
    item.refundedAt = item.refundedAt || new Date();
    const itemRefundAmount = order.paymentMethod === "COD"
    ? Math.min(Number(order.walletAmountUsed || 0),item.subtotal)
    : item.subtotal;
    await refundCancelledOrder(order,itemRefundAmount,"Refund for cancelled item");
  }

  const activeItems = order.items.filter((orderItem) => !["cancelled", "cancellation_requested"].includes(orderItem.status));
  if (!activeItems.length) {
    order.status = needsAdminApproval ? "cancellation_requested" : "cancelled";
  } else if (order.items.some((orderItem) => orderItem.status === "cancellation_requested")) {
    order.status = "partially_cancelled";
  } else {
    order.status = "partially_cancelled";
  }

  await order.save();
  return order;
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
