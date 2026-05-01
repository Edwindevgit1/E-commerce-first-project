import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

const ADMIN_ORDER_STATUSES = new Set([
  "pending",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled"
]);

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeSearchTerm = (value = "") => String(value).trim().replace(/\s+/g, " ");

const restockOrderItem = async (item) => {
  if (!item?.product || item.status === "cancelled") {
    return;
  }

  const product = await Product.findById(item.product);
  if (!product) {
    return;
  }

  const variant = (product.variants || []).find((v) => String(v.price) === String(item.price));
  if (variant) {
    variant.stock += Number(item.quantity) || 0;
  }

  product.stock = (product.variants || []).reduce(
    (sum, variantItem) => sum + (Number(variantItem.stock) || 0),
    0
  );

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
  if (!ADMIN_ORDER_STATUSES.has(status)) {
    throw new Error("Select a valid order status.");
  }

  const order = await Order.findById(id);

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status === "returned" && status !== "returned") {
    throw new Error("Returned orders cannot be changed.");
  }

  if (order.status === "cancelled" && status !== "cancelled") {
    throw new Error("Cancelled orders cannot be changed.");
  }

  if (status === "cancelled" && order.status !== "cancelled") {
    for (const item of order.items) {
      if (item.status !== "cancelled") {
        await restockOrderItem(item);
        item.status = "cancelled";
      }
    }
    order.status = "cancelled";
    await order.save();
    return order;
  }

  order.status = status;

  for (const item of order.items) {
    if (item.status === "cancelled" || item.status === "returned") {
      continue;
    }
    item.status = status;
  }

  await order.save();
  return order;
};
