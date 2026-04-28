const productDetailDataNode = document.getElementById("productDetailData");
const productDetailData = productDetailDataNode
  ? JSON.parse(productDetailDataNode.textContent || "{}")
  : {};

const mainPreview = document.getElementById("mainPreview");
const mainPreviewFrame = document.querySelector(".main-preview-frame");
const thumbRow = document.getElementById("thumbRow");
const detailTabs = document.querySelectorAll("[data-detail-tab]");
const detailPanels = document.querySelectorAll("[data-detail-panel]");
const detailPageMessage = document.querySelector(".detail-page-message");
const sizeButtons = document.querySelectorAll("[data-size-option]");
const colorButtons = document.querySelectorAll("[data-color-option]");
const selectedVariantSizeInput = document.getElementById("selectedVariantSize");
const selectedVariantColorInput = document.getElementById("selectedVariantColor");
const selectedVariantPrice = document.getElementById("selectedVariantPrice");
const selectedVariantOriginalPrice = document.getElementById("selectedVariantOriginalPrice");
const selectedVariantStockBox = document.querySelector(".stock-box");
const selectedVariantStatusMessage = document.querySelector(".detail-status-message p");
const selectedVariantLabel = document.getElementById("selectedVariantLabel");
const addToCartButton = document.querySelector(".detail-action-row .cart-btn");

const detailPageCanSell = Boolean(productDetailData.canAddToCart);
const variants = Array.isArray(productDetailData.variants) ? productDetailData.variants : [];
const productImages = Array.isArray(productDetailData.productImages)
  ? productDetailData.productImages
  : [];
const initialButtonLabel = productDetailData.initialButtonLabel || "Add to cart";
const availabilityMessage = productDetailData.availabilityMessage || "";

const normalizeValue = (value) => String(value || "").trim().toLowerCase();

const getCurrentVariant = () =>
  variants.find((variant) =>
    normalizeValue(variant.size) ===
      normalizeValue(selectedVariantSizeInput ? selectedVariantSizeInput.value : "") &&
    normalizeValue(variant.color) ===
      normalizeValue(selectedVariantColorInput ? selectedVariantColorInput.value : "")
  ) || null;

const findVariantBySelection = ({ size, color, changedField } = {}) => {
  const normalizedSize = normalizeValue(size);
  const normalizedColor = normalizeValue(color);

  return variants.find((variant) =>
    normalizeValue(variant.size) === normalizedSize &&
    normalizeValue(variant.color) === normalizedColor
  ) || (
    changedField === "size"
      ? variants.find((variant) => normalizeValue(variant.size) === normalizedSize)
      : changedField === "color"
        ? variants.find((variant) => normalizeValue(variant.color) === normalizedColor)
        : null
  ) || variants[0] || null;
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const renderVariantThumbs = (variant) => {
  if (!thumbRow) return;

  const variantImages = variant && Array.isArray(variant.images) && variant.images.length
    ? variant.images
    : productImages;
  const primaryImage = variantImages[(variant && variant.mainImageIndex) || 0] || variantImages[0] || "";

  if (primaryImage && mainPreview) {
    mainPreview.src = primaryImage;
  }

  thumbRow.innerHTML = variantImages
    .map((image) =>
      '<button type="button" class="thumb-button" data-thumb-src="' + escapeHtml(image) + '">' +
        '<img src="' + escapeHtml(image) + '" class="thumb-item" alt="thumb" />' +
      '</button>'
    )
    .join("");
};

const syncVariantUi = (nextVariant) => {
  const variant = nextVariant || getCurrentVariant() || variants[0] || null;
  if (!variant) return;

  sizeButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      normalizeValue(button.dataset.sizeOption) === normalizeValue(variant.size)
    );
  });

  colorButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      normalizeValue(button.dataset.colorOption) === normalizeValue(variant.color)
    );
  });

  if (selectedVariantSizeInput) {
    selectedVariantSizeInput.value = variant.size || "";
  }

  if (selectedVariantColorInput) {
    selectedVariantColorInput.value = variant.color || "";
  }

  if (selectedVariantPrice) {
    selectedVariantPrice.textContent = "₹" + variant.price;
  }

  if (selectedVariantOriginalPrice) {
    if (variant.hasDiscount && variant.originalPrice > variant.price) {
      selectedVariantOriginalPrice.hidden = false;
      selectedVariantOriginalPrice.textContent = "₹" + variant.originalPrice;
    } else {
      selectedVariantOriginalPrice.hidden = true;
      selectedVariantOriginalPrice.textContent = "";
    }
  }

  renderVariantThumbs(variant);

  if (selectedVariantLabel) {
    const labelParts = [];

    if (variant.size) {
      labelParts.push("Size " + variant.size);
    }

    if (variant.color) {
      labelParts.push("Color " + variant.color);
    }

    selectedVariantLabel.textContent =
      "Selected: " + (labelParts.join(" | ") || "Default option");
  }

  if (selectedVariantStockBox && detailPageCanSell) {
    if (variant.stock <= 0) {
      selectedVariantStockBox.innerHTML = '<span class="danger-text">Sold out</span>';
    } else if (variant.stock < 4) {
      selectedVariantStockBox.innerHTML =
        '<span class="low-stock-text">Only ' + variant.stock + ' left</span>';
    } else {
      selectedVariantStockBox.innerHTML = '<span class="success-text">In stock</span>';
    }
  }

  if (selectedVariantStatusMessage) {
    if (!detailPageCanSell) {
      selectedVariantStatusMessage.textContent = availabilityMessage;
    } else {
      selectedVariantStatusMessage.textContent = variant.stock <= 0
        ? "This selected variant is currently sold out."
        : variant.stock < 4
          ? "Almost few pieces left. Hurry up."
          : "Ready to order.";
    }
  }

  if (addToCartButton) {
    addToCartButton.disabled = !detailPageCanSell || variant.stock <= 0;
    addToCartButton.textContent = !detailPageCanSell
      ? initialButtonLabel
      : variant.stock <= 0
        ? "Sold out"
        : "Add to cart";
  }
};

if (mainPreviewFrame && mainPreview) {
  mainPreviewFrame.addEventListener("mousemove", (event) => {
    const rect = mainPreviewFrame.getBoundingClientRect();
    const originX = ((event.clientX - rect.left) / rect.width) * 100;
    const originY = ((event.clientY - rect.top) / rect.height) * 100;

    mainPreview.style.transformOrigin = originX + "% " + originY + "%";
    mainPreview.style.transform = "scale(3.22)";
  });

  mainPreviewFrame.addEventListener("mouseleave", () => {
    mainPreview.style.transform = "scale(1)";
    mainPreview.style.transformOrigin = "center center";
  });
}

detailTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.detailTab;

    detailTabs.forEach((item) => item.classList.toggle("active", item === tab));
    detailPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.detailPanel === target);
    });
  });
});

colorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const variant = findVariantBySelection({
      size: selectedVariantSizeInput ? selectedVariantSizeInput.value : "",
      color: button.dataset.colorOption || "",
      changedField: "color"
    });
    syncVariantUi(variant);
  });
});

sizeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const variant = findVariantBySelection({
      size: button.dataset.sizeOption || "",
      color: selectedVariantColorInput ? selectedVariantColorInput.value : "",
      changedField: "size"
    });
    syncVariantUi(variant);
  });
});

if (thumbRow) {
  thumbRow.addEventListener("click", (event) => {
    const thumbButton = event.target.closest("[data-thumb-src]");
    if (!thumbButton || !mainPreview) return;
    mainPreview.src = thumbButton.dataset.thumbSrc || mainPreview.src;
  });
}

syncVariantUi(getCurrentVariant() || variants[0] || null);

if (detailPageMessage) {
  window.setTimeout(() => {
    detailPageMessage.remove();

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("message");

    window.history.replaceState({}, "", nextUrl.pathname + nextUrl.search);
  }, 3000);
}
