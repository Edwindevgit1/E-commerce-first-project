import express from 'express'
import adminMiddleware from '../../middleware/adminauthmiddleware.js';
import { blockUser,unblockUser } from '../../controllers/block-unblockControllers.js';

const router=express.Router()

// Block / Unblock (Protected)
router.post('/adminusermanagement/block/:id', adminMiddleware, blockUser);
router.post('/adminusermanagement/unblock/:id', adminMiddleware, unblockUser);

export default router