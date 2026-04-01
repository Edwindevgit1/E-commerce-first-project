import User from "../../models/User.js";

const isPublicUserPage = (path = "") =>
  path === "/api/auth/home" ||
  path === "/api/user/products" ||
  /^\/api\/user\/products\/[^/]+$/.test(path);

const runtimeUserCheck = async (req, res, next) => {
  const currentPath = (req.originalUrl || req.path || "").split("?")[0];
  const isPublicPage = isPublicUserPage(currentPath);

  try {
    const sessionUser = req.session?.user;

    if (!sessionUser?.id) {
      return next();
    }

    const user = await User.findById(sessionUser.id);

    if (!user || user.isBlocked) {
      req.session.user = null;
      if (isPublicPage) {
        return next();
      }
      return res.redirect("/api/auth/login");
    }

    if (isPublicPage) {
      return next();
    }

    if (!req.user) {
      req.user = user;
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      isBlocked: user.isBlocked
    };

    next();
  } catch (error) {
    console.log("Runtime user check error:", error);
    req.session.user = null;
    if (isPublicPage) {
      return next();
    }
    return res.redirect("/api/auth/login");
  }
};

export default runtimeUserCheck;
