import Counter from "../models/Counter.js";

export const generateOrderId = async () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const datePart = `${year}${month}${day}`;
  const counter = await Counter.findOneAndUpdate(
    { key: `order:${datePart}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const serial = String(counter.seq).padStart(4, "0");
  return `ORD-${datePart}-${serial}`;
};
