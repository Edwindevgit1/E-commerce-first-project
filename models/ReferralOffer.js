import mongoose from "mongoose";

const referralOfferSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    token: {
      type: String,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    rewardAmount: {
      type: Number,
      required: true,
      min: 1
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
