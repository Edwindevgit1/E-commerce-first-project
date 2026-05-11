import mongoose from "mongoose";

const referralConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "global"
    },
    signupEnabled: {
      type: Boolean,
      default: true
    },
    profileVisible: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const ReferralConfig = mongoose.model("ReferralConfig", referralConfigSchema);

export default ReferralConfig;
