import Order from "../models/Order.js";

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

  if (["delivered", "cancelled", "return_requested", "returned", "return_rejected"].includes(order.status)) {
    throw new Error("This order cannot be cancelled");
  }

  for (const item of order.items) {
    if (item.status === "cancelled") continue;
    item.status = "cancelled";
    item.cancellationReason = reason || "";
    item.stockRestored = false;
    item.restockVerifiedAt = null;
  }

  order.status = "cancelled";
  order.cancellationReason = reason || "";
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

  if (["delivered", "cancelled", "return_requested", "returned", "return_rejected"].includes(item.status)) {
    throw new Error("This item cannot be cancelled");
  }

  item.status = "cancelled";
  item.cancellationReason = reason || "";
  item.stockRestored = false;
  item.restockVerifiedAt = null;

  const activeItems = order.items.filter((orderItem) => orderItem.status !== "cancelled");
  if (!activeItems.length) {
    order.status = "cancelled";
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

  if (!String(reason).trim()) {
    throw new Error("Return reason is required");
  }

  order.status = "return_requested";
  order.cancellationReason = reason.trim();

  for (const item of order.items) {
    item.status = "return_requested";
    item.returnReason = reason.trim();
    item.stockRestored = false;
    item.restockVerifiedAt = null;
  }

  await order.save();
  return order;
};
