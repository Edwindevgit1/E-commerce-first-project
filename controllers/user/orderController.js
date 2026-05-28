import {
  getOrdersService,
  getOrderDetailService,
  cancelOrderService,
  cancelOrderItemService,
  returnOrderService,
  returnOrderItemService
} from "../../services/userOrderServices.js";

const formatCurrency = (amount = 0) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;

const titleizeOrderValue = (value = "") =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const escapeXml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const wrapText = (text = "", maxChars = 28) => {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [""];
  }

  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxChars && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }
    currentLine = nextLine;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const svgTextLines = (lines, startX, startY, color = "#5A78AF", size = 15, weight = 400, lineHeight = 22, anchor = "start") =>
  lines
    .map(
      (line, index) =>
        `<text x="${startX}" y="${startY + index * lineHeight}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(line)}</text>`
    )
    .join("");

const resolveImageBuffer = async (imageSource = "") => {
  if (!imageSource) {
    return null;
  }

  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");

  if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
    const response = await fetch(imageSource);
    if (!response.ok) {
      throw new Error("Unable to fetch product image");
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const sanitizedPath = imageSource.startsWith("/")
    ? imageSource.slice(1)
    : imageSource;
  const publicCandidate = path.join(process.cwd(), "public", sanitizedPath);
  const workspaceCandidate = path.join(process.cwd(), sanitizedPath);

  try {
    return await readFile(publicCandidate);
  } catch {
    return readFile(workspaceCandidate);
  }
};

const placeholderImageDataUri = (label = "Item") => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
      <rect width="96" height="96" rx="18" fill="#DCE8FB"/>
      <text x="48" y="54" text-anchor="middle" font-family="Arial" font-size="16" font-weight="700" fill="#5573A7">${escapeXml(label)}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

const buildInvoiceSvg = async (order) => {
  const { default: sharp } = await import("sharp");
  const userName = order.user?.name || order.address?.fullName || "Customer";
  const userEmail = order.user?.email || "customer@example.com";
  const userMobile = order.address?.mobile || "N/A";
  const orderStatusLabel = titleizeOrderValue(order.status || "pending");
  const paymentStatusLabel = titleizeOrderValue(order.paymentStatus || "pending");
  const addressLines = [
    order.address?.street || "",
    [order.address?.city, order.address?.state].filter(Boolean).join(", "),
    order.address?.pincode || "",
    order.address?.addressType || order.address?.type || ""
  ].filter(Boolean);

  const items = Array.isArray(order.items) ? order.items.slice(0, 2) : [];
  const itemMarkup = await Promise.all(items.map(async (item, index) => {
    let imageUri = placeholderImageDataUri("Item");

    try {
      const imageBuffer = await resolveImageBuffer(item.productImage);
      if (imageBuffer) {
        const normalizedImage = await sharp(imageBuffer)
          .resize(68, 68, { fit: "cover" })
          .png()
          .toBuffer();
        imageUri = `data:image/png;base64,${normalizedImage.toString("base64")}`;
      }
    } catch {
      imageUri = placeholderImageDataUri("Item");
    }

    const top = 707 + index * 72;
    const nameLines = wrapText(item.productName || "Product", 24).slice(0, 2);

    return `
      <rect x="142" y="${top}" width="634" height="64" rx="17" fill="#FFFFFF" stroke="#CFE0FB"/>
      <clipPath id="itemImageClip${index}"><rect x="164" y="${top + 8}" width="48" height="48" rx="13"/></clipPath>
      <image href="${imageUri}" x="164" y="${top + 8}" width="48" height="48" preserveAspectRatio="xMidYMid slice" clip-path="url(#itemImageClip${index})"/>
      ${svgTextLines(nameLines, 238, top + 27, "#142340", 15, 800, 17)}
      <text x="496" y="${top + 39}" fill="#142340" font-size="15" font-weight="800">${escapeXml(formatCurrency(item.price))}</text>
      <text x="576" y="${top + 39}" fill="#142340" font-size="15" font-weight="800">${escapeXml(String(item.quantity || 0))}</text>
      <text x="700" y="${top + 39}" fill="#173B80" font-size="15" font-weight="800" text-anchor="end">${escapeXml(formatCurrency(item.subtotal))}</text>
    `;
  }));

  const noteLines = wrapText(
    "Your purchase is confirmed. Keep this invoice for records, returns, and future support requests.",
    42
  );

  const moreItemsNote = order.items?.length > 2
    ? `<text x="164" y="918" fill="#5A78AF" font-size="13" font-weight="700">+${order.items.length - 2} more item(s) included in this order</text>`
    : "";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1080">
      <defs>
        <style>
          text { font-family: Arial, Helvetica, sans-serif; }
        </style>
        <linearGradient id="pageBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#F8FBFF"/>
          <stop offset="1" stop-color="#EDF5FF"/>
        </linearGradient>
        <linearGradient id="thankYou" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#173B80"/>
          <stop offset="1" stop-color="#326BC8"/>
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#BFD2EF" flood-opacity="0.42"/>
        </filter>
      </defs>

      <rect width="1440" height="1080" fill="url(#pageBg)"/>

      <g transform="translate(0,-70)">
      <rect x="85" y="138" width="1270" height="830" rx="28" fill="#FFFFFF" stroke="#D4E4FC" filter="url(#softShadow)"/>
      <text x="114" y="164" fill="#5270AA" font-size="15">Home / invoice</text>

      <text x="114" y="234" fill="#173B80" font-size="50" font-weight="900">Invoice</text>
      <text x="114" y="272" fill="#5A78AF" font-size="23" font-weight="800">Order ID ${escapeXml(order.orderId || "")}</text>

      <rect x="610" y="188" width="690" height="252" rx="24" fill="#FFFFFF" stroke="#CFE0FB"/>
      <text x="638" y="240" fill="#173B80" font-size="25" font-weight="900">Invoice Details</text>
      <text x="638" y="280" fill="#5A78AF" font-size="17">Invoice number</text>
      <text x="858" y="280" fill="#142340" font-size="17" font-weight="800">: ${escapeXml(order.orderId || "N/A")}</text>
      <text x="638" y="310" fill="#5A78AF" font-size="17">Order date</text>
      <text x="858" y="310" fill="#142340" font-size="17" font-weight="800">: ${escapeXml(new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))}</text>
      <text x="638" y="340" fill="#5A78AF" font-size="17">Payment method</text>
      <text x="858" y="340" fill="#142340" font-size="17" font-weight="800">: ${escapeXml(order.paymentMethod || "COD")}</text>
      <text x="638" y="370" fill="#5A78AF" font-size="17">Payment status</text>
      <text x="858" y="370" fill="#142340" font-size="17" font-weight="800">: ${escapeXml(paymentStatusLabel)}</text>
      <text x="638" y="400" fill="#5A78AF" font-size="17">Order status</text>
      <text x="858" y="400" fill="#142340" font-size="17" font-weight="800">: ${escapeXml(orderStatusLabel)}</text>

      <rect x="114" y="316" width="458" height="236" rx="22" fill="#FFFFFF" stroke="#CFE0FB"/>
      <text x="142" y="362" fill="#173B80" font-size="22" font-weight="900">Billing information</text>
      <text x="142" y="400" fill="#142340" font-size="17" font-weight="800">${escapeXml(userName)}</text>
      <text x="142" y="422" fill="#5A78AF" font-size="16">${escapeXml(userEmail)}</text>
      <text x="142" y="462" fill="#173B80" font-size="21" font-weight="900">Shipping Address</text>
      ${svgTextLines(addressLines, 142, 490, "#5A78AF", 16, 400, 25)}

      <rect x="114" y="585" width="690" height="360" rx="22" fill="#FFFFFF" stroke="#CFE0FB"/>
      <text x="142" y="634" fill="#173B80" font-size="22" font-weight="900">Items</text>
      <rect x="142" y="650" width="634" height="41" rx="13" fill="#F6F8FD"/>
      <text x="164" y="676" fill="#5A78AF" font-size="13" font-weight="800">Item</text>
      <text x="446" y="676" fill="#5A78AF" font-size="13" font-weight="800">Price</text>
      <text x="560" y="676" fill="#5A78AF" font-size="13" font-weight="800">Qty</text>
      <text x="660" y="676" fill="#5A78AF" font-size="13" font-weight="800">Total</text>
      ${itemMarkup.join("")}
      ${moreItemsNote}

      <text x="470" y="846" fill="#5A78AF" font-size="15">Subtotal</text>
      <text x="742" y="846" fill="#142340" font-size="16" font-weight="800" text-anchor="end">${escapeXml(formatCurrency(order.subtotal))}</text>
      <text x="470" y="870" fill="#2F9D61" font-size="15">Discount</text>
      <text x="742" y="870" fill="#2F9D61" font-size="16" font-weight="800" text-anchor="end">${escapeXml(formatCurrency(order.discount))}</text>
      <text x="470" y="894" fill="#5A78AF" font-size="15">Shipping</text>
      <text x="742" y="894" fill="#142340" font-size="16" font-weight="800" text-anchor="end">${escapeXml(formatCurrency(order.shippingCharge))}</text>
      <text x="470" y="918" fill="#5A78AF" font-size="15">Tax</text>
      <text x="742" y="918" fill="#142340" font-size="16" font-weight="800" text-anchor="end">${escapeXml(formatCurrency(order.tax))}</text>
      <text x="470" y="949" fill="#173B80" font-size="18" font-weight="900">Grand Total</text>
      <text x="742" y="949" fill="#173B80" font-size="24" font-weight="900" text-anchor="end">${escapeXml(formatCurrency(order.grandTotal))}</text>

      <rect x="847" y="455" width="452" height="432" rx="24" fill="url(#thankYou)"/>
      <text x="1073" y="604" fill="#FFFFFF" font-size="34" font-weight="900" text-anchor="middle">Thank you for</text>
      <text x="1073" y="644" fill="#FFFFFF" font-size="34" font-weight="900" text-anchor="middle">shopping with us!</text>
      ${svgTextLines(noteLines, 1073, 681, "#F3F8FF", 17, 400, 21, "middle")}
      <rect x="980" y="773" width="186" height="43" rx="22" fill="#537CBF" stroke="#81A2DA"/>
      <text x="1073" y="800" fill="#FFFFFF" font-size="14" font-weight="800" text-anchor="middle">Invoice ready to share</text>
      </g>
    </svg>
  `;
};

export const buildInvoicePdfBuffer = async (order) => {
  const orderDate = order?.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      })
    : "N/A";
  const customerName = order?.user?.name || order?.address?.fullName || "Customer";
  const customerEmail = order?.user?.email || "N/A";
  const shippingAddress = [
    order?.address?.fullName || "",
    order?.address?.street || "",
    [order?.address?.city, order?.address?.state].filter(Boolean).join(", "),
    order?.address?.pincode || "",
    order?.address?.mobile ? `Phone: ${order.address.mobile}` : ""
  ].filter(Boolean);
  const pdfEscape = (value = "") =>
    String(value)
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)");
  const clipText = (value = "", max = 26) => {
    const text = String(value ?? "");
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  };

  const pageWidth = 595;
  const pageHeight = 842;
  const content = [];
  const push = (line = "") => content.push(line);
  const addText = (text, x, y, size = 11, font = "F1", color = "0.08 0.14 0.25") => {
    push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${pdfEscape(text)}) Tj ET`);
  };
  const addRect = (x, y, width, height, stroke = "0.81 0.88 0.98", fill = null) => {
    if (fill) {
      push(`${fill} rg ${x} ${y} ${width} ${height} re B`);
    } else {
      push(`${stroke} RG ${x} ${y} ${width} ${height} re S`);
    }
  };
  const addLine = (x1, y1, x2, y2, stroke = "0.81 0.88 0.98") => {
    push(`${stroke} RG ${x1} ${y1} m ${x2} ${y2} l S`);
  };

  addText("Invoice", 40, 790, 28, "F2", "0.09 0.23 0.50");
  addText(`Order ID: ${order?.orderId || "N/A"}`, 40, 765, 11, "F1", "0.34 0.47 0.69");
  addText(`Date: ${orderDate}`, 220, 765, 11, "F1", "0.34 0.47 0.69");
  addText(`Payment: ${order?.paymentMethod || "COD"}`, 380, 765, 11, "F1", "0.34 0.47 0.69");

  addRect(40, 650, 515, 88, "0.81 0.88 0.98");
  addText("Customer", 52, 718, 13, "F2", "0.09 0.23 0.50");
  addText(customerName, 52, 695, 11, "F2", "0.08 0.14 0.25");
  addText(customerEmail, 52, 677, 11, "F1", "0.34 0.47 0.69");
  addText("Shipping Address", 300, 718, 13, "F2", "0.09 0.23 0.50");
  shippingAddress.slice(0, 4).forEach((line, index) => {
    addText(line, 300, 695 - index * 16, 11, "F1", "0.34 0.47 0.69");
  });

  const tableLeft = 40;
  const tableTop = 605;
  const rowHeight = 28;
  const colWidths = [120, 110, 38, 62, 82, 103];
  const headers = ["Product", "Variant", "Qty", "Price", "Status", "Total"];
  const colStarts = [];
  let cursorX = tableLeft;
  colWidths.forEach((width) => {
    colStarts.push(cursorX);
    cursorX += width;
  });

  addRect(tableLeft, tableTop, 515, rowHeight, "0.81 0.88 0.98", "0.96 0.97 0.99");
  headers.forEach((header, index) => {
    addText(header, colStarts[index] + 8, tableTop + 10, 10, "F2", "0.09 0.23 0.50");
    if (index > 0) {
      addLine(colStarts[index], tableTop, colStarts[index], tableTop + rowHeight);
    }
  });

  let currentY = tableTop - rowHeight;
  const items = Array.isArray(order?.items) ? order.items : [];
  items.slice(0, 8).forEach((item, itemIndex) => {
    const variant = [item?.size ? `S:${item.size}` : "", item?.color ? `C:${item.color}` : ""]
      .filter(Boolean)
      .join(" ")
      || "-";
    const values = [
      clipText(item?.productName || "Product", 24),
      clipText(variant, 18),
      String(item?.quantity || 0),
      formatCurrency(item?.price || 0),
      clipText(titleizeOrderValue(item?.status || "pending"), 16),
      formatCurrency(item?.subtotal || 0)
    ];
    const fill = itemIndex % 2 === 0 ? "1 1 1" : "0.985 0.99 1";
    addRect(tableLeft, currentY, 515, rowHeight, "0.81 0.88 0.98", fill);
    values.forEach((value, index) => {
      addText(value, colStarts[index] + 8, currentY + 10, 10, index === 0 ? "F2" : "F1", "0.08 0.14 0.25");
      if (index > 0) {
        addLine(colStarts[index], currentY, colStarts[index], currentY + rowHeight);
      }
    });
    currentY -= rowHeight;
  });

  const summaryTop = currentY - 18;
  addText("Order Summary", 40, summaryTop + 100, 14, "F2", "0.09 0.23 0.50");
  addRect(330, summaryTop + 12, 225, 110, "0.81 0.88 0.98");

  const summaryRows = [
    ["Subtotal", formatCurrency(order?.subtotal || 0)],
    ["Discount", formatCurrency(order?.discount || 0)],
    ["Shipping", formatCurrency(order?.shippingCharge || 0)],
    ["Tax", formatCurrency(order?.tax || 0)],
    ["Grand Total", formatCurrency(order?.grandTotal || 0)]
  ];
  summaryRows.forEach(([label, value], index) => {
    const y = summaryTop + 98 - index * 20;
    const bold = index === summaryRows.length - 1;
    addText(label, 344, y, bold ? 11 : 10, bold ? "F2" : "F1", bold ? "0.09 0.23 0.50" : "0.34 0.47 0.69");
    addText(value, 455, y, bold ? 11 : 10, bold ? "F2" : "F1", "0.08 0.14 0.25");
  });
  addText(
    "Thank you for shopping with us. Keep this invoice for returns, refunds, and support.",
    40,
    summaryTop + 62,
    10,
    "F1",
    "0.34 0.47 0.69"
  );

  const contentStream = content.join("\n");
  const objects = [];
  const addObject = (buffer) => {
    objects.push(Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer)));
    return objects.length;
  };

  const fontRegularId = addObject(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
  const fontBoldId = addObject(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"));
  const contentObjectId = addObject(
    Buffer.from(`<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`)
  );
  const pageObjectId = addObject(
    Buffer.from(
      `<< /Type /Page /Parent PAGES_REF /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    )
  );
  const pagesObjectId = addObject(Buffer.from(`<< /Type /Pages /Count 1 /Kids [${pageObjectId} 0 R] >>`));
  objects[pageObjectId - 1] = Buffer.from(
    objects[pageObjectId - 1].toString().replace("PAGES_REF", `${pagesObjectId} 0 R`)
  );
  const catalogObjectId = addObject(Buffer.from(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`));

  const chunks = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0];
  objects.forEach((objectBuffer, index) => {
    offsets.push(Buffer.concat(chunks).length);
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`));
    chunks.push(objectBuffer);
    chunks.push(Buffer.from("\nendobj\n"));
  });

  const bodyBuffer = Buffer.concat(chunks);
  const xrefOffset = bodyBuffer.length;
  const xrefLines = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n"];
  for (let index = 1; index <= objects.length; index += 1) {
    xrefLines.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }

  return Buffer.concat([
    bodyBuffer,
    Buffer.from(xrefLines.join("")),
    Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\n`),
    Buffer.from(`startxref\n${xrefOffset}\n%%EOF`)
  ]);
};

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
    const user = req.user;

    return res.render("user/orders", {
      user,
      orders,
      search,
      currentPage: page,
      totalPages,
      message: req.query.message || null,
      error: req.query.error || null
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

    return res.render("user/order-detail", {
      user: req.user,
      order,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.log(error, "Get order detail error");
    return res.redirect("/api/user/orders?error=Unable to load order");
  }
};

export const cancelOrderController = async (req, res) => {
  try {
    const { couponMessage = "" } = await cancelOrderService(req.user._id, req.params.orderId, req.body.reason || "");
    const message = couponMessage
      ? `Order cancelled successfully. ${couponMessage}`
      : "Order cancelled successfully";
    return res.redirect(`/api/user/orders/${req.params.orderId}?message=${encodeURIComponent(message)}`);
  } catch (error) {
    console.log(error, "Cancel order error");
    return res.redirect(`/api/user/orders/${req.params.orderId}?error=${encodeURIComponent(error.message || "Unable to cancel order")}`);
  }
};

export const cancelOrderItemController = async (req, res) => {
  try {
    const { couponMessage = "" } = await cancelOrderItemService(
      req.user._id,
      req.params.orderId,
      req.params.itemIndex,
      req.body.reason || ""
    );
    const message = couponMessage
      ? `Item cancelled successfully. ${couponMessage}`
      : "Item cancelled successfully";
    return res.redirect(`/api/user/orders/${req.params.orderId}?message=${encodeURIComponent(message)}`);
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

export const returnOrderItemController = async (req, res) => {
  try {
    await returnOrderItemService(
      req.user._id,
      req.params.orderId,
      req.params.itemIndex,
      req.body.reason || ""
    );
    return res.redirect(`/api/user/orders/${req.params.orderId}?message=Return request submitted for this item`);
  } catch (error) {
    console.log(error, "Return order item error");
    return res.redirect(`/api/user/orders/${req.params.orderId}?error=${encodeURIComponent(error.message || "Unable to return item")}`);
  }
};

export const downloadInvoiceController = async (req, res) => {
  try {
    const order = await getOrderDetailService(req.user._id, req.params.orderId);

    if (!order) {
      return res.redirect("/api/user/orders?error=Order not found");
    }
    const pdfBuffer = await buildInvoicePdfBuffer(order);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${order.orderId}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error) {
    console.log(error, "Download invoice error");
    return res.redirect(`/api/user/orders/${req.params.orderId}?error=Unable to download invoice`);
  }
};
