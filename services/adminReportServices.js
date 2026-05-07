import Order from "../models/Order.js";
import User from "../models/User.js";

const getDateRange = ({ filter = "daily", startDate, endDate } = {}) => {
  const now = new Date();
  let start;
  let end = new Date();

  if (filter === "weekly") {
    start = new Date();
    start.setDate(now.getDate() - 7);
  } else if (filter === "yearly") {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (filter === "custom" && startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const getOrderAmount = (order) =>
  Number(order.grandTotal) ||
  ((Number(order.subtotal) || 0) +
    (Number(order.shippingCharge) || 0) +
    (Number(order.tax) || 0) -
    (Number(order.discount) || 0));

export const getSalesReportService = async (query = {}) => {
  const { start, end } = getDateRange(query);

  const orders = await Order.find({
    createdAt: { $gte: start, $lte: end },
    status: { $nin: ["cancelled", "returned", "return_rejected"] }
  })
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .lean();

  const totals = orders.reduce(
    (acc, order) => {
      const orderAmount = getOrderAmount(order);
      acc.salesCount += 1;
      acc.orderAmount += orderAmount;
      acc.discount += Number(order.discount) || 0;
      acc.couponDiscount += Number(order.coupon?.discount) || 0;
      return acc;
    },
    {
      salesCount: 0,
      orderAmount: 0,
      discount: 0,
      couponDiscount: 0
    }
  );

  return { orders, totals, start, end };
};

export const getDashboardService = async (period = "monthly", options = {}) => {
  const format = period === "yearly" ? "%Y" : period === "weekly" ? "%Y-%U" : "%Y-%m";
  const recentPageSize = 5;
  const requestedRecentPage = Math.max(parseInt(options.recentPage, 10) || 1, 1);
  const now = new Date();
  let startDate = null;

  if (period === "weekly") {
    startDate = new Date();
    startDate.setDate(now.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "yearly") {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const validSalesStatuses = { $nin: ["cancelled", "returned", "return_rejected"] };
  const dashboardMatch = {
    status: validSalesStatuses,
    createdAt: { $gte: startDate, $lte: now }
  };

  const chart = await Order.aggregate([
    { $match: dashboardMatch },
    {
      $group: {
        _id: { $dateToString: { format, date: "$createdAt" } },
        sales: { $sum: "$grandTotal" },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const bestProducts = await Order.aggregate([
    { $unwind: "$items" },
    {
      $match: {
        createdAt: { $gte: startDate, $lte: now },
        "items.status": { $nin: ["cancelled", "returned", "return_rejected"] }
      }
    },
    {
      $group: {
        _id: "$items.productName",
        qty: { $sum: "$items.quantity" },
        amount: { $sum: "$items.subtotal" }
      }
    },
    { $sort: { qty: -1 } },
    { $limit: 10 }
  ]);

  const bestCategories = await Order.aggregate([
    { $unwind: "$items" },
    {
      $match: {
        createdAt: { $gte: startDate, $lte: now },
        "items.status": { $nin: ["cancelled", "returned", "return_rejected"] }
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "items.product",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "categories",
        localField: "product.category",
        foreignField: "_id",
        as: "category"
      }
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ["$category.name", "Uncategorized"] },
        qty: { $sum: "$items.quantity" },
        amount: { $sum: "$items.subtotal" }
      }
    },
    { $sort: { qty: -1 } },
    { $limit: 10 }
  ]);

  const bestBrands = await Order.aggregate([
    { $unwind: "$items" },
    {
      $match: {
        createdAt: { $gte: startDate, $lte: now }
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "items.product",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: "$product" },
    {
      $group: {
        _id: "$product.brand",
        qty: { $sum: "$items.quantity" }
      }
    },
    { $match: { _id: { $ne: "" } } },
    { $sort: { qty: -1 } },
    { $limit: 10 }
  ]);

  const [totalUsers, totalOrders, allOrders, refundCount, recentOrderCount, weeklyChart] = await Promise.all([
    User.countDocuments({ role: "user" }),
    Order.countDocuments(),
    Order.find(dashboardMatch).select("grandTotal subtotal shippingCharge tax discount").lean(),
    Order.countDocuments({ status: { $in: ["cancelled", "returned"] } }),
    Order.countDocuments(),
    Order.aggregate([
      {
        $match: dashboardMatch
      },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" },
          sales: { $sum: "$grandTotal" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  const revenue = allOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);
  const recentTotalPages = Math.max(1, Math.ceil(recentOrderCount / recentPageSize));
  const safeRecentPage = Math.min(requestedRecentPage, recentTotalPages);
  const recentOrders = await Order.find()
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .skip((safeRecentPage - 1) * recentPageSize)
    .limit(recentPageSize)
    .lean();

  return {
    chart,
    bestProducts,
    bestCategories,
    bestBrands,
    stats: {
      totalUsers,
      totalOrders,
      revenue,
      refunds: refundCount
    },
    recentOrders,
    recentPagination: {
      currentPage: safeRecentPage,
      totalPages: recentTotalPages,
      hasPrev: safeRecentPage > 1,
      hasNext: safeRecentPage < recentTotalPages
    },
    weeklyChart
  };
};
