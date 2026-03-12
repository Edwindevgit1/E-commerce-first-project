import express from "express";
import noCache from "../../middleware/noCacheMiddleware.js";
import { loadHome } from "../../controllers/homeController.js";
import userAuth from "../../middleware/user/userauth.middleware.js";
const router=express.Router()

router.get('/home',noCache,userAuth,loadHome)

export default router 
