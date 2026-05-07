import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import ReferralOffer from "../../models/ReferralOffer.js";

export const getOffersController = async (req, res) => {
  const [products, categories, referralOffers] = await Promise.all([
    Product.find({ isDeleted: false })
      .select("productName price offerPrice offerPercentage brand")
      .lean(),
    Category.find({ isDeleted: false })
      .select("name offerPercentage")
      .lean(),
    ReferralOffer.find().sort({ createdAt: -1 }).lean()
  ]);

  return res.render("admin/offer-management", {
    products,
    categories,
    referralOffers,
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

    if (rewardAmount < 1) {
      throw new Error("Referral reward amount must be greater than zero");
    }

    await ReferralOffer.create({
      title: req.body.title,
      rewardAmount,
      isActive: req.body.isActive !== "false"
    });

    return res.redirect("/api/admin/offers?message=Referral offer created");
  } catch (error) {
    return res.redirect(`/api/admin/offers?error=${encodeURIComponent(error.message || "Unable to create referral offer")}`);
  }
};
