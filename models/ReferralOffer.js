import mongoose from "mongoose";

const referralOfferSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    rewardAmount: {
      type: Number,
      required: true,
      min: 1
    },
    minPurchase: {
      type: Number,
      default: 100,
      min: 100
    },
    usageLimit: {
      type: Number,
      default: 0,
      min: 0
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    message: {
      type: String,
      default: "",
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const ReferralOffer = mongoose.model("ReferralOffer", referralOfferSchema);
export default ReferralOffer;
