import {
  getOrdersService,
  getOrderDetailService,
  cancelOrderService,
  cancelOrderItemService,
  returnOrderService
} from "../../services/userOrderServices.js";

export const getOrdersPage = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect("/api/auth/login");
    }

    const userId = req.user._id;
    const search = String(req.query.search || "").trim();
    const page = Number(req.query.page) || 1;
    const limit = 5;

    const { orders, totalPages } = await getOrdersService(userId, search, page, limit);

    return res.render("user/orders", {
      orders,
      search,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.log(error, "Get orders page error");
    return res.redirect("/api/user/profile");
  }
};

export const getOrderDetailPage = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect("/api/auth/login");
    }

    const order = await getOrderDetailService(req.user._id, req.params.orderId);

    if (!order) {
      return res.redirect("/api/user/orders?error=Order not found");
    }

    return res.render("user/order-detail", { order });
  } catch (error) {
    console.log(error, "Get order detail error");
    return res.redirect("/api/user/orders?error=Unable to load order");
  }
};

export const cancelOrderController = async (req, res) => {
  try {
    await cancelOrderService(req.user._id, req.params.orderId, req.body.reason || "");
    return res.redirect(`/api/user/orders/${req.params.orderId}?message=Order cancelled successfully`);
  } catch (error) {
    console.log(error, "Cancel order error");
    return res.redirect(`/api/user/orders/${req.params.orderId}?error=${encodeURIComponent(error.message || "Unable to cancel order")}`);
  }
};

export const cancelOrderItemController = async (req, res) => {
  try {
    await cancelOrderItemService(
      req.user._id,
      req.params.orderId,
      req.params.itemIndex,
      req.body.reason || ""
    );
    return res.redirect(`/api/user/orders/${req.params.orderId}?message=Item cancelled successfully`);
  } catch (error) {
    console.log(error, "Cancel order item error");
    return res.redirect(`/api/user/orders/${req.params.orderId}?error=${encodeURIComponent(error.message || "Unable to cancel item")}`);
  }
};

export const returnOrderController = async (req, res) => {
  try {
    await returnOrderService(req.user._id, req.params.orderId, req.body.reason || "");
    return res.redirect(`/api/user/orders/${req.params.orderId}?message=Return request submitted`);
  } catch (error) {
    console.log(error, "Return order error");
    return res.redirect(`/api/user/orders/${req.params.orderId}?error=${encodeURIComponent(error.message || "Unable to return order")}`);
  }
};

export const downloadInvoiceController = async (req, res) => {
  try {
    const { default: PDFDocument } = await import("pdfkit");
    const order = await getOrderDetailService(req.user._id, req.params.orderId);

    if (!order) {
      return res.redirect("/api/user/orders?error=Order not found");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${order.orderId}.pdf"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(20).text("Invoice", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Order ID: ${order.orderId}`);
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`);
    doc.text(`Status: ${order.status}`);
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.moveDown();

    doc.text("Items:");
    order.items.forEach((item, index) => {
      doc.text(
        `${index + 1}. ${item.productName} | Qty: ${item.quantity} | Price: ₹${item.price} | Subtotal: ₹${item.subtotal}`
      );
    });

    doc.moveDown();
    doc.text(`Subtotal: ₹${order.subtotal}`);
    doc.text(`Shipping: ₹${order.shippingCharge}`);
    doc.text(`Tax: ₹${order.tax}`);
    doc.text(`Discount: ₹${order.discount}`);
    doc.text(`Grand Total: ₹${order.grandTotal}`);

    doc.end();
  } catch (error) {
    console.log(error, "Download invoice error");
    return res.redirect(`/api/user/orders/${req.params.orderId}?error=Unable to download invoice`);
  }
};
