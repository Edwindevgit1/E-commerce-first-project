(function () {
  "use strict";

  /* read variant JSON blob embedded by server */
  var raw  = document.getElementById("productDetailData");
  var data = {};
  try { if (raw) data = JSON.parse(raw.textContent || "{}"); }
  catch(e){ console.error("productDetailData parse error:", e); }

  var variants  = Array.isArray(data.variants)      ? data.variants      : [];
  var prodImgs  = Array.isArray(data.productImages) ? data.productImages : [];
  var canSell   = !!data.canAddToCart;
  var initLabel = data.initialButtonLabel || "Add to cart";
  var availMsg  = data.availabilityMessage || "";

  console.log("[PD] Script loaded. Variants:", variants.length, "canSell:", canSell);

  /* DOM */
  var mainImg    = document.getElementById("mainPreview");
  var frame      = document.querySelector(".main-preview-frame");
  var thumbRow   = document.getElementById("thumbRow");
  var sizeInput  = document.getElementById("selectedVariantSize");
  var colorInput = document.getElementById("selectedVariantColor");
  var priceEl    = document.getElementById("selectedVariantPrice");
  var origPrEl   = document.getElementById("selectedVariantOriginalPrice");
  var stockBox   = document.querySelector(".stock-box");
  var statusP    = document.querySelector(".detail-status-message p");
  var labelEl    = document.getElementById("selectedVariantLabel");
  var cartBtn    = document.querySelector(".detail-action-row .cart-btn");
  var sizeBtns   = Array.from(document.querySelectorAll("[data-size-option]"));
  var colorBtns  = Array.from(document.querySelectorAll("[data-color-option]"));
  var tabs       = Array.from(document.querySelectorAll("[data-detail-tab]"));
  var panels     = Array.from(document.querySelectorAll("[data-detail-panel]"));
  var flash      = document.querySelector(".detail-page-message");

  console.log("[PD] sizeBtns:", sizeBtns.length, "colorBtns:", colorBtns.length);

  /* helpers */
  function norm(v){ return String(v||"").trim().toLowerCase(); }
  function esc(v){ return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  function colorsForSize(size){
    var ns=norm(size);
    return variants.filter(function(v){ return !ns||norm(v.size)===ns; }).map(function(v){ return norm(v.color); });
  }
  function sizesForColor(color){
    var nc=norm(color);
    return variants.filter(function(v){ return !nc||norm(v.color)===nc; }).map(function(v){ return norm(v.size); });
  }

  function bestVariant(size, color, field){
    var ns=norm(size), nc=norm(color), i, v;
    for(i=0;i<variants.length;i++){ v=variants[i]; if(norm(v.size)===ns&&norm(v.color)===nc) return v; }
    if(field==="size"&&ns){ for(i=0;i<variants.length;i++){ if(norm(variants[i].size)===ns) return variants[i]; } }
    if(field==="color"&&nc){ for(i=0;i<variants.length;i++){ if(norm(variants[i].color)===nc) return variants[i]; } }
    return variants[0]||null;
  }

  function renderGallery(variant){
    var imgs=(variant&&Array.isArray(variant.images)&&variant.images.length)?variant.images:prodImgs;
    var idx=(variant&&Number.isInteger(variant.mainImageIndex))?variant.mainImageIndex:0;
    if(mainImg&&imgs.length){ mainImg.src=imgs[idx]||imgs[0]; }
    if(!thumbRow) return;
    thumbRow.innerHTML=imgs.map(function(src){
      return '<button type="button" class="thumb-button" data-thumb-src="'+esc(src)+'">'
            +'<img src="'+esc(src)+'" class="thumb-item" alt="thumb"/></button>';
    }).join("");
  }

  function syncUI(variant){
    if(!variant){ console.warn("[PD] syncUI: no variant"); return; }
    console.log("[PD] syncUI → size:", variant.size, "color:", variant.color, "stock:", variant.stock);

    /* hidden form inputs */
    if(sizeInput)  sizeInput.value  = variant.size  || "";
    if(colorInput) colorInput.value = variant.color || "";

    var as=norm(variant.size), ac=norm(variant.color);

    /* size pills */
    var vs=sizesForColor(variant.color);
    sizeBtns.forEach(function(b){
      var s=norm(b.dataset.sizeOption);
      b.classList.toggle("active", s===as);
      b.classList.toggle("variant-unavailable", vs.indexOf(s)<0);
    });

    /* color pills */
    var vc=colorsForSize(variant.size);
    colorBtns.forEach(function(b){
      var c=norm(b.dataset.colorOption);
      b.classList.toggle("active", c===ac);
      b.classList.toggle("variant-unavailable", vc.indexOf(c)<0);
    });

    /* price */
    if(priceEl) priceEl.textContent="\u20b9"+variant.price;
    if(origPrEl){
      if(variant.hasDiscount&&variant.originalPrice>variant.price){
        origPrEl.hidden=false; origPrEl.textContent="\u20b9"+variant.originalPrice;
      } else { origPrEl.hidden=true; }
    }

    /* gallery */
    renderGallery(variant);

    /* label */
    if(labelEl){
      var p=[];
      if(variant.size)  p.push("Size "+variant.size);
      if(variant.color) p.push("Color "+variant.color);
      labelEl.textContent="Selected: "+(p.join(" | ")||"Default option");
    }

    /* stock */
    if(stockBox&&canSell){
      if(variant.stock<=0)      stockBox.innerHTML='<span class="danger-text">Sold out</span>';
      else if(variant.stock<4)  stockBox.innerHTML='<span class="low-stock-text">Only '+variant.stock+' left</span>';
      else                      stockBox.innerHTML='<span class="success-text">In stock</span>';
    }

    /* status */
    if(statusP){
      statusP.textContent=!canSell?availMsg
        :variant.stock<=0?"This variant is currently sold out."
        :variant.stock<4?"Almost few pieces left. Hurry up."
        :"Ready to order.";
    }

    /* add-to-cart button */
    if(cartBtn){
      var out=variant.stock<=0;
      cartBtn.disabled=!canSell||out;
      cartBtn.textContent=!canSell?initLabel:out?"Sold out":"Add to cart";
    }
  }

  /* size click */
  sizeBtns.forEach(function(btn){
    btn.addEventListener("click", function(){
      var sz=btn.dataset.sizeOption||"";
      var cl=colorInput?colorInput.value:"";
      console.log("[PD] size clicked:", sz, "current color:", cl);
      syncUI(bestVariant(sz,cl,"size"));
    });
  });

  /* color click */
  colorBtns.forEach(function(btn){
    btn.addEventListener("click", function(){
      var cl=btn.dataset.colorOption||"";
      var sz=sizeInput?sizeInput.value:"";
      console.log("[PD] color clicked:", cl, "current size:", sz);
      syncUI(bestVariant(sz,cl,"color"));
    });
  });

  /* thumbnails */
  if(thumbRow){
    thumbRow.addEventListener("click",function(e){
      var b=e.target.closest("[data-thumb-src]");
      if(b&&mainImg) mainImg.src=b.dataset.thumbSrc;
    });
  }

  /* zoom */
  if(frame&&mainImg){
    frame.addEventListener("mousemove",function(e){
      var r=frame.getBoundingClientRect();
      mainImg.style.transformOrigin=((e.clientX-r.left)/r.width*100)+"% "+((e.clientY-r.top)/r.height*100)+"%";
      mainImg.style.transform="scale(3.22)";
    });
    frame.addEventListener("mouseleave",function(){ mainImg.style.transform="scale(1)"; });
  }

  /* tabs */
  tabs.forEach(function(tab){
    tab.addEventListener("click",function(){
      var t=tab.dataset.detailTab;
      tabs.forEach(function(i){ i.classList.toggle("active",i===tab); });
      panels.forEach(function(p){ p.classList.toggle("active",p.dataset.detailPanel===t); });
    });
  });

  /* init */
  (function(){
    var s=sizeInput?sizeInput.value:"";
    var c=colorInput?colorInput.value:"";
    var init=null, i;
    for(i=0;i<variants.length;i++){
      if(norm(variants[i].size)===norm(s)&&norm(variants[i].color)===norm(c)){ init=variants[i]; break; }
    }
    syncUI(init||variants[0]||null);
  })();

  /* flash dismiss */
  if(flash){
    setTimeout(function(){
      flash.remove();
      var u=new URL(location.href); u.searchParams.delete("message");
      history.replaceState({},"",u.pathname+u.search);
    },3000);
  }

})();
