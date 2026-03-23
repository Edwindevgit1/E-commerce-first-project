import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true },
    comment: { type: String, default: "" }
  },
  { timestamps: true }
);

const variantSchema = new mongoose.Schema(
  {
    size: { type: String, required: true },
    color: { type: String, required: true },
    stock: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    shippingInfo: {
      type: String,
      default: ""
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    offerPrice: {
      type: Number,
      default: 0
    },
    stock: {
      type: Number,
      required: true
    },
    sizes: {
      type: [String],
      default: []
    },
    colors: {
      type: [String],
      default: []
    },
    variants: {
      type: [variantSchema],
      default: []
    },
    highlights: {
      type: [String],
      default: []
    },
    images: {
      type: [String],
      validate: [arr => arr.length >= 3, "Minimum 3 images required"]
    },
    mainImageIndex: {
      type: Number,
      default: 0
    },
    couponCode: {
      type: String,
      default: ""
    },
    couponDescription: {
      type: String,
      default: ""
    },
    reviews: {
      type: [reviewSchema],
      default: []
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
export default Product;
