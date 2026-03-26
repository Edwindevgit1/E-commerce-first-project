import express from 'express'
import { addCategoryController, editCategoryController, getCategoryController, softdeleteCategoryController } from '../../controllers/admin/categoryController.js'
import adminMiddleware from '../../middleware/adminauthmiddleware.js';
import noCache from '../../middleware/noCacheMiddleware.js';

const router = express.Router()

router.get('/category',noCache,adminMiddleware,getCategoryController)
router.post("/add-category",adminMiddleware,addCategoryController)
router.post('/edit-category/:id',adminMiddleware,editCategoryController)
router.post('/delete-category/:id',adminMiddleware,softdeleteCategoryController)

export default router
