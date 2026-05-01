import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

// Defines which statuses each order status can transition to
const STATUS_TRANSITIONS = {
  pending:          ["shipped", "cancelled"],
  shipped:          ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered:        ["return_requested"],
  return_requested: ["returned", "return_rejected"],
  cancelled:        [],
  returned:         [],
  return_rejected:  []
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

  const allowedTransitions = STATUS_TRANSITIONS[order.status] || [];

  if (!allowedTransitions.length) {
    throw new Error(`Orders with status "${order.status}" cannot be changed.`);
  }

  if (!allowedTransitions.includes(status)) {
    throw new Error(
      `Cannot change status from "${order.status}" to "${status}". Allowed: ${allowedTransitions.join(", ")}.`
    );
  }

  if (order.status === "return_requested" && ["returned", "return_rejected"].includes(status)) {
    throw new Error("Accept or reject the return request from the order detail page.");
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
    if (["cancelled", "return_requested", "returned", "return_rejected"].includes(item.status)) {
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

  if (!["cancelled", "return_requested", "returned"].includes(item.status)) {
    throw new Error("Only cancelled or return-requested items can be restocked after verification.");
  }

  if (item.stockRestored) {
    throw new Error("This item has already been restocked.");
  }

  await restockOrderItem(item);
  if (item.status === "return_requested") {
    item.status = "returned";
  }
  item.stockRestored = true;
  item.restockVerifiedAt = new Date();

  const returnItems = order.items.filter((orderItem) =>
    ["return_requested", "returned", "return_rejected"].includes(orderItem.status)
  );
  if (returnItems.length && returnItems.every((orderItem) => orderItem.status === "returned")) {
    order.status = "returned";
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
