import User from "../models/User.js";

export const getUserManagement = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

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

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalUsers / limit) || 1;

    res.render("admin/usermanagement", {
      users,
      admin: req.admin,
      search,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.log(error, "pagination error in the admin usermanagement controller");
    res.redirect("/api/admin/adminusermanagement");
  }
};
