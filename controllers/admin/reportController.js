import {
  getDashboardService,
  getSalesReportService
} from "../../services/adminReportServices.js";

const getOrderAmount = (order) =>
  Number(order.grandTotal) ||
  ((Number(order.subtotal) || 0) +
    (Number(order.shippingCharge) || 0) +
    (Number(order.tax) || 0) -
    (Number(order.discount) || 0));

const escapePdfText = (value = "") =>
  String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildPdfBuffer = (pageStreams = [], pageSize = [842, 595]) => {
  const objects = [];
  const addObject = (content) => {
    objects.push(Buffer.from(String(content)));
    return objects.length;
  };

  const contentObjectIds = pageStreams.map((stream) => {
    const contentStream = Buffer.from(stream);
    return addObject(`<< /Length ${contentStream.length} >>\nstream\n${contentStream.toString()}\nendstream`);
  });

  const pageObjectIds = contentObjectIds.map((contentObjectId) =>
    addObject(`<< /Type /Page /Parent PAGES_REF /MediaBox [0 0 ${pageSize[0]} ${pageSize[1]}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjectId} 0 R >>`)
  );

  const pagesObjectId = addObject(`<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  pageObjectIds.forEach((pageObjectId) => {
    objects[pageObjectId - 1] = Buffer.from(
      objects[pageObjectId - 1].toString().replace("PAGES_REF", `${pagesObjectId} 0 R`)
    );
  });
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

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

const truncatePdfCell = (value = "", maxLength = 24) => {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
};

const buildReportPdfPages = (report) => {
  const marginLeft = 28;
  const marginTop = 560;
  const rowHeight = 22;
  const cols = [
    { label: "Order ID", key: "orderId", width: 138, max: 18, align: "left" },
    { label: "Date", key: "date", width: 74, max: 10, align: "left" },
    { label: "Customer", key: "customer", width: 190, max: 30, align: "left" },
    { label: "Status", key: "status", width: 92, max: 12, align: "left" },
    { label: "Coupon", key: "coupon", width: 72, max: 10, align: "left" },
    { label: "Discount", key: "discount", width: 86, max: 12, align: "right" },
    { label: "Total", key: "total", width: 92, max: 12, align: "right" }
  ];

  const rows = report.orders.map((order) => ({
    orderId: order.orderId,
    date: new Date(order.createdAt).toLocaleDateString("en-IN"),
    customer: order.user?.email || "User",
    status: order.status,
    coupon: order.coupon?.code || "--",
    discount: `Rs. ${order.discount || 0}`,
    total: `Rs. ${getOrderAmount(order)}`
  }));

  const drawText = (x, y, text, font = "F1", size = 10, color = "0.12 0.18 0.29") =>
    `${color} rg\nBT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;

  const drawHeaderRow = (topY) => {
    let x = marginLeft;
    const parts = [];

    cols.forEach((col) => {
      parts.push("0.92 0.95 0.99 rg");
      parts.push(`${x} ${topY - rowHeight} ${col.width} ${rowHeight} re f`);
      parts.push("0.80 0.85 0.92 RG");
      parts.push(`${x} ${topY - rowHeight} ${col.width} ${rowHeight} re S`);
      parts.push(drawText(x + 6, topY - 15, col.label, "F2", 10, "0.11 0.23 0.50"));
      x += col.width;
    });

    return parts.join("\n");
  };

  const drawDataRow = (topY, row, fill = null) => {
    let x = marginLeft;
    const parts = [];

    cols.forEach((col) => {
      if (fill) {
        parts.push(fill);
        parts.push(`${x} ${topY - rowHeight} ${col.width} ${rowHeight} re f`);
      }
      parts.push("0.85 0.89 0.95 RG");
      parts.push(`${x} ${topY - rowHeight} ${col.width} ${rowHeight} re S`);
      const rawText = truncatePdfCell(row[col.key], col.max);
      const textX =
        col.align === "right"
          ? x + Math.max(8, col.width - (rawText.length * 5.1) - 8)
          : x + 6;
      parts.push(drawText(textX, topY - 15, rawText, "F1", 9, "0.12 0.18 0.29"));
      x += col.width;
    });

    return parts.join("\n");
  };

  const pageCommands = [];
  let pageIndex = 0;
  let currentCommands = [];
  let currentY = marginTop;

  const startPage = () => {
    pageIndex += 1;
    currentCommands = [
      "0.11 0.23 0.50 rg",
      drawText(marginLeft, 556, "Sales Report", "F2", 18, "0.11 0.23 0.50"),
      "0.40 0.48 0.63 rg",
      drawText(
        marginLeft,
        538,
        pageIndex === 1
          ? `Sales Count: ${report.totals.salesCount}   Order Amount: Rs. ${report.totals.orderAmount}   Discount: Rs. ${report.totals.discount}   Coupon Deductions: Rs. ${report.totals.couponDiscount}`
          : `Continued report - Page ${pageIndex}`,
        "F1",
        10,
        "0.40 0.48 0.63"
      ),
      drawHeaderRow(510)
    ];
    currentY = 510 - rowHeight;
  };

  const closePage = () => {
    pageCommands.push(currentCommands.join("\n"));
  };

  startPage();

  if (!rows.length) {
    currentCommands.push(
      drawDataRow(currentY, {
        orderId: "No report data",
        date: "",
        customer: "",
        status: "",
        coupon: "",
        discount: "",
        total: ""
      }, "0.99 0.99 1.00 rg")
    );
    closePage();
    return pageCommands;
  }

  rows.forEach((row, index) => {
    if (currentY < 62) {
      closePage();
      startPage();
    }

    currentCommands.push(drawDataRow(currentY, row, index % 2 === 0 ? "1 1 1 rg" : "0.97 0.98 1.00 rg"));
    currentY -= rowHeight;
  });

  closePage();
  return pageCommands;
};

export const getDashboardController = async (req, res) => {
  const period = req.query.period || "monthly";
  const dashboard = await getDashboardService(period, {
    recentPage: req.query.recentPage
  });

  return res.render("admin/dashboard", {
    dashboard,
    period
  });
};

export const getSalesReportController = async (req, res) => {
  const report = await getSalesReportService(req.query);

  return res.render("admin/sales-report", {
    report,
    query: req.query
  });
};

export const downloadSalesReportPdfController = async (req, res) => {
  const report = await getSalesReportService(req.query);
  const pageStreams = buildReportPdfPages(report);
  const pdfBuffer = buildPdfBuffer(pageStreams);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
  res.setHeader("Content-Length", pdfBuffer.length);
  return res.end(pdfBuffer);
};

export const downloadSalesReportExcelController = async (req, res) => {
  const report = await getSalesReportService(req.query);
  const tableRows = report.orders.map((order) => `
    <tr>
      <td>${escapeHtml(order.orderId)}</td>
      <td>${escapeHtml(new Date(order.createdAt).toLocaleDateString("en-IN"))}</td>
      <td>${escapeHtml(order.user?.email || "")}</td>
      <td>${escapeHtml(order.status)}</td>
      <td>${escapeHtml(order.coupon?.code || "--")}</td>
      <td>₹${order.discount || 0}</td>
      <td>₹${getOrderAmount(order)}</td>
    </tr>
  `).join("");

  const workbookHtml = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #1f2f49; }
          h1 { font-size: 22px; margin: 0 0 14px; color: #173b80; }
          .meta { margin: 0 0 16px; font-size: 12px; color: #5e6e8d; }
          .stats { margin: 0 0 18px; border-collapse: collapse; width: 100%; table-layout: fixed; }
          .stats td { border: 1px solid #c8d4ea; padding: 10px 12px; width: 25%; }
          .stats .label { display: block; font-size: 11px; font-weight: 700; color: #607392; text-transform: uppercase; margin-bottom: 4px; }
          .stats .value { font-size: 16px; font-weight: 700; color: #173b80; }
          table.report { border-collapse: collapse; width: 100%; table-layout: fixed; }
          table.report col:nth-child(1) { width: 18%; }
          table.report col:nth-child(2) { width: 11%; }
          table.report col:nth-child(3) { width: 27%; }
          table.report col:nth-child(4) { width: 12%; }
          table.report col:nth-child(5) { width: 10%; }
          table.report col:nth-child(6) { width: 10%; }
          table.report col:nth-child(7) { width: 12%; }
          th, td { border: 1px solid #9fb2d8; padding: 8px 10px; text-align: left; vertical-align: top; word-wrap: break-word; }
          th { background: #dfe8f5; color: #173b80; font-weight: 700; }
          tr:nth-child(even) td { background: #f6f9ff; }
          td.num { text-align: right; }
          .empty { text-align: center; color: #607392; }
        </style>
      </head>
      <body>
        <h1>Sales Report</h1>
        <div class="meta">Generated on ${escapeHtml(new Date().toLocaleString("en-IN"))}</div>
        <table class="stats">
          <tr>
            <td><span class="label">Sales Count</span><span class="value">${report.totals.salesCount}</span></td>
            <td><span class="label">Order Amount</span><span class="value">₹${report.totals.orderAmount}</span></td>
            <td><span class="label">Discount</span><span class="value">₹${report.totals.discount}</span></td>
            <td><span class="label">Coupon Deductions</span><span class="value">₹${report.totals.couponDiscount}</span></td>
          </tr>
        </table>
        <table class="report">
          <colgroup>
            <col /><col /><col /><col /><col /><col /><col />
          </colgroup>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Coupon</th>
              <th>Discount</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${tableRows || '<tr><td colspan="7" class="empty">No report data</td></tr>'}</tbody>
        </table>
      </body>
    </html>
  `;

  res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=sales-report.xls");

  return res.send(workbookHtml);
};
