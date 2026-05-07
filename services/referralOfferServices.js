import ReferralOffer from "../models/ReferralOffer.js";

export const validateReferralOfferCode = async (code = "", subtotal = 0) => {
  const referralCode = String(code || "").trim().toUpperCase();
  if (!referralCode) {
    return { offer: null, discount: 0 };
  }

  const offer = await ReferralOffer.findOne({ code: referralCode, isActive: true });
  if (!offer) {
    throw new Error("Invalid referral code");
  }

  const discount = Math.min(Number(offer.rewardAmount) || 0, Number(subtotal) || 0);
  return { offer, discount };
};
