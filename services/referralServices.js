import User from "../models/User.js";
import ReferralOffer from "../models/ReferralOffer.js";
import ReferralConfig from "../models/ReferralConfig.js";
import { creditWallet } from "./walletServices.js";

const normalizeReferralCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const buildReferralPrefix = (seed = "") => {
  const cleaned = String(seed || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return (cleaned || "USER").slice(0, 5);
};

export const generateUniqueReferralCode = async (seed = "USER") => {
  const prefix = buildReferralPrefix(seed);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const referralCode = `${prefix}${suffix}`;
    const existingUser = await User.exists({ referralCode });

    if (!existingUser) {
      return referralCode;
    }
  }

  throw new Error("Unable to generate referral code");
};

export const ensureUserReferralCode = async (user) => {
  if (!user) return null;
  if (user.referralCode) return user.referralCode;

  user.referralCode = await generateUniqueReferralCode(user.name || "USER");
  await user.save();
  return user.referralCode;
};

export const getReferralConfig = async () => {
  let config = await ReferralConfig.findOne({ key: "global" });
  if (!config) {
    config = await ReferralConfig.create({ key: "global" });
  }
  return config;
};

export const updateReferralConfig = async (updates = {}) => {
  const config = await getReferralConfig();
  if (typeof updates.signupEnabled === "boolean") {
    config.signupEnabled = updates.signupEnabled;
  }
  if (typeof updates.profileVisible === "boolean") {
    config.profileVisible = updates.profileVisible;
  }
  await config.save();
  return config;
};

export const clearAllUserReferralCodes = async () =>
  User.updateMany(
    {},
    {
      $unset: {
        referralCode: "",
        referredBy: "",
        referredByCode: "",
        referralOffer: "",
        referralOfferTitle: "",
        referralOfferMessage: "",
        referralRewardAmount: "",
        referralMinPurchase: "",
        referralRewardedAt: "",
        referralRewardedOrder: "",
        referrerRewardedAt: ""
      }
    }
  );

const isUsageLimitReached = (offer) =>
  Number(offer?.usageLimit || 0) > 0 &&
  Number(offer?.usedCount || 0) >= Number(offer?.usageLimit || 0);

export const getActiveReferralOffers = async () =>
  ReferralOffer.find({ isActive: true }).sort({ createdAt: -1 }).lean();

export const getCurrentActiveReferralOffer = async () => {
  const offers = await ReferralOffer.find({ isActive: true }).sort({ createdAt: -1 });
  return offers.find((offer) => !isUsageLimitReached(offer)) || null;
};

export const findReferrerByCode = async (code = "") => {
  const referralCode = normalizeReferralCode(code);
  if (!referralCode) return null;

  const referrer = await User.findOne({ referralCode: referralCode, isVerified: true });
  if (!referrer) {
    throw new Error("Invalid referral code");
  }

  return referrer;
};

export const validateReferralSignup = async (code = "") => {
  const config = await getReferralConfig();
  if (!config.signupEnabled) {
    throw new Error("Referral signup is disabled now");
  }

  const referrer = await findReferrerByCode(code);
  const activeOffer = await getCurrentActiveReferralOffer();

  if (!activeOffer) {
    throw new Error("No active referral offer available now");
  }

  return { referrer, activeOffer };
};

export const rewardReferrerAfterSignup = async (newUser) => {
  if (!newUser?.referredBy || newUser?.referrerRewardedAt) {
    return null;
  }

  const rewardAmount = Math.max(0, Number(newUser.referralRewardAmount) || 0);
  if (!rewardAmount) {
    return null;
  }

  await creditWallet(
    newUser.referredBy,
    rewardAmount,
    `Referral reward for ${newUser.name} signup`,
    null
  );

  newUser.referrerRewardedAt = new Date();
  await newUser.save();

  if (newUser.referralOffer) {
    await ReferralOffer.findByIdAndUpdate(newUser.referralOffer, {
      $inc: { usedCount: 1 }
    });
  }

  return newUser;
};

export const rewardReferredUserAfterFirstOrder = async (userId, order) => {
  const user = await User.findById(userId);
  if (!user || !user.referredBy || user.referralRewardedAt) {
    return null;
  }

  const orderAmount = Number(order?.grandTotal || 0);
  const minimumOrder = Math.max(100, Number(user.referralMinPurchase || 100));
  if (orderAmount < minimumOrder) {
    return null;
  }

  const rewardAmount = Math.max(0, Number(user.referralRewardAmount) || 0);
  if (!rewardAmount) return null;

  await creditWallet(
    user._id,
    rewardAmount,
    "Referral reward after first successful order",
    order?._id || null
  );

  user.referralRewardedAt = new Date();
  user.referralRewardedOrder = order?._id || null;
  await user.save();
  return user;
};

export const buildReferralWalletMessage = (user) => {
  if (!user) return null;

  return {
    code: user.referralCode || "",
    referrerReward: Math.max(0, Number(user.referralRewardAmount || 0)),
    newUserReward: Math.max(0, Number(user.referralRewardAmount || 0)),
    minimumOrder: Math.max(100, Number(user.referralMinPurchase || 100)),
    pendingFirstOrderReward: Boolean(user.referredBy && !user.referralRewardedAt),
    assignedOfferTitle: user.referralOfferTitle || "",
    assignedOfferMessage: user.referralOfferMessage || ""
  };
};

export { normalizeReferralCode };
