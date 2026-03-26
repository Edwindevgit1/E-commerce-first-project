export const getEffectiveProductPricing = (product) => {
  const basePrice = Number(product?.price) || 0;
  const productOfferPrice = Number(product?.offerPrice) || 0;
  const categoryOfferPercentage = Number(product?.category?.offerPercentage) || 0;
  const hasCoupon = Boolean(String(product?.couponCode || "").trim());

  let effectivePrice = basePrice;
  let discountSource = null;

  if (!hasCoupon && productOfferPrice > 0 && productOfferPrice < effectivePrice) {
    effectivePrice = productOfferPrice;
    discountSource = "product";
  }

  if (categoryOfferPercentage > 0) {
    const categoryOfferPrice = Math.round(
      basePrice - (basePrice * categoryOfferPercentage) / 100
    );

    if (categoryOfferPrice > 0 && categoryOfferPrice < effectivePrice) {
      effectivePrice = categoryOfferPrice;
      discountSource = "category";
    }
  }

  return {
    basePrice,
    effectivePrice,
    hasDiscount: effectivePrice < basePrice,
    discountSource,
    categoryOfferPercentage
  };
};
