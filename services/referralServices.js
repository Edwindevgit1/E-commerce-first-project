import User from "../models/User.js";
import ReferralSettings from "../models/ReferralSettings.js";
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

export const getReferralSettings = async () => {
  let settings = await ReferralSettings.findOne({ key: "global" });

  if (!settings) {
    settings = await ReferralSettings.create({ key: "global" });
  }

  return settings;
};

export const updateReferralSettings = async (updates = {}) => {
  const settings = await getReferralSettings();

  if (typeof updates.referrerReward === "number") {
    settings.referrerReward = Math.max(0, updates.referrerReward);
  }

  if (typeof updates.newUserReward === "number") {
    settings.newUserReward = Math.max(0, updates.newUserReward);
  }

  if (typeof updates.minimumPurchase === "number") {
    settings.minimumPurchase = Math.max(100, updates.minimumPurchase);
  }

  if (typeof updates.referralEnabled === "boolean") {
    settings.referralEnabled = updates.referralEnabled;
  }

  if (typeof updates.referralDisplayEnabled === "boolean") {
    settings.referralDisplayEnabled = updates.referralDisplayEnabled;
  }

  await settings.save();
  return settings;
};

export const findReferrerByCode = async (code = "") => {
  const referralCode = normalizeReferralCode(code);
  if (!referralCode) return null;

  const referrer = await User.findOne({
    referralCode,
    isVerified: true
  });

  if (!referrer) {
    throw new Error("Invalid referral code");
  }

  if (referrer.isBlocked || referrer.referralSuspended) {
    throw new Error("Referral account unavailable");
  }

  return referrer;
};

export const validateReferralSignup = async (code = "", email = "") => {
  const referralCode = normalizeReferralCode(code);
  if (!referralCode) return null;

  const settings = await getReferralSettings();
  if (!settings.referralEnabled) {
    throw new Error("Referral system is disabled now");
  }

  const referrer = await findReferrerByCode(referralCode);

  if (email && String(referrer.email || "").toLowerCase() === String(email || "").toLowerCase()) {
    throw new Error("Self referral is not allowed");
  }

  return { referrer, settings };
};

export const rewardReferrerAfterSignup = async (userId) => {
  const [user, settings] = await Promise.all([
    User.findById(userId).populate("referredBy"),
    getReferralSettings()
  ]);

  if (!user || !user.referredBy || user.referrerRewardCreditedAt) {
    return null;
  }

  if (!settings.referralEnabled) {
    return null;
  }

  const referrer = user.referredBy;
  if (!referrer || referrer.isBlocked || referrer.referralSuspended) {
    return null;
  }

  const referrerReward = Math.max(0, Number(settings.referrerReward || 0));
  if (referrerReward <= 0) {
    return null;
  }

  await creditWallet(
    referrer._id,
    referrerReward,
    "Referral reward",
    null
  );

  user.referrerRewardGranted = referrerReward;
  user.referrerRewardCreditedAt = new Date();
  await user.save();

  return user;
};

export const processReferralRewardsAfterFirstOrder = async (userId, order) => {
  const [user, settings] = await Promise.all([
    User.findById(userId).populate("referredBy"),
    getReferralSettings()
  ]);

  if (!user || !user.referredBy || user.referralRewardClaimed) {
    return null;
  }

  if (!settings.referralEnabled) {
    return null;
  }

  const referrer = user.referredBy;
  if (!referrer || referrer.isBlocked || referrer.referralSuspended) {
    return null;
  }

  const orderAmount = Number(order?.grandTotal || 0);
  const minimumPurchase = Math.max(100, Number(settings.minimumPurchase || 100));

  if (orderAmount < minimumPurchase) {
    return null;
  }

  const newUserReward = Math.max(0, Number(settings.newUserReward || 0));

  if (newUserReward > 0) {
    await creditWallet(
      user._id,
      newUserReward,
      "Signup referral bonus",
      order?._id || null
    );
  }

  user.referralRewardClaimed = true;
  user.referralRewardClaimedAt = new Date();
  user.referralRewardOrder = order?._id || null;
  user.newUserRewardGranted = newUserReward;
  await user.save();

  return user;
};

export const buildReferralMeta = (user, settings, referralLink = "") => ({
  code: user?.referralCode || "",
  referralLink,
  referrerReward: Math.max(0, Number(settings?.referrerReward || 0)),
  newUserReward: Math.max(0, Number(settings?.newUserReward || 0)),
  minimumPurchase: Math.max(100, Number(settings?.minimumPurchase || 100)),
  enabled: Boolean(settings?.referralEnabled),
  displayEnabled: Boolean(settings?.referralDisplayEnabled),
  pendingReward: Boolean(user?.referredBy && !user?.referralRewardClaimed),
  suspended: Boolean(user?.referralSuspended)
});

export const resetUserReferralState = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  await ensureUserReferralCode(user);
  user.referredBy = null;
  user.referralRewardClaimed = false;
  user.referralRewardClaimedAt = null;
  user.referralRewardOrder = null;
  user.referrerRewardGranted = 0;
  user.referrerRewardCreditedAt = null;
  user.newUserRewardGranted = 0;
  user.referralSuspended = false;
  user.referralSuspendedAt = null;
  await user.save();
  return user;
};

export const regenerateUserReferralCode = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  user.referralCode = await generateUniqueReferralCode(user.name || "USER");
  await user.save();
  return user;
};

export const suspendUserReferral = async (userId, suspended = true) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  await ensureUserReferralCode(user);
  user.referralSuspended = suspended;
  user.referralSuspendedAt = suspended ? new Date() : null;
  await user.save();
  return user;
};

export const getReferralActivity = async () =>
  User.find({ referredBy: { $ne: null } })
    .populate("referredBy", "name email referralCode")
    .populate("referralRewardOrder", "orderId grandTotal")
    .select(
      "name email referralCode referredBy referralRewardClaimed referralRewardClaimedAt referralRewardOrder referrerRewardGranted referrerRewardCreditedAt newUserRewardGranted createdAt referralSuspended"
    )
    .sort({ createdAt: -1 })
    .lean();

export { normalizeReferralCode };
