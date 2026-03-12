import express from "express"
import loginUser from "../../controllers/loginController.js"
import blockAuthPages from "../../middleware/user/blockAuth.middleware.js";
import noCache from "../../middleware/noCacheMiddleware.js";

const router=express.Router()

router.get("/login",noCache,blockAuthPages, (req, res) => {
  res.render("user/login", { error: null });
});

router.post('/login',loginUser)
export default router;