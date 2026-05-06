import {
  getAdminOrdersService,
  getAdminOrderByIdService,
  updateAdminOrderStatusService,
  verifyAndRestockOrderItemService,
  rejectReturnRequestService,
  rejectCancellationRequestService
} from "../../services/adminOrderServices.js";
import { buildInvoicePdfBuffer } from "../user/orderController.js";

const buildPaginationItems = (currentPage, totalPages) => {
  const startPage = Math.max(1, currentPage - 1);
  const endPage = Math.min(totalPages, currentPage + 1);
  const paginationItems = [];

  for (let page = startPage; page <= endPage; page += 1) {
    paginationItems.push(page);
  }

  return paginationItems;
};

const renderAdminOrdersPage = async (res, options = {}) => {
  const search = options.search || "";
  const selectedStatus = options.selectedStatus || "";
  const sort = options.sort || "newest";
  const currentPage = options.currentPage || 1;
  const limit = 5;

  const { orders, totalOrders, totalPages } = await getAdminOrdersService({
    search,
    status: selectedStatus,
    sort,
    page: currentPage,
    limit
  });

  return res.render("admin/order-management", {
    orders,
    totalOrders,
    totalPages,
    currentPage,
    paginationItems: buildPaginationItems(currentPage, totalPages),
    search,
    selectedStatus,
    sort,
    message: options.message || null,
    error: options.error || null
  });
};

export const getAdminOrdersController = async (req, res) => {
  try {
    return await renderAdminOrdersPage(res, {
      search: req.query.search || "",
      selectedStatus: req.query.status || "",
      sort: req.query.sort || "newest",
      currentPage: Math.max(1, Number(req.query.page) || 1),
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.log(error, "Admin orders page error");
    return res.render("admin/order-management", {
      orders: [],
      totalOrders: 0,
      totalPages: 1,
      currentPage: 1,
      paginationItems: [1],
      search: "",
      selectedStatus: "",
      sort: "newest",
      message: null,
      error: "Failed to load orders."
    });
  }
};

export const getAdminOrderDetailController = async (req, res) => {
  try {
    const order = await getAdminOrderByIdService(req.params.id);

    return res.render("admin/order-detail", {
      order,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.log(error, "Admin order detail error");
    return res.redirect("/api/admin/orders?error=Unable to load order detail");
  }
};

export const updateAdminOrderStatusController = async (req, res) => {
  try {
    await updateAdminOrderStatusService(req.params.id, req.body.status);

    const redirectTarget = req.body.redirectTo === "detail"
      ? `/api/admin/orders/${req.params.id}?message=Order status updated successfully`
      : `/api/admin/orders?message=Order status updated successfully`;

    return res.redirect(redirectTarget);
  } catch (error) {
    const redirectTarget = req.body.redirectTo === "detail"
      ? `/api/admin/orders/${req.params.id}?error=${encodeURIComponent(error.message || "Unable to update order status")}`
      : `/api/admin/orders?error=${encodeURIComponent(error.message || "Unable to update order status")}`;

    return res.redirect(redirectTarget);
  }
};

export const verifyAndRestockOrderItemController = async (req, res) => {
  try {
    await verifyAndRestockOrderItemService(req.params.id, req.params.itemIndex);
    return res.redirect(`/api/admin/orders/${req.params.id}?message=Product verified and stock restored`);
  } catch (error) {
    return res.redirect(
      `/api/admin/orders/${req.params.id}?error=${encodeURIComponent(error.message || "Unable to restock item")}`
    );
  }
};

export const rejectReturnRequestController = async (req, res) => {
  try {
    await rejectReturnRequestService(req.params.id, req.params.itemIndex);
    return res.redirect(`/api/admin/orders/${req.params.id}?message=Return request rejected`);
  } catch (error) {
    return res.redirect(
      `/api/admin/orders/${req.params.id}?error=${encodeURIComponent(error.message || "Unable to reject return request")}`
    );
  }
};

export const rejectCancellationRequestController = async (req, res) => {
  try {
    await rejectCancellationRequestService(req.params.id, req.params.itemIndex);
    return res.redirect(`/api/admin/orders/${req.params.id}?message=Cancellation request rejected`);
  } catch (error) {
    return res.redirect(
      `/api/admin/orders/${req.params.id}?error=${encodeURIComponent(error.message || "Unable to reject cancellation request")}`
    );
  }
};

export const downloadAdminInvoiceController = async (req, res) => {
  try {
    const order = await getAdminOrderByIdService(req.params.id);
    const pdfBuffer = await buildInvoicePdfBuffer(order);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${order.orderId}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error) {
    console.log(error, "Admin invoice download error");
    return res.redirect(`/api/admin/orders/${req.params.id}?error=Unable to download invoice`);
  }
};
