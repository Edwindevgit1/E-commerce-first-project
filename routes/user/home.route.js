import express from "express";
import noCache from "../../middleware/noCacheMiddleware.js";
import { loadHome } from "../../controllers/homeController.js";
const router=express.Router()

router.get('/home',noCache,loadHome)

export default router 