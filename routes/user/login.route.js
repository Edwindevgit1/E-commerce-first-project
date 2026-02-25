import express from "express"
import loginUser from "../../controllers/loginController.js"

const router=express.Router()

router.get("/login", (req, res) => {
  res.render("user/login", { error: null });
});

router.post('/login',loginUser)
export default router;