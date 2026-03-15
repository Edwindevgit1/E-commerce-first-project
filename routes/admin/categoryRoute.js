import express from 'express'
import { addCategoryController, editCategoryController, getCategoryController, softdeleteCategoryController } from '../../controllers/admin/categoryController.js'

const router = express.Router()

router.get('/category',getCategoryController)
router.post("/add-category",addCategoryController)
router.post('/edit-category/:id',editCategoryController)
router.post('/delete-category/:id',softdeleteCategoryController)

export default router