import mongoose from "mongoose";

const referralSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "global"
    },
    referrerReward: {
      type: Number,
      default: 100,
      min: 0
    },
    newUserReward: {
      type: Number,
      default: 100,
      min: 0
    },
    minimumPurchase: {
      type: Number,
      default: 100,
      min: 100
    },
    referralEnabled: {
      type: Boolean,
      default: true
    },
    referralDisplayEnabled: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const ReferralSettings = mongoose.model("ReferralSettings", referralSettingsSchema);

export default ReferralSettings;
