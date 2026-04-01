import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { getEffectiveProductPricing } from "../utils/pricing.js";

const MAX_CART_QUANTITY = 5;

export const placeOrderService = async (userId, selectedProductIds = []) => {
  if (!userId) {
    throw new Error("User is required");
  }

  const normalizedSelectedIds = (Array.isArray(selectedProductIds)
    ? selectedProductIds
    : [selectedProductIds]
  )
    .map((id) => String(id || "").trim())
    .filter(Boolean);

  if (!normalizedSelectedIds.length) {
    throw new Error("No valid cart items selected");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.findOne({ user: userId }).session(session);

    if (!cart || !cart.items.length) {
      throw new Error("Your cart is empty");
    }

    const selectedIdSet = new Set(normalizedSelectedIds);

    const itemsToOrder = cart.items.filter((item) =>
      selectedIdSet.has(String(item.product))
    );

    // ✅ STRICT VALIDATION (NEW)
    if (itemsToOrder.length !== normalizedSelectedIds.length) {
      throw new Error("Some selected items are invalid or not in your cart");
    }

    if (!itemsToOrder.length) {
      throw new Error("No valid cart items selected");
    }

    const orderItems = [];
    let grandTotal = 0;

    for (const item of itemsToOrder) {
      const product = await Product.findById(item.product)
        .populate("category")
        .session(session);

      if (!product) {
        throw new Error("One of the cart products no longer exists");
      }

      // ✅ AVAILABILITY VALIDATION
      if (
        product.isDeleted ||
        product.isBlocked ||
        product.status !== "active" ||
        !product.category ||
        product.category.isDeleted ||
        product.category.status !== "active"
      ) {
        throw new Error(
          `${product.productName} is no longer available`
        );
      }

      if (product.stock <= 0) {
        throw new Error(`${product.productName} is out of stock`);
      }

      if (item.quantity > product.stock) {
        throw new Error(
          `${product.productName} only has ${product.stock} item(s) available`
        );
      }

      if (item.quantity > MAX_CART_QUANTITY) {
        throw new Error(
          `${product.productName} exceeds the maximum allowed quantity`
        );
      }

      // ✅ PRICING
      const pricing = getEffectiveProductPricing(product);
      const price = pricing.effectivePrice;
      const subtotal = price * item.quantity;

      const imageIndex = product.mainImageIndex ?? 0;

      orderItems.push({
        product: product._id,
        productName: product.productName,
        productImage:
          product.images?.[imageIndex] || product.images?.[0] || "",
        category: product.category?.name || "",
        price,
        quantity: item.quantity,
        subtotal
      });

      grandTotal += subtotal;

      // ✅ ATOMIC STOCK UPDATE (CRITICAL FIX)
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: product._id,
          stock: { $gte: item.quantity }
        },
        {
          $inc: { stock: -item.quantity }
        },
        { new: true, session }
      );

      if (!updatedProduct) {
        throw new Error(
          `${product.productName} stock changed. Please try again.`
        );
      }
    }

    // ✅ CREATE ORDER
    const [order] = await Order.create(
      [
        {
          user: userId,
          items: orderItems,
          grandTotal,
          status: "placed"
        }
      ],
      { session }
    );

    // ✅ REMOVE PURCHASED ITEMS FROM CART
    cart.items = cart.items.filter(
      (item) => !selectedIdSet.has(String(item.product))
    );

    await cart.save({ session });

    // ✅ COMMIT
    await session.commitTransaction();
    session.endSession();

    return order;

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};