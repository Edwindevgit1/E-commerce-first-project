import express from "express"
import User from "../../models/User.js";
import adminMiddleware from "../../middleware/adminauthmiddleware.js";

const router=express.Router()

// User Management (Search + Clear + Sort)
router.get('/adminusermanagement',adminMiddleware, async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;   // current page
    const limit = 5;                              // users per page
    const skip = (page - 1) * limit;

    let query = { role: "user" };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    const totalUsers = await User.countDocuments(query);

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalUsers / limit);

    res.render("admin/usermanagement", {
      users,
      search,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.log(error, "pagination error");
    res.redirect("/api/admin/adminusermanagement");
  }
});
export default router