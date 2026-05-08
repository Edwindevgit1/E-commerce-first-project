import ReferralOffer from "../models/ReferralOffer.js";
import User from "../models/User.js";
import { creditWallet } from "./walletServices.js";

const isUsageLimitReached = (offer) =>
  Number(offer?.usageLimit || 0) > 0 &&
  Number(offer?.usedCount || 0) >= Number(offer?.usageLimit || 0);

export const getActiveReferralOfferByCode = async (code = "") => {
  const referralCode = String(code || "").trim().toUpperCase();
  if (!referralCode) {
    return null;
  }

  const offer = await ReferralOffer.findOne({ code: referralCode, isActive: true });
  if (!offer) {
    throw new Error("Invalid referral code");
  }

  if (isUsageLimitReached(offer)) {
    throw new Error("Referral usage limit reached");
  }

  return offer;
};

export const validateReferralOfferCode = async (code = "", subtotal = 0) => {
  const offer = await getActiveReferralOfferByCode(code);
  if (!offer) {
    return { offer: null, discount: 0 };
  }

  const discount = Math.min(Number(offer.rewardAmount) || 0, Number(subtotal) || 0);
  return { offer, discount };
};

export const processReferralRewardForOrder = async (userId, order) => {
  const user = await User.findById(userId);
  if (!user) return null;

  if (!user.referral?.code || user.referral?.rewardedAt) {
    return null;
  }

  const offer = await ReferralOffer.findById(user.referral.offer);
  if (!offer || !offer.isActive || isUsageLimitReached(offer)) {
    return null;
  }

  const minimumOrderAmount = Math.max(100, Number(offer.minPurchase || 0));
  const orderAmount = Number(order?.grandTotal || 0);

  if (orderAmount < minimumOrderAmount) {
    return null;
  }

  await creditWallet(
    user._id,
    Number(offer.rewardAmount) || 0,
    `Referral reward (${offer.code})`,
    order?._id || null
  );

  user.referral.rewardedAt = new Date();
  user.referral.rewardedOrder = order?._id || null;
  await user.save();

  await ReferralOffer.findByIdAndUpdate(offer._id, {
    $inc: { usedCount: 1 }
  });

  return offer;
};
