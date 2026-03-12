import User from "../../models/User.js";

const userAuth = async (req, res, next) => {
  try {
    const sessionUser = req.session.user;

    if (!sessionUser?.id) {
      return res.redirect("/api/auth/login");
    }

    const user = await User.findById(sessionUser.id);

    if (!user || user.isBlocked) {
      req.session.user = null;
      return res.redirect("/api/auth/login");
    }

    req.user = user;
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      isBlocked: user.isBlocked,
    };

    next();
  } catch (error) {
    console.log("User auth middleware error:", error);
    req.session.user = null;
    return res.redirect("/api/auth/login");
  }
};

export default userAuth;
