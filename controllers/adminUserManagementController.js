import User from "../models/User.js";
import {
  ensureUserReferralCode,
  regenerateUserReferralCode,
  resetUserReferralState,
  suspendUserReferral
} from "../services/referralServices.js";

const buildPagination = (currentPage, totalPages) => {
  const items = [];
  const startPage = Math.max(1, currentPage - 1);
  const endPage = Math.min(totalPages, currentPage + 1);

  for (let page = startPage; page <= endPage; page += 1) {
    items.push(page);
  }

  return items;
};

export const getUserManagement = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const limit = 5;

    const query = {};

    if (req.admin?.role === "admin") {
      query.role = "user";
    } else if (req.admin?.role === "superadmin") {
      query.role = { $in: ["user", "admin"] };
    } else {
      return res.redirect("/api/admin/adminlogin");
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit) || 1;
    const currentPage = Math.min(
      Math.max(parseInt(req.query.page, 10) || 1, 1),
      totalPages
    );
    const skip = (currentPage - 1) * limit;

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    await Promise.all(users.map((user) => ensureUserReferralCode(user)));

    res.render("admin/usermanagement", {
      users,
      admin: req.admin,
      search,
      currentPage,
      totalPages,
      paginationItems: buildPagination(currentPage, totalPages),
    });
  } catch (error) {
    console.log(error, "pagination error in the admin usermanagement controller");
    res.redirect("/api/admin/adminusermanagement");
  }
};

export const resetUserReferralController = async (req, res) => {
  try {
    await resetUserReferralState(req.params.id);
    return res.redirect("/api/admin/adminusermanagement");
  } catch (error) {
    console.log(error, "reset user referral error");
    return res.redirect("/api/admin/adminusermanagement");
  }
};

export const regenerateUserReferralCodeController = async (req, res) => {
  try {
    await regenerateUserReferralCode(req.params.id);
    return res.redirect("/api/admin/adminusermanagement");
  } catch (error) {
    console.log(error, "regenerate user referral code error");
    return res.redirect("/api/admin/adminusermanagement");
  }
};

export const suspendUserReferralController = async (req, res) => {
  try {
    await suspendUserReferral(req.params.id, true);
    return res.redirect("/api/admin/adminusermanagement");
  } catch (error) {
    console.log(error, "suspend user referral error");
    return res.redirect("/api/admin/adminusermanagement");
  }
};

export const resumeUserReferralController = async (req, res) => {
  try {
    await suspendUserReferral(req.params.id, false);
    return res.redirect("/api/admin/adminusermanagement");
  } catch (error) {
    console.log(error, "resume user referral error");
    return res.redirect("/api/admin/adminusermanagement");
  }
};
