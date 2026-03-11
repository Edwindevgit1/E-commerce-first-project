import express from 'express'
import adminMiddleware from '../../middleware/adminauthmiddleware.js'
import superAdmin from '../../middleware/superAdmin.Middleware.js'
import { demoteToUser, promotetoAdmin } from '../../controllers/promotetoAdmin.Controller.js'

const router = express.Router()

router.post('/makeadmin/:id',adminMiddleware,superAdmin,promotetoAdmin)
router.post('/removeadmin/:id',adminMiddleware,superAdmin,demoteToUser)

export default router