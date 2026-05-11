import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import ReferralOffer from "../../models/ReferralOffer.js";
import {
  clearAllUserReferralCodes,
  getReferralConfig,
  updateReferralConfig
} from "../../services/referralServices.js";

const normalizeText = (value = "") => String(value || "").trim().toLowerCase();

const buildReferralOfferCode = (title = "") =>
  `OFFER-${String(title || "REF")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "REF"}-${Date.now().toString().slice(-6)}`;

const sortByName = (items = [], key, order = "az") =>
  [...items].sort((a, b) => {
    const left = String(a?.[key] || "").toLowerCase();
    const right = String(b?.[key] || "").toLowerCase();
    return order === "za" ? right.localeCompare(left) : left.localeCompare(right);
  });

export const getOffersController = async (req, res) => {
  const [
    rawProducts,
    rawCategories,
    rawReferralOffers,
    referralConfig
  ] = await Promise.all([
    Product.find({ isDeleted: false })
      .select("productName price offerPrice offerPercentage brand")
      .lean(),
    Category.find({ isDeleted: false })
      .select("name offerPercentage")
      .lean(),
    ReferralOffer.find().sort({ createdAt: -1 }).lean(),
    getReferralConfig()
  ]);

  const productSearch = normalizeText(req.query.productSearch);
  const productSort = req.query.productSort || "newest";
  const categorySearch = normalizeText(req.query.categorySearch);
  const categorySort = req.query.categorySort || "az";
  const referralSearch = normalizeText(req.query.referralSearch);
  const referralSort = req.query.referralSort || "newest";

  let products = [...rawProducts];
  if (productSearch) {
    products = products.filter((product) =>
      normalizeText(product.productName).includes(productSearch)
    );
  }
  if (productSort === "oldest") {
    products.reverse();
  } else if (productSort === "price_low") {
    products.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (productSort === "price_high") {
    products.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (productSort === "az" || productSort === "za") {
    products = sortByName(products, "productName", productSort);
  }

  let categories = [...rawCategories];
  if (categorySearch) {
    categories = categories.filter((category) =>
      normalizeText(category.name).includes(categorySearch)
    );
  }
  categories = sortByName(categories, "name", categorySort);

  let referralOffers = [...rawReferralOffers];
  if (referralSearch) {
    referralOffers = referralOffers.filter((offer) =>
      normalizeText(offer.title).includes(referralSearch) ||
      normalizeText(offer.message).includes(referralSearch)
    );
  }
  if (referralSort === "oldest") {
    referralOffers.reverse();
  } else if (referralSort === "reward_low") {
    referralOffers.sort((a, b) => Number(a.rewardAmount || 0) - Number(b.rewardAmount || 0));
  } else if (referralSort === "reward_high") {
    referralOffers.sort((a, b) => Number(b.rewardAmount || 0) - Number(a.rewardAmount || 0));
  } else if (referralSort === "az" || referralSort === "za") {
    referralOffers = sortByName(referralOffers, "title", referralSort);
  }

  return res.render("admin/offer-management", {
    products,
    categories,
    referralOffers,
    referralConfig,
    filters: {
      productSearch,
      productSort,
      categorySearch,
      categorySort,
      referralSearch,
      referralSort
    },
    message: req.query.message || null,
    error: req.query.error || null
  });
};

export const updateProductOfferController = async (req, res) => {
  try {
    const offerPrice = Number(req.body.offerPrice) || 0;
    const offerPercentage = Number(req.body.offerPercentage) || 0;

    if (offerPercentage < 0 || offerPercentage > 90) {
      throw new Error("Product offer percentage must be between 0 and 90");
    }

    await Product.findByIdAndUpdate(req.params.id, {
      offerPrice,
      offerPercentage
    });

    return res.redirect("/api/admin/offers?message=Product offer updated");
  } catch (error) {
    return res.redirect(`/api/admin/offers?error=${encodeURIComponent(error.message)}`);
  }
};

export const updateReferralCodeControlController = async (req, res) => {
  try {
    await updateReferralConfig({
      signupEnabled: req.body.signupEnabled === "true",
      profileVisible: req.body.profileVisible === "true"
    });

    return res.redirect("/api/admin/offers?message=Referral code control updated");
  } catch (error) {
    return res.redirect(`/api/admin/offers?error=${encodeURIComponent(error.message || "Unable to update referral control")}`);
  }
};

export const clearAllUserReferralCodesController = async (req, res) => {
  try {
    await clearAllUserReferralCodes();
    await updateReferralConfig({
      signupEnabled: false,
      profileVisible: false
    });
    return res.redirect("/api/admin/offers?message=All user referral codes cleared");
  } catch (error) {
    return res.redirect(`/api/admin/offers?error=${encodeURIComponent(error.message || "Unable to clear referral codes")}`);
  }
};

export const updateCategoryOfferController = async (req, res) => {
  try {
    const offerPercentage = Number(req.body.offerPercentage) || 0;

    if (offerPercentage < 0 || offerPercentage > 90) {
      throw new Error("Category offer percentage must be between 0 and 90");
    }

    await Category.findByIdAndUpdate(req.params.id, { offerPercentage });

    return res.redirect("/api/admin/offers?message=Category offer updated");
  } catch (error) {
    return res.redirect(`/api/admin/offers?error=${encodeURIComponent(error.message)}`);
  }
};

export const createReferralOfferController = async (req, res) => {
  try {
    const rewardAmount = Number(req.body.rewardAmount) || 0;
    const usageLimit = Math.max(0, Number(req.body.usageLimit) || 0);
    const minPurchase = Math.max(100, Number(req.body.minPurchase) || 100);
    const message = String(req.body.message || "").trim();
    const title = String(req.body.title || "").trim();

    if (rewardAmount < 1) {
      throw new Error("Referral reward amount must be greater than zero");
    }

    if (!title) {
      throw new Error("Referral title is required");
    }

    await ReferralOffer.create({
      title,
      code: buildReferralOfferCode(title),
      rewardAmount,
      usageLimit,
      minPurchase,
      message,
      isActive: req.body.isActive !== "false"
    });

    return res.redirect("/api/admin/offers?message=Referral offer created");
  } catch (error) {
    return res.redirect(`/api/admin/offers?error=${encodeURIComponent(error.message || "Unable to create referral offer")}`);
  }
};

export const updateReferralOfferController = async (req, res) => {
  try {
    const rewardAmount = Number(req.body.rewardAmount) || 0;
    const usageLimit = Math.max(0, Number(req.body.usageLimit) || 0);
    const minPurchase = Math.max(100, Number(req.body.minPurchase) || 100);
    const message = String(req.body.message || "").trim();
    const title = String(req.body.title || "").trim();

    if (rewardAmount < 1) {
      throw new Error("Referral reward amount must be greater than zero");
    }

    if (!title) {
      throw new Error("Referral title is required");
    }

    await ReferralOffer.findByIdAndUpdate(req.params.id, {
      title,
      rewardAmount,
      usageLimit,
      minPurchase,
      message,
      isActive: req.body.isActive !== "false"
    });

    return res.redirect("/api/admin/offers?message=Referral offer updated");
  } catch (error) {
    return res.redirect(`/api/admin/offers?error=${encodeURIComponent(error.message || "Unable to update referral offer")}`);
  }
};

export const deleteReferralOfferController = async (req, res) => {
  try {
    await ReferralOffer.findByIdAndDelete(req.params.id);
    return res.redirect("/api/admin/offers?message=Referral offer deleted");
  } catch (error) {
    return res.redirect(`/api/admin/offers?error=${encodeURIComponent(error.message || "Unable to delete referral offer")}`);
  }
};
