import Coupon from "../models/Coupon.js";

const normalizeCode = (code = "") => String(code).trim().toUpperCase();

const parseCouponExpiry = (rawValue) => {
  if (!rawValue) return null;

  const expiry = new Date(rawValue);
  if (Number.isNaN(expiry.getTime())) {
    return null;
  }

  expiry.setHours(23, 59, 59, 999);
  return expiry;
};

export const calculateCouponDiscount = (coupon, subtotal) => {
  const amount = Number(subtotal) || 0;
  if (!coupon || amount <= 0) return 0;

  let discount = coupon.discountType === "percentage"
    ? Math.floor((amount * Number(coupon.discountValue || 0)) / 100)
    : Number(coupon.discountValue || 0);

  if (coupon.maxDiscount > 0) {
    discount = Math.min(discount, coupon.maxDiscount);
  }

  return Math.min(Math.max(0, discount), amount);
};

const validateCouponSetup = ({ discountType, discountValue, maxDiscount, minOrderAmount }) => {
  const minAmount = Math.max(0, Number(minOrderAmount) || 0);
  const maxCap = Math.max(0, Number(maxDiscount) || 0);

  if (discountType === "flat") {
    if (minAmount > 0 && discountValue >= minAmount) {
      throw new Error("Minimum order amount must be greater than flat discount value");
    }
    return;
  }

  if (maxCap > 0 && minAmount > 0 && maxCap >= minAmount) {
    throw new Error("Minimum order amount must be greater than max discount amount");
  }
};

export const createCouponService = async (data = {}) => {
  const code = normalizeCode(data.code);
  if (!code) throw new Error("Coupon code required");

  const discountType = data.discountType === "percentage" ? "percentage" : "flat";
  const discountValue = Number(data.discountValue);

  if (!discountValue || discountValue < 1) {
    throw new Error("Discount value must be greater than zero");
  }

  if (discountType === "percentage" && discountValue > 90) {
    throw new Error("Percentage discount cannot exceed 90%");
  }

  const maxDiscount = Number(data.maxDiscount) || 0;
  const minOrderAmount = Number(data.minOrderAmount) || 0;

  validateCouponSetup({
    discountType,
    discountValue,
    maxDiscount,
    minOrderAmount
  });

  const exists = await Coupon.findOne({ code });
  if (exists) throw new Error("Coupon code already exists");

  return Coupon.create({
    code,
    description: data.description || "",
    discountType,
    discountValue,
    maxDiscount,
    minOrderAmount,
    usageLimit: Number(data.usageLimit) || 0,
    expiresAt: parseCouponExpiry(data.expiresAt),
    isActive: data.isActive !== "false"
  });
};

export const listCouponsService = async () => {
  return Coupon.find().sort({ createdAt: -1 }).lean();
};

export const getCouponByIdService = async (id) => Coupon.findById(id);

export const updateCouponService = async (id, data = {}) => {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw new Error("Coupon not found");

  const code = normalizeCode(data.code);
  if (!code) throw new Error("Coupon code required");

  const discountType = data.discountType === "percentage" ? "percentage" : "flat";
  const discountValue = Number(data.discountValue);

  if (!discountValue || discountValue < 1) {
    throw new Error("Discount value must be greater than zero");
  }

  if (discountType === "percentage" && discountValue > 90) {
    throw new Error("Percentage discount cannot exceed 90%");
  }

  const maxDiscount = Number(data.maxDiscount) || 0;
  const minOrderAmount = Number(data.minOrderAmount) || 0;

  validateCouponSetup({
    discountType,
    discountValue,
    maxDiscount,
    minOrderAmount
  });

  const exists = await Coupon.findOne({ code, _id: { $ne: id } });
  if (exists) throw new Error("Coupon code already exists");

  coupon.code = code;
  coupon.description = data.description || "";
  coupon.discountType = discountType;
  coupon.discountValue = discountValue;
  coupon.maxDiscount = maxDiscount;
  coupon.minOrderAmount = minOrderAmount;
  coupon.usageLimit = Number(data.usageLimit) || 0;
  coupon.expiresAt = parseCouponExpiry(data.expiresAt);
  coupon.isActive = data.isActive !== "false";
  coupon.updatedAtAdmin = new Date();

  await coupon.save();
  return coupon;
};

export const deleteCouponService = async (id) => {
  return Coupon.findByIdAndDelete(id);
};

export const listAvailableCouponsForCheckout = async (subtotal = 0) => {
  const now = new Date();
  const amount = Number(subtotal) || 0;
  const coupons = await Coupon.find({
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }]
  })
    .sort({ createdAt: -1 })
    .lean();

  return coupons.filter((coupon) => {
    const withinUsageLimit =
      Number(coupon.usageLimit || 0) <= 0 ||
      Number(coupon.usedCount || 0) < Number(coupon.usageLimit || 0);
    const meetsMinimum = Number(coupon.minOrderAmount || 0) <= amount;
    return withinUsageLimit && meetsMinimum;
  });
};

export const validateCouponForCheckout = async (code = "", subtotal = 0) => {
  const normalizedCode = normalizeCode(code);
  const orderSubtotal = Number(subtotal) || 0;

  if (!normalizedCode) {
    return { coupon: null, discount: 0 };
  }

  const coupon = await Coupon.findOne({ code: normalizedCode });

  if (!coupon) {
    throw new Error("Invalid coupon code");
  }

  if (!coupon.isActive) {
    throw new Error("Coupon is inactive");
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    throw new Error("Coupon expired");
  }

  if (Number(coupon.minOrderAmount || 0) > orderSubtotal) {
    throw new Error(`Coupon requires minimum order amount of Rs. ${Number(coupon.minOrderAmount || 0)}`);
  }

  if (Number(coupon.usageLimit || 0) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit || 0)) {
    throw new Error("Coupon usage limit reached");
  }

  const discount = calculateCouponDiscount(coupon, orderSubtotal);

  if (discount <= 0) {
    throw new Error("Coupon not applicable for this order");
  }

  if (discount >= orderSubtotal) {
    throw new Error("Coupon discount cannot be equal to or greater than order amount");
  }

  return {
    coupon,
    discount
  };
};
