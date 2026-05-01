import Order from "../models/Order.js";
import Product from "../models/Product.js";

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

  if (["delivered", "cancelled", "returned"].includes(order.status)) {
    throw new Error("This order cannot be cancelled");
  }

  for (const item of order.items) {
    if (item.status === "cancelled") continue;

    const product = await Product.findById(item.product);
    if (!product) {
      continue;
    }

    const variant = (product.variants || []).find((v) => String(v.price) === String(item.price));
    if (variant) {
      variant.stock += item.quantity;
    }

    product.stock = (product.variants || []).reduce(
      (sum, v) => sum + (Number(v.stock) || 0),
      0
    );

    await product.save();
    item.status = "cancelled";
    item.cancellationReason = reason || "";
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

  if (["delivered", "cancelled", "returned"].includes(item.status)) {
    throw new Error("This item cannot be cancelled");
  }

  const product = await Product.findById(item.product);
  if (product) {
    const variant = (product.variants || []).find((v) => String(v.price) === String(item.price));
    if (variant) {
      variant.stock += item.quantity;
    }

    product.stock = (product.variants || []).reduce(
      (sum, variantItem) => sum + (Number(variantItem.stock) || 0),
      0
    );

    await product.save();
  }

  item.status = "cancelled";
  item.cancellationReason = reason || "";

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

  order.status = "returned";
  order.cancellationReason = reason.trim();

  for (const item of order.items) {
    item.status = "returned";
    item.returnReason = reason.trim();
  }

  await order.save();
  return order;
};
