import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import {
  getReferralActivity,
  getReferralSettings,
  updateReferralSettings
} from "../../services/referralServices.js";

const normalizeText = (value = "") => String(value || "").trim().toLowerCase();

const sortByName = (items = [], key, order = "az") =>
  [...items].sort((a, b) => {
    const left = String(a?.[key] || "").toLowerCase();
    const right = String(b?.[key] || "").toLowerCase();
    return order === "za" ? right.localeCompare(left) : left.localeCompare(right);
  });

const PAGE_SIZE = 5;

const paginateItems = (items = [], currentPage = 1) => {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(Number(currentPage) || 1, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;

  return {
    items: items.slice(start, start + PAGE_SIZE),
    pagination: {
      currentPage: safePage,
      totalPages,
      hasPrev: safePage > 1,
      hasNext: safePage < totalPages
    }
  };
};

export const getOffersController = async (req, res) => {
  const [rawProducts, rawCategories, referralSettings, referralActivity] = await Promise.all([
    Product.find({ isDeleted: false })
      .select("productName price offerPrice offerPercentage brand")
      .lean(),
    Category.find({ isDeleted: false })
      .select("name offerPercentage")
      .lean(),
    getReferralSettings(),
    getReferralActivity()
  ]);

  const productSearch = normalizeText(req.query.productSearch);
  const productSort = req.query.productSort || "newest";
  const categorySearch = normalizeText(req.query.categorySearch);
  const categorySort = req.query.categorySort || "az";

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

  const productPage = req.query.productPage || 1;
  const categoryPage = req.query.categoryPage || 1;
  const referralPage = req.query.referralPage || 1;

  const pagedProducts = paginateItems(products, productPage);
  const pagedCategories = paginateItems(categories, categoryPage);
  const pagedReferralActivity = paginateItems(referralActivity, referralPage);

  return res.render("admin/offer-management", {
    products: pagedProducts.items,
    categories: pagedCategories.items,
    referralSettings,
    referralActivity: pagedReferralActivity.items,
    filters: {
      productSearch,
      productSort,
      categorySearch,
      categorySort
    },
    paginations: {
      products: pagedProducts.pagination,
      categories: pagedCategories.pagination,
      referralActivity: pagedReferralActivity.pagination
    },
    message: req.query.message || null,
    error: req.query.error || null
  });
};

export const getReferralSettingsController = async (req, res) => {
  const settings = await getReferralSettings();
  return res.json({
    referrerReward: Number(settings.referrerReward || 0),
    newUserReward: Number(settings.newUserReward || 0),
    minimumPurchase: Number(settings.minimumPurchase || 100),
    referralEnabled: Boolean(settings.referralEnabled),
    referralDisplayEnabled: Boolean(settings.referralDisplayEnabled)
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

export const updateReferralSettingsController = async (req, res) => {
  try {
    const referrerReward = Number(req.body.referrerReward);
    const newUserReward = Number(req.body.newUserReward);
    const minimumPurchase = Number(req.body.minimumPurchase);

    if (!Number.isFinite(referrerReward) || referrerReward < 0) {
      throw new Error("Referrer reward must be zero or more");
    }

    if (!Number.isFinite(newUserReward) || newUserReward < 0) {
      throw new Error("New user reward must be zero or more");
    }

    if (!Number.isFinite(minimumPurchase) || minimumPurchase < 100) {
      throw new Error("Minimum purchase must be at least 100");
    }

    await updateReferralSettings({
      referrerReward,
      newUserReward,
      minimumPurchase,
      referralEnabled: req.body.referralEnabled === "true",
      referralDisplayEnabled: req.body.referralDisplayEnabled === "true"
    });

    return res.redirect("/api/admin/offers?message=Referral settings updated");
  } catch (error) {
    return res.redirect(`/api/admin/offers?error=${encodeURIComponent(error.message || "Unable to update referral settings")}`);
  }
};
