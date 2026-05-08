import Coupon from "../models/Coupon.js";

const normalizeCode = (code = "") => String(code).trim().toUpperCase();

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

  const exists = await Coupon.findOne({ code });
  if (exists) throw new Error("Coupon code already exists");

  return Coupon.create({
    code,
    description: data.description || "",
    discountType,
    discountValue,
    maxDiscount: Number(data.maxDiscount) || 0,
    minOrderAmount: Number(data.minOrderAmount) || 0,
    usageLimit: Number(data.usageLimit) || 0,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    isActive: data.isActive !== "false"
  });
};

export const listCouponsService = async () => {
  return Coupon.find().sort({ createdAt: -1 }).lean();
};

export const deleteCouponService = async (id) => {
  return Coupon.findByIdAndDelete(id);
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

  return {
    coupon,
    discount: calculateCouponDiscount(coupon, orderSubtotal)
  };
};
