import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { getEffectiveProductPricing } from "../utils/pricing.js";
import { cartVariantHelpers } from "./cartServices.js";

const { buildCartItemId, getProductVariant } = cartVariantHelpers;
const MAX_CART_QUANTITY = 5;

export const placeOrderService = async (userId, selectedCartItemIds = []) => {
  if (!userId) {
    throw new Error("User is required");
  }

  const normalizedSelectedIds = (Array.isArray(selectedCartItemIds)
    ? selectedCartItemIds
    : [selectedCartItemIds]
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
      selectedIdSet.has(buildCartItemId(item.product, item.size, item.color))
    );

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

      if (
        product.isDeleted ||
        product.isBlocked ||
        product.status !== "active" ||
        !product.category ||
        product.category.isDeleted ||
        product.category.status !== "active"
      ) {
        throw new Error(`${product.productName} is no longer available`);
      }

      const selectedVariant = getProductVariant(product, item.size, item.color);

      if (!selectedVariant) {
        throw new Error(`${product.productName} selected variant is unavailable`);
      }

      if (selectedVariant.stock <= 0) {
        throw new Error(`${product.productName} is out of stock`);
      }

      if (item.quantity > selectedVariant.stock) {
        throw new Error(
          `${product.productName} only has ${selectedVariant.stock} item(s) available`
        );
      }

      if (item.quantity > MAX_CART_QUANTITY) {
        throw new Error(
          `${product.productName} exceeds the maximum allowed quantity`
        );
      }

      const pricing = getEffectiveProductPricing({
        ...product.toObject(),
        price: Number(selectedVariant.price) || 0,
        offerPrice: Number(selectedVariant.offerPrice) || 0
      });
      const price = pricing.effectivePrice;
      const subtotal = price * item.quantity;
      const imageIndex = selectedVariant.mainImageIndex ?? 0;

      orderItems.push({
        product: product._id,
        productName: product.productName,
        productImage:
          selectedVariant.images?.[imageIndex] ||
          selectedVariant.images?.[0] ||
          product.images?.[product.mainImageIndex ?? 0] ||
          product.images?.[0] ||
          "",
        category: product.category?.name || "",
        price,
        quantity: item.quantity,
        subtotal
      });

      grandTotal += subtotal;

      selectedVariant.stock -= item.quantity;
      product.stock = (product.variants || []).reduce(
        (sum, variant) => sum + (Number(variant.stock) || 0),
        0
      );

      await product.save({ session });
    }

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

    cart.items = cart.items.filter(
      (item) => !selectedIdSet.has(buildCartItemId(item.product, item.size, item.color))
    );

    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    return order;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
