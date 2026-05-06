import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { creditWallet } from "./walletServices.js";

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
    for (const item of order.items) {
      if (item.status !== "cancelled") {
        item.status = "cancelled";
        item.stockRestored = false;
        item.restockVerifiedAt = null;
      }
    }
    order.status = "cancelled";
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
    item.refundAmount = item.refundAmount || item.subtotal;
    item.refundedAt = item.refundedAt || new Date();

    if (order.paymentMethod !== "COD" || Number(order.walletAmountUsed || 0) > 0) {
      await creditWallet(
        order.user,
        item.refundAmount,
        "Refund for accepted cancellation",
        order._id
      );
    }
  }
  if (item.status === "return_requested") {
    item.status = "returned";
    item.refundAmount = item.refundAmount || item.subtotal;
    item.refundedAt = item.refundedAt || new Date();

    await creditWallet(
      order.user,
      item.refundAmount,
      "Refund for accepted return",
      order._id
    )
  }
  item.stockRestored = true;
  item.restockVerifiedAt = new Date();

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
  return order;
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
