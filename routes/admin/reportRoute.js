import express from "express";
import adminMiddleware from "../../middleware/adminauthmiddleware.js";
import noCache from "../../middleware/noCacheMiddleware.js";
import {
  downloadSalesReportExcelController,
  downloadSalesReportPdfController,
  getDashboardController,
  getSalesReportController
} from "../../controllers/admin/reportController.js";

const router = express.Router();

router.get("/dashboard", noCache, adminMiddleware, getDashboardController);
router.get("/sales-report", noCache, adminMiddleware, getSalesReportController);
router.get("/sales-report/pdf", adminMiddleware, downloadSalesReportPdfController);
router.get("/sales-report/excel", adminMiddleware, downloadSalesReportExcelController);

export default router;
