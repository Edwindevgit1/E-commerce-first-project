export const getEffectiveProductPricing = (product) => {
  const basePrice = Number(product?.price) || 0;
  const productOfferPrice = Number(product?.offerPrice) || 0;
  const productOfferPercentage = Number(product?.offerPercentage) || 0;
  const categoryOfferPercentage = Number(product?.category?.offerPercentage) || 0;

  let effectivePrice = basePrice;
  let discountSource = null;

  if (productOfferPrice > 0 && productOfferPrice < effectivePrice) {
    effectivePrice = productOfferPrice;
    discountSource = "product";
  }

  if (productOfferPercentage > 0) {
    const productPercentagePrice = Math.round(
      basePrice - (basePrice * productOfferPercentage) / 100
    );

    if (productPercentagePrice > 0 && productPercentagePrice < effectivePrice) {
      effectivePrice = productPercentagePrice;
      discountSource = "product";
    }
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
    productOfferPercentage,
    categoryOfferPercentage
  };
};
