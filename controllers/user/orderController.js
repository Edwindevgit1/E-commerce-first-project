import {
  getOrdersService,
  getOrderDetailService,
  cancelOrderService,
  cancelOrderItemService,
  returnOrderService
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
  const paymentStatus = order.paymentStatus === "paid" ? "Paid" : titleizeOrderValue(order.status || "pending");
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

      <rect x="610" y="188" width="690" height="220" rx="24" fill="#FFFFFF" stroke="#CFE0FB"/>
      <text x="638" y="240" fill="#173B80" font-size="25" font-weight="900">Invoice Details</text>
      <text x="638" y="284" fill="#5A78AF" font-size="18">Invoice number</text>
      <text x="858" y="284" fill="#142340" font-size="18" font-weight="800">: ${escapeXml(order.orderId || "N/A")}</text>
      <text x="638" y="318" fill="#5A78AF" font-size="18">Order date</text>
      <text x="858" y="318" fill="#142340" font-size="18" font-weight="800">: ${escapeXml(new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))}</text>
      <text x="638" y="352" fill="#5A78AF" font-size="18">Payment method</text>
      <text x="858" y="352" fill="#142340" font-size="18" font-weight="800">: ${escapeXml(order.paymentMethod || "COD")}</text>
      <text x="638" y="386" fill="#5A78AF" font-size="18">Status</text>
      <text x="858" y="386" fill="#142340" font-size="18" font-weight="800">: ${escapeXml(paymentStatus)}</text>

      <rect x="114" y="316" width="458" height="236" rx="22" fill="#FFFFFF" stroke="#CFE0FB"/>
      <text x="142" y="362" fill="#173B80" font-size="22" font-weight="900">Billing information</text>
      <text x="142" y="405" fill="#142340" font-size="17" font-weight="800">${escapeXml(userName)}</text>
      <text x="142" y="430" fill="#5A78AF" font-size="16">${escapeXml(userEmail)}</text>
      <text x="142" y="479" fill="#173B80" font-size="21" font-weight="900">Shipping Address</text>
      ${svgTextLines(addressLines, 142, 508, "#5A78AF", 16, 400, 25)}

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
      <text x="470" y="925" fill="#173B80" font-size="18" font-weight="900">Grand Total</text>
      <text x="742" y="925" fill="#173B80" font-size="24" font-weight="900" text-anchor="end">${escapeXml(formatCurrency(order.grandTotal))}</text>

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

const buildInvoicePdfBuffer = async (order) => {
  const { default: sharp } = await import("sharp");
  const svgMarkup = await buildInvoiceSvg(order);
  const jpegBuffer = await sharp(Buffer.from(svgMarkup))
    .jpeg({ quality: 92 })
    .toBuffer();

  const pageWidth = 1440;
  const pageHeight = 1080;
  const objects = [];
  const addObject = (buffer) => {
    objects.push(Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer)));
    return objects.length;
  };

  const imageMetadata = await sharp(jpegBuffer).metadata();
  const imageObjectId = addObject(
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${imageMetadata.width} /Height ${imageMetadata.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuffer.length} >>\nstream\n`
      ),
      jpegBuffer,
      Buffer.from("\nendstream")
    ])
  );

  const contentStream = Buffer.from(`q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ`);
  const contentObjectId = addObject(
    Buffer.from(`<< /Length ${contentStream.length} >>\nstream\n${contentStream.toString()}\nendstream`)
  );
  const pageObjectId = addObject(
    Buffer.from(
      `<< /Type /Page /Parent PAGES_REF /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
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
