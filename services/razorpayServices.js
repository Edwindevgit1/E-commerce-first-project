import crypto from "crypto";
import https from "https";

const RAZORPAY_HOST = "api.razorpay.com";

const requestRazorpay = (path, method, payload) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {});
    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString("base64");

    const req = https.request(
      {
        hostname: RAZORPAY_HOST,
        path,
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          const parsed = data ? JSON.parse(data) : {};

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
            return;
          }

          reject(new Error(parsed?.error?.description || "Unable to create Razorpay order"));
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });

export const createRazorpayOrder = async ({ amount, receipt, notes = {} }) => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay configuration missing");
  }

  const amountInPaise = Math.round((Number(amount) || 0) * 100);

  if (amountInPaise <= 0) {
    throw new Error("Invalid Razorpay amount");
  }

  return requestRazorpay("/v1/orders", "POST", {
    amount: amountInPaise,
    currency: "INR",
    receipt,
    notes
  });
};

export const verifyRazorpaySignature = ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
}) => {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return expected === razorpaySignature;
};
