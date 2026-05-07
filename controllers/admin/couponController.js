import {
  createCouponService,
  deleteCouponService,
  listCouponsService
} from "../../services/couponServices.js";

export const getCouponsController = async (req, res) => {
  const coupons = await listCouponsService();

  return res.render("admin/coupon-management", {
    coupons,
    message: req.query.message || null,
    error: req.query.error || null
  });
};

export const createCouponController = async (req, res) => {
  try {
    await createCouponService(req.body);
    return res.redirect("/api/admin/coupons?message=Coupon created");
  } catch (error) {
    return res.redirect(
      `/api/admin/coupons?error=${encodeURIComponent(error.message || "Unable to create coupon")}`
    );
  }
};

export const deleteCouponController = async (req, res) => {
  try {
    await deleteCouponService(req.params.id);
    return res.redirect("/api/admin/coupons?message=Coupon deleted");
  } catch (error) {
    return res.redirect("/api/admin/coupons?error=Unable to delete coupon");
  }
};
