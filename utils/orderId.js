import Order from "../models/Order.js"

export const generateOrderId = async () => {
  const today = new Date()

  const year = today.getFullYear()
  const month = String(today.getMonth()+1).padStart(2,"0")
  const day = String(today.getDate()).padStart(2,"0")

  const datePart = `${year}${month}${day}`;

  const startOfDay = new Date();
  startOfDay.setHours(0,0,0,0)

  const count = await Order.countDocuments({
    createdAt:{$gte:startOfDay}
  })

  const serial = String(count + 1).padStart(4,"0")
  return `ORD-${datePart}-${serial}`
}