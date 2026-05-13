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

const buildSimplePdfBuffer = (lines = []) => {
  const objects = [];
  const addObject = (content) => {
    objects.push(Buffer.from(String(content)));
    return objects.length;
  };

  const textCommands = lines
    .slice(0, 42)
    .map((line, index) => `BT /F1 10 Tf 40 ${780 - index * 17} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");

  const contentStream = Buffer.from(textCommands);
  const contentObjectId = addObject(`<< /Length ${contentStream.length} >>\nstream\n${contentStream.toString()}\nendstream`);
  const pageObjectId = addObject(`<< /Type /Page /Parent PAGES_REF /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObjectId} 0 R >>`);
  const pagesObjectId = addObject(`<< /Type /Pages /Count 1 /Kids [${pageObjectId} 0 R] >>`);
  objects[pageObjectId - 1] = Buffer.from(objects[pageObjectId - 1].toString().replace("PAGES_REF", `${pagesObjectId} 0 R`));
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

const buildReportPdfLines = (report) => {
  const header = [
    "Sales Report",
    `Sales Count: ${report.totals.salesCount}`,
    `Order Amount: Rs. ${report.totals.orderAmount}`,
    `Discount: Rs. ${report.totals.discount}`,
    `Coupon Deductions: Rs. ${report.totals.couponDiscount}`,
    "------------------------------------------------------------",
    "Order ID | Date | Customer | Status | Coupon | Discount | Amount",
    "------------------------------------------------------------"
  ];

  const rows = report.orders.flatMap((order) => {
    const date = new Date(order.createdAt).toLocaleDateString("en-IN");
    const customer = order.user?.email || "User";
    const coupon = order.coupon?.code || "--";
    const amount = getOrderAmount(order);

    return [
      `${order.orderId} | ${date} |`,
      `${customer.slice(0, 42)} | ${order.status} | ${coupon} | Rs. ${order.discount || 0} | Rs. ${amount}`,
      "------------------------------------------------------------"
    ];
  });

  return [...header, ...rows].slice(0, 42);
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
  const lines = buildReportPdfLines(report);
  const pdfBuffer = buildSimplePdfBuffer(lines);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
  res.setHeader("Content-Length", pdfBuffer.length);
  return res.end(pdfBuffer);
};

export const downloadSalesReportExcelController = async (req, res) => {
  const report = await getSalesReportService(req.query);
  const tableRows = report.orders.map((order) => `
    <tr>
      <td>${order.orderId}</td>
      <td>${new Date(order.createdAt).toLocaleDateString("en-IN")}</td>
      <td>${order.user?.email || ""}</td>
      <td>${order.status}</td>
      <td>${order.coupon?.code || "--"}</td>
      <td>₹${order.discount || 0}</td>
      <td>₹${getOrderAmount(order)}</td>
    </tr>
  `).join("");

  const workbookHtml = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; }
          h1 { font-size: 20px; }
          .stats { margin: 12px 0 18px; }
          .stats div { margin-bottom: 6px; font-weight: 700; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #9fb2d8; padding: 8px 10px; text-align: left; }
          th { background: #dfe8f5; color: #173b80; }
          tr:nth-child(even) td { background: #f6f9ff; }
        </style>
      </head>
      <body>
        <h1>Sales Report</h1>
        <div class="stats">
          <div>Sales Count: ${report.totals.salesCount}</div>
          <div>Order Amount: ₹${report.totals.orderAmount}</div>
          <div>Discount: ₹${report.totals.discount}</div>
          <div>Coupon Deductions: ₹${report.totals.couponDiscount}</div>
        </div>
        <table>
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
          <tbody>${tableRows || '<tr><td colspan="7">No report data</td></tr>'}</tbody>
        </table>
      </body>
    </html>
  `;

  res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=sales-report.xls");

  return res.send(workbookHtml);
};
