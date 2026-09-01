// ==============================
// GLOBAL STATE
// ==============================
const WHATSAPP_NUMBER = "919458509972"; // Single source of truth for phone number

let currentPage = 1;
const productsPerPage = 24;
let modalQuantity = 1;
let lastOrderId = parseInt(localStorage.getItem("lastOrderId")) || 100;
let currentProductIndex = 0;
let currentProducts = [];
let currentModalProduct = null; // FIX: was never declared
let cart = JSON.parse(localStorage.getItem("radheCart")) || [];
let allProducts = [];
let filteredProducts = [];
let quickQty = {}; // FIX: moved to top, was declared near bottom
let touchStartX = 0;
let touchEndX = 0;

// ==============================
// MODAL QUANTITY
// ==============================
function increaseQty() {
  modalQuantity++;
  document.getElementById("modalQty").innerText = modalQuantity;
}

function decreaseQty() {
  if (modalQuantity > 1) {
    modalQuantity--;
    document.getElementById("modalQty").innerText = modalQuantity;
  }
}

// ==============================
// CART SYSTEM
// ==============================
function updateCartStorage() {
  try {
    localStorage.setItem("radheCart", JSON.stringify(cart));
  } catch(e) {
    console.warn("Cart storage full:", e);
  }
  updateCartUI();
}

function updateCartUI() {
  const cartPanel = document.getElementById("cartPanel");
  const isOpen = cartPanel?.classList.contains("open");
  const cartDiv = document.getElementById("cartItems");
  const cartCount = document.getElementById("cartCount");

  cart = JSON.parse(localStorage.getItem("radheCart")) || [];

  const totalItems = cart.reduce((sum, item) => sum + (item.qty || 1), 0);

  if (cartCount) cartCount.innerText = totalItems;

  const modalCartCount = document.getElementById("modalCartCount");
  if (modalCartCount) modalCartCount.innerText = cart.length;

  const mobileCartCount = document.getElementById("mobileCartCount");
  if (mobileCartCount) mobileCartCount.innerText = totalItems;

  if (!cartDiv) return;
    if (isOpen && cartPanel) cartPanel.classList.add("open");
  if (cart.length === 0) {
    cartDiv.innerHTML = `
  <div class="empty-cart">
    <div style="font-size:48px">🛒</div>
    <p style="font-weight:600;margin-top:10px">Your cart is empty</p>
    <small>Browse products and add items</small>
  </div>
`;
    return;
  }

  const cartHeader = document.querySelector(".cart-header h3");
  if (cartHeader) cartHeader.innerText = `Your Cart (${totalItems})`;

  let subtotal = 0;
  cartDiv.innerHTML = "";

  cart.forEach((item, index) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.qty) || 1;
    subtotal += price * qty;

    cartDiv.innerHTML += `
      <div class="cart-item" data-index="${index}">
        <img src="${item.image}" class="cart-thumb">
        <div class="cart-details">
          <strong>${item.name}</strong>
          <p>₹${item.price} per pack</p>
          <p class="cart-meta">${item.quantity || ""}</p>
          <div class="qty-controls">
            <button class="qty-minus">−</button>
            <span>${item.qty}</span>
            <button class="qty-plus">+</button>
          </div>
          <div class="item-subtotal">
            Subtotal: ₹${price * qty} (${qty})
          </div>
          <span class="remove-item">🗑 Remove</span>
        </div>
      </div>
    `;
  });

  cartDiv.innerHTML += `
    <div class="cart-subtotal">
      <hr>
      <h4>Total: ₹${subtotal}</h4>
      <p class="shipping-note">Shipping charges calculated separately</p>
    </div>
    <div class="cart-actions">
      <button class="clear-cart-btn" onclick="clearCart()">Clear Cart</button>
    </div>
  `;

  if (isOpen) cartPanel.classList.add("open");
}

function clearCart(event) {
  if (event) event.stopPropagation();
  cart = [];
  updateCartStorage();
}

function addToCart(event, name, image, price, quantity, sku, quantityText) {
  if (event) event.stopPropagation();

  price = Number(price) || 0;
  quantity = Number(quantity) || 1;

  const existing = cart.find(item => item.name === name);

  if (existing) {
    existing.qty += quantity;
  } else {
    cart.push({
      name,
      image,
      price,
      sku,
      qty: quantity,
      quantity: quantityText || ""
    });
  }

  updateCartStorage();
}

function removeFromCart(index, event) {
  event.stopPropagation();
  cart.splice(index, 1);
  updateCartStorage();
}

function toggleCart() {
  const panel = document.getElementById("cartPanel");
  if (!panel) return;
  panel.classList.toggle("open");
}

// ==============================
// WHATSAPP ORDER
// ==============================
function sendWhatsAppOrder() {
  if (cart.length === 0) {
    alert("Cart is empty");
    return;
  }

  lastOrderId += 1;
  localStorage.setItem("lastOrderId", lastOrderId);

  let total = 0;
  let totalItems = 0;
  let grandPieces = 0;

  let message = `🛍 *Radhe Handicraft Order*\n\n`;
  message += `🆔 *Order ID:* ${lastOrderId}\n\n`;

  cart.forEach((item, index) => {
    const qty = Number(item.qty) || 1;
    const price = Number(item.price) || 0;
    const sku = item.sku || "N/A";
    const subtotal = price * qty;

    // FIX: correctly extract numeric pieces from quantity string
    const piecesMatch = (item.quantity || "").replace(/\D/g, "");
    const piecesPerPack = parseInt(piecesMatch) || 0;
    const totalPieces = qty * piecesPerPack;

    total += subtotal;
    totalItems += qty;
    grandPieces += totalPieces;

    message += `📦 *Item ${index + 1}*\n`;
    message += `Name: ${item.name}\n`;
    message += `SKU: ${sku}\n`;
    message += `Pack Size: ${item.quantity || ""}\n`;
    message += `Qty: ${qty} pack(s)\n`;
    message += `Total Pieces: ${totalPieces}\n`;
    message += `₹${price} per pack\n`;
    message += `Total: ₹${subtotal}\n\n`;
  });

  message += `---------------------------\n`;
  message += `🛒 Total Packs: ${totalItems}\n`;
  message += `📦 Total Pieces: ${grandPieces}\n`;
  message += `💰 Estimated Total: ₹${total}\n\n`;

  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`, "_blank");
}

// ==============================
// LOAD PRODUCTS
// ==============================
function loadProducts() {
  // Determine which catalogue this page shows. raw.html -> raw materials,
  // festive.html -> festive collection. Both share this same script.js.
  const isFestivePage = window.location.pathname.includes("festive");
  const apiEndpoint = isFestivePage ? "/api/festive" : "/api/products";
  const container = document.getElementById("rawContainer");

  if (container) {
    container.innerHTML = `
      <div class="skeleton-card">
        <div class="skeleton-img"></div>
        <div class="skeleton-text">
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
        </div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton-img"></div>
        <div class="skeleton-text">
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
        </div>
      </div>
    `;
  }

  fetch(apiEndpoint)
    .then(res => res.json())
    .then(data => {

      function splitSizes(str) {
        return String(str || "").split(",").map(s => s.trim()).filter(s => s !== "");
      }
      function splitPipe(str) {
        // Split by semicolon for multiple values, fallback to whole string
        const parts = String(str || "").split(";").map(s => s.trim()).filter(s => s !== "");
        return parts.length > 0 ? parts : [""];
      }
      // Normalise shorthand unit codes in quantity strings:
// p / P / pcs / piece  → Pieces
// m / mtr / meter      → Metres
// kg / kgs / kilo      → Kg
// g / gm / gms / gram  → Grams
// dz / doz / dozen     → Dozen
// yd / yds / yard      → Yards
// ft / feet / foot     → Feet
// set / sets           → Sets
// roll / rolls         → Rolls
function normalizeQuantity(str) {
  if (!str) return str;
  return str.replace(/(\d+\.?\d*)\s*([a-zA-Z.]+)/g, function(_, num, unit) {
    const u = unit.toLowerCase().replace(/\.$/, "");
    const map = {
      p: "Pieces", pcs: "Pieces", pc: "Pieces",
      piece: "Pieces", pieces: "Pieces",
      m: "Metres", mtr: "Metres", meter: "Metres",
      metre: "Metres", meters: "Metres", metres: "Metres",
      kg: "Kg", kgs: "Kg", kilo: "Kg", kilos: "Kg",
      g: "Grams", gm: "Grams", gms: "Grams",
      gram: "Grams", grams: "Grams",
      dz: "Dozen", doz: "Dozen", dozen: "Dozen",
      yd: "Yards", yds: "Yards", yard: "Yards", yards: "Yards",
      ft: "Feet", feet: "Feet", foot: "Feet",
      set: "Sets", sets: "Sets",
      roll: "Rolls", rolls: "Rolls",
      i: "Inch", in: "Inch", inch: "Inch", inches: "Inch",
    };
    const full = map[u];
    return full ? num + " " + full : num + " " + unit;
  });
}
      function parsePrice(str) {
        const n = Number(String(str || 0).replace(/,/g, "").trim());
        return isNaN(n) ? 0 : n;
      }

      data.forEach(p => {
        p.sizes    = splitSizes(p.size).map(normalizeQuantity);
        p.prices   = splitPipe(p.price);
        p.quantity = splitPipe(p.quantity).map(normalizeQuantity);

        // Fallback: ensure at least one size
        if (p.sizes.length === 0) p.sizes = ["N/A"];

        const isSingleSizeMultiQty = p.sizes.length === 1 && p.prices.length > 1;
        p.isSingleSizeMultiQty = isSingleSizeMultiQty;

        if (isSingleSizeMultiQty) {
          p.variants = p.prices.map((pr, i) => ({
            size:     p.sizes[0].trim(),
            price:    parsePrice(pr),
            quantity: (p.quantity[i] || "").trim()
          }));
        } else {
          p.variants = p.sizes.map((s, i) => ({
            size:     s.trim(),
            price:    parsePrice(p.prices[i] || 0),
            quantity: (p.quantity[i] || "").trim()
          }));
        }

        // Final safety: always ensure at least one variant
        if (!p.variants || p.variants.length === 0) {
          p.variants = [{ size: p.size || "N/A", price: parsePrice(p.price), quantity: p.quantity || "" }];
        }
      });

      data.sort((a, b) => a.name.localeCompare(b.name));

      allProducts      = data;
      filteredProducts = [...allProducts];

      renderProducts(filteredProducts);
      populateCategoryFilter();
    })
  .catch(err => {
  console.error("Error loading products:", err);
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Something went wrong</h3>
        <p>Please try again later.</p>
      </div>
    `;
  }
})
.finally(() => checkSharedProduct()); // ← added
}

// ==============================
// RENDER PRODUCTS
// ==============================

// ==============================
// VARIANT BUTTON BUILDER
// ==============================
function buildVariantButtons(p, globalIndex) {
  if (p.isSingleSizeMultiQty) {
    return p.variants.map(function(v, i) {
      // Extract number and unit separately e.g. "100 Pcs" -> "100" + "Pcs"
      var match = v.quantity ? v.quantity.toString().match(/(\d+)\s*(.*)/) : null;
      var num   = match ? match[1] : (i + 1);
      var unit  = match && match[2] ? match[2].trim() : "";
      var label = unit ? num + '<span class="qty-unit">' + unit + '</span>' : num;
      var activeClass = i === 0 ? "active-size" : "";
      return '<button class="qty-pill-btn ' + activeClass + '" data-index="' + globalIndex + '" onclick="selectVariant(event,' + globalIndex + ',' + i + ')" title="' + (v.quantity || "") + '">' + label + '</button>';
    }).join("");
  } else {
    return p.variants.map(function(v, i) {
      var activeClass = i === 0 ? "active-size" : "";
      return '<button class="size-btn ' + activeClass + '" data-index="' + globalIndex + '" onclick="selectVariant(event,' + globalIndex + ',' + i + ')">' + v.size + '</button>';
    }).join("");
  }
}

function renderProducts(products) {
  const container = document.getElementById("rawContainer");
  if (!container) return;

  container.innerHTML = "";

  const resultCount = document.getElementById("resultCount");
  if (resultCount) resultCount.innerText = `${products.length} products found`;

  const start = (currentPage - 1) * productsPerPage;
  const end   = start + productsPerPage;
  const paginatedProducts = products.slice(start, end);

  currentProducts = products;

  paginatedProducts.forEach((p, index) => {
    const globalIndex = start + index;

    let coloursHTML = "";
    const coloursRaw = p.availableColours || p.colours;
    if (coloursRaw) {
      coloursHTML = Array.isArray(coloursRaw)
        ? coloursRaw.join(", ")
        : coloursRaw;
    }

    // ✅ FULL CARD HTML (FIXED)
    container.innerHTML += `
      <div class="product-row" data-index="${globalIndex}">

        <div class="row-image" style="position:relative">
  <img id="img-${globalIndex}" 
       alt="${p.name}" 
       onclick="handleImageClick(event, ${globalIndex})"
       loading="lazy">
  <button class="img-share-btn" onclick="shareProduct(event, ${globalIndex})" title="Share">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
  </button>
</div>

        <div class="row-details">
          <h3>${p.name}</h3>
          <p class="short-desc">${[p.description || p.material, p.size].filter(Boolean).join(" • ")}</p>

          <div class="full-details" id="details-${p.SKU}">
            <p>Quantity: ${p.quantity || " "}</p>
            ${coloursHTML ? `<p>Colours: ${coloursHTML}</p>` : ""}
          </div>

          <div class="row-price">

            <div class="size-options" id="size-group-${globalIndex}">
              ${buildVariantButtons(p, globalIndex)}
            </div>

            <div class="price" id="price-${globalIndex}">₹${p.variants[0].price}</div>
            <div class="pack-info" id="pack-${globalIndex}">${p.variants[0].quantity || ""}</div>

            <div class="quick-qty">
              <button class="quick-minus" data-index="${globalIndex}">-</button>
              <span id="quickQty-${globalIndex}">1</span>
              <button class="quick-plus" data-index="${globalIndex}">+</button>
            </div>
      

            <button onclick="addToCartVariant(event, ${globalIndex})" class="add-cart-btn">
              Add to Cart
            </button>

          </div>
        </div>

      </div>
    `;

    // Fetch images from API
    fetch(`/api/images/${p.SKU}`)
      .then(res => res.json())
      .then(images => {
        const imgEl = document.getElementById(`img-${globalIndex}`);
        p.images = images.length > 0 ? images : (p.image ? [p.image] : ["/images/default.jpg"]);
        imgEl.onload = () => imgEl.classList.add("loaded");
        imgEl.src = p.images[0];
      })
      .catch(() => {
        const imgEl = document.getElementById(`img-${globalIndex}`);
        p.images = p.image ? [p.image] : ["/images/default.jpg"];
        imgEl.onload = () => imgEl.classList.add("loaded");
        imgEl.src = p.images[0];
      });
  });

  // (rest of your code unchanged)
  document.querySelectorAll(".product-row").forEach(row => {
    row.addEventListener("click", function(e) {
      if (e.target.closest(".quick-qty") || e.target.tagName === "BUTTON") return;
      openModal(parseInt(this.dataset.index));
    });
  });

  document.querySelectorAll(".quick-plus").forEach(btn => {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      const idx = this.dataset.index;
      quickQty[idx] = (quickQty[idx] || 1) + 1;
      document.getElementById(`quickQty-${idx}`).innerText = quickQty[idx];
    });
  });

  document.querySelectorAll(".quick-minus").forEach(btn => {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      const idx = this.dataset.index;
      if (!quickQty[idx] || quickQty[idx] <= 1) return;
      quickQty[idx] -= 1;
      document.getElementById(`quickQty-${idx}`).innerText = quickQty[idx];
    });
  });

  setupPagination(products);
}
// ==============================
// MODAL
// ==============================
function openModal(index) {
  currentProductIndex = index;
  modalQuantity = 1;
  document.getElementById("modalQty").innerText = 1;
  updateModal();
  document.getElementById("productModal").classList.add("show");
  document.body.style.overflow = "hidden";
  // Track recently viewed
  addToRecentlyViewed(currentProducts[index]);
  renderRecentlyViewed();
}

function closeModal() {
  document.getElementById("productModal").classList.remove("show");
  document.body.style.overflow = "auto";
}

function updateModal(direction = "next") {
  const p = currentProducts[currentProductIndex];
  p.selectedVariant = 0;
  currentModalProduct = p;

  const img = document.getElementById("modalImage");

  let sizeHTML = "";
  p.variants.forEach((v, i) => {
    const activeClass = i === 0 ? "active-size" : "";
    if (p.isSingleSizeMultiQty) {
      const match = v.quantity ? v.quantity.toString().match(/(\d+)\s*(.*)/) : null;
      const num  = match ? match[1] : (i + 1);
      const unit = match && match[2] ? match[2].trim() : "";
      const label = unit ? num + '<span class="qty-unit">' + unit + '</span>' : num;
      sizeHTML += '<button class="qty-pill-btn ' + activeClass + '" onclick="selectModalVariant(event,' + i + ')" title="' + (v.quantity || "") + '">' + label + '</button>';
    } else {
      sizeHTML += '<button class="size-btn ' + activeClass + '" onclick="selectModalVariant(event,' + i + ')">' + v.size.replace(' inch', '"') + '</button>';
    }
  });
  document.getElementById("modalSizes").innerHTML = sizeHTML;

  // Animate main image
  img.style.transition = "transform 0.3s ease, opacity 0.3s ease";
  img.style.transform = direction === "next" ? "translateX(-40px)" : "translateX(40px)";
  img.style.opacity = "0";

  fetch(`/api/images/${p.SKU}`)
    .then(res => res.json())
    .then(images => {
      p.images = images.length > 0 ? images : (p.image ? [p.image] : ["/images/default.jpg"]);

      setTimeout(() => {
        img.src = p.images[0];
        img.style.transform = direction === "next" ? "translateX(40px)" : "translateX(-40px)";
        setTimeout(() => {
          img.style.transform = "translateX(0)";
          img.style.opacity = "1";
        }, 20);
      }, 200);

      const thumbContainer = document.getElementById("modalThumbnails");
      if (thumbContainer) {
        thumbContainer.innerHTML = "";
        p.images.forEach((src, i) => {
          const thumb = document.createElement("img");
          thumb.src = src;
          thumb.className = "modal-thumb" + (i === 0 ? " active-thumb" : "");
          thumb.addEventListener("click", () => selectModalImage(src, thumb));
          thumbContainer.appendChild(thumb);
        });
        thumbContainer.style.display = p.images.length > 1 ? "flex" : "none";
      }
    })
    .catch(() => {
      p.images = p.image ? [p.image] : ["/images/default.jpg"];
      setTimeout(() => {
        img.src = p.images[0];
        img.style.transform = direction === "next" ? "translateX(40px)" : "translateX(-40px)";
        setTimeout(() => { img.style.transform = "translateX(0)"; img.style.opacity = "1"; }, 20);
      }, 200);
    });

  document.getElementById("modalName").innerText = p.name;
  document.getElementById("modalPrice").innerText = "₹" + p.variants[0].price;
  document.getElementById("modalMaterial").innerText =
    p.material ? "Material: " + p.material : (p.description || "");
  document.getElementById("modalSize").innerText = "Size: " + p.variants[0].size;
  document.getElementById("modalQuantity").innerText = "Quantity: " + p.variants[0].quantity;
 
document.getElementById("modalColours").innerText =
    (p.availableColours || p.colours) ? "Colours: " + (p.availableColours || p.colours) : "";

  // Render similar products
  renderSimilarProducts(p);
}
function selectModalImage(src, thumbEl) {
  const img = document.getElementById("modalImage");
  img.style.opacity = "0";
  setTimeout(() => {
    img.src = src;
    img.style.opacity = "1";
  }, 150);

  // Update active thumbnail highlight
  document.querySelectorAll(".modal-thumb").forEach(t => t.classList.remove("active-thumb"));
  thumbEl.classList.add("active-thumb");
}

function nextProduct() {
  currentProductIndex = (currentProductIndex + 1) % currentProducts.length;
  updateModal("next");
}

function prevProduct() {
  currentProductIndex = (currentProductIndex - 1 + currentProducts.length) % currentProducts.length;
  updateModal("prev");
}

// ==============================
// SWIPE SUPPORT (touch)
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  const modalImage = document.getElementById("modalImage");
  if (modalImage) {
    modalImage.addEventListener("touchstart", e => {
      touchStartX = e.changedTouches[0].screenX;
    });
    modalImage.addEventListener("touchend", e => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    });
  }
});
// Position fixed search bar below header
;


function handleSwipe() {
  const threshold = 50;
  if (touchEndX < touchStartX - threshold) nextProduct();
  if (touchEndX > touchStartX + threshold) prevProduct();
}

// ==============================
// FILTERS + SEARCH
// ==============================
function applyFilters(selectedCategory = "all") {
  const searchValue = document.getElementById("searchInput")?.value.toLowerCase() || "";

  filteredProducts = allProducts
    .filter(p => {
      // Split search into individual words and check all match
const searchWords = searchValue.trim().split(/\s+/);
const searchTarget = (
  p.name + " " + (p.material || p.description || "") + " " + p.category + " " + (p.availableColours || p.colours || "")
).toLowerCase();
const matchesSearch = searchWords.every(word => searchTarget.includes(word));

      const matchesCategory =
        selectedCategory === "all" ||
        (p.category && p.category.split(",").map(c => c.trim()).includes(selectedCategory));

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  currentPage = 1;
  renderProducts(filteredProducts);
  // FIX: removed stray "+" that was here — was crashing all JS
}

function handleSearchInput() {
  const value = document.getElementById("searchInput").value.toLowerCase();
  const suggestionBox = document.getElementById("suggestions");

  if (!value) {
    suggestionBox.style.display = "none";
    applyFilters();
    return;
  }

const matches = allProducts.filter(p => {
  const searchText = (
    p.name + " " + (p.material || p.description || "") + " " + p.category + " " + (p.availableColours || p.colours || "")
  ).toLowerCase();
  const words = value.trim().split(/\s+/);
  return words.every(word => searchText.includes(word));
});

  suggestionBox.innerHTML = "";
  matches.slice(0, 6).forEach(p => {
    const div = document.createElement("div");
    div.textContent = p.name;
    div.addEventListener("click", () => selectSuggestion(p.name));
    suggestionBox.appendChild(div);
});
  
  suggestionBox.style.display = matches.length ? "block" : "none";
}

function selectSuggestion(name) {
  document.getElementById("searchInput").value = name;
  document.getElementById("suggestions").style.display = "none";
  applyFilters();
}
function populateCategoryFilter() {
  const container = document.getElementById("categoryChips");
  const mobileContainer = document.getElementById("categoryChipsMobile");

  const categories = [
    ...new Set(
      allProducts.flatMap(p =>
        p.category ? p.category.split(",").map(c => c.trim()) : []
      )
    )
  ];

  const chipsHTML = `<span class="chip active-chip" data-cat="all">All</span>` +
    categories.map(cat => `<span class="chip" data-cat="${cat}">${cat}</span>`).join("");

  if (container) container.innerHTML = chipsHTML;
  if (mobileContainer) mobileContainer.innerHTML = chipsHTML;

  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", function() {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active-chip"));
      this.classList.add("active-chip");
      applyFilters(this.dataset.cat);
    });
  });
}


// ==============================
// VARIANT SELECTION
// ==============================
function selectVariant(event, index, variantIndex) {
  event.stopPropagation();

  const p = currentProducts[index];
  p.selectedVariant = variantIndex;
  const v = p.variants[variantIndex];

  document.getElementById(`price-${index}`).innerText = "₹" + v.price;
  document.getElementById(`pack-${index}`).innerText = v.quantity || "";

  // Remove active from ALL buttons in this product's size group
  const group = document.getElementById(`size-group-${index}`);
  if (group) {
    group.querySelectorAll(".size-btn, .qty-pill-btn").forEach(btn => {
      btn.classList.remove("active-size");
    });
  }

  // Add active to clicked button only
  event.currentTarget.classList.add("active-size");
}

function selectModalVariant(event, variantIndex) {
  event.stopPropagation();

  const p = currentProducts[currentProductIndex];
  p.selectedVariant = variantIndex;
  const v = p.variants[variantIndex];

  document.getElementById("modalPrice").innerText = "₹" + v.price;
  document.getElementById("modalQuantity").innerText = v.quantity;

  const buttons = document.querySelectorAll("#modalSizes .size-btn, #modalSizes .qty-pill-btn");
  buttons.forEach(btn => btn.classList.remove("active-size"));
  event.target.closest("button").classList.add("active-size");
}

function addToCartVariant(event, index) {
  event.stopPropagation();

  const p = currentProducts[index];
  const selectedIndex = p.selectedVariant || 0;
  const v = p.variants[selectedIndex];
  const quantity = quickQty[index] || 1;
  const itemName = `${p.name} (${v.size})`;

  const existing = cart.find(item => item.name === itemName);

  if (existing) {
    existing.qty += quantity;
  } else {
    cart.push({
      name:     itemName,
      image:    p.images ? p.images[0] : "/images/default.jpg",
      price:    v.price,
      qty:      quantity,
      sku:      p.sku,
      quantity: v.quantity || ""
    });
  }

  updateCartStorage();
    const btn = event.currentTarget;
  const original = btn.textContent;
  btn.textContent = "✓ Added!";
  btn.style.background = "linear-gradient(135deg, #2ecc71, #27ae60)";
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = "";
  }, 1200);


}

// ==============================
// IMAGE PREVIEW
// ==============================
function openImagePreview(image) {
  document.getElementById("previewImg").src = image;
  // FIX: use only classList, not inline style (was conflicting)
  document.getElementById("imagePreview").classList.add("show");
  document.getElementById("imagePreview").style.display = "flex";
}

function closeImagePreview() {
  // FIX: use both to consistently close
  document.getElementById("imagePreview").classList.remove("show");
  document.getElementById("imagePreview").style.display = "none";
}

function handleImageClick(event, index) {
  event.stopPropagation();
  if (event.detail === 2) {
    openImagePreview(currentProducts[index].image);
  } else {
    openModal(index);
  }
}

// ==============================
// MISC HELPERS
// ==============================
function toggleMenu() {
  const nav = document.getElementById("navLinks");
  if (nav) nav.classList.toggle("show");
}

function toggleFilter() {
  document.querySelector(".filter-sidebar").classList.toggle("active");
}

function toggleDetails(event, id) {
  const box = document.getElementById(id);
  if (box.style.display === "block") {
    box.style.display = "none";
    event.target.innerText = "View Details";
  } else {
    box.style.display = "block";
    event.target.innerText = "Hide Details";
  }
}

function toggleDetailsRow(event, id) {
  if (event.target.tagName === "BUTTON") return;
  const details = document.getElementById(id);
  if (!details) return;
  details.classList.toggle("show-details");
}

function increaseCartQty(index, event) {
  event.stopPropagation();
  cart[index].qty = Number(cart[index].qty) + 1;
  updateCartStorage();
}

function decreaseCartQty(index, event) {
  event.stopPropagation();
  if (cart[index].qty > 1) {
    cart[index].qty = Number(cart[index].qty) - 1;
  } else {
    cart.splice(index, 1);
  }
  updateCartStorage();
}

function quickIncrease(index) {
  quickQty[index] = (quickQty[index] || 1) + 1;
  document.getElementById(`quickQty-${index}`).innerText = quickQty[index];
}

function quickDecrease(index) {
  if (!quickQty[index] || quickQty[index] <= 1) return;
  quickQty[index] -= 1;
  document.getElementById(`quickQty-${index}`).innerText = quickQty[index];
}


function setupPagination(products) {
  const paginationDiv = document.getElementById("pagination");
  if (!paginationDiv) return;

  paginationDiv.innerHTML = "";
  const pageCount = Math.ceil(products.length / productsPerPage);
  if (pageCount <= 1) return;

  paginationDiv.innerHTML = `
    <button 
      onclick="goToPage(${currentPage - 1})" 
      ${currentPage === 1 ? "disabled" : ""}
      style="opacity:${currentPage === 1 ? 0.4 : 1}">
      ← Prev
    </button>
    <span style="padding:6px 14px;font-weight:600;font-size:14px">
      Page ${currentPage} of ${pageCount}
    </span>
    <button 
      onclick="goToPage(${currentPage + 1})" 
      ${currentPage === pageCount ? "disabled" : ""}
      style="opacity:${currentPage === pageCount ? 0.4 : 1}">
      Next →
    </button>
  `;
}

function goToPage(page) {
  currentPage = page;
  renderProducts(filteredProducts);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==============================
// PDF INVOICE
// ==============================
async function generateInvoice(orderId, customer) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(18);
  doc.text("RADHE HANDICRAFT", 20, y); y += 8;
  doc.setFontSize(10);
  doc.text("Art that speaks, tradition that lives", 20, y); y += 10;
  doc.line(20, y, 190, y); y += 10;
  doc.text(`Order ID: ${orderId}`, 20, y); y += 6;
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, y); y += 10;
  doc.text(`Name: ${customer.name}`, 20, y); y += 6;
  doc.text(`Phone: ${customer.phone}`, 20, y); y += 10;

  let grandTotal = 0;
  cart.forEach(item => {
    const total = item.price * item.qty;
    grandTotal += total;
    doc.text(`${item.name} (${item.sku})  x${item.qty}  ₹${total}`, 20, y);
    y += 6;
  });

  y += 10;
  doc.line(20, y, 190, y); y += 8;
  doc.setFontSize(12);
  doc.text(`Grand Total: ₹${grandTotal}`, 20, y); y += 10;
  doc.setFontSize(9);
  doc.text("Delivery charges will be confirmed manually via WhatsApp.", 20, y);
  doc.save(`Invoice-${orderId}.pdf`);
}

// ==============================
// GLOBAL CLICK HANDLER
// ==============================
document.addEventListener("click", function(event) {
  const cartPanel    = document.getElementById("cartPanel");
  const nav          = document.getElementById("navLinks");
  const toggle       = document.querySelector(".menu-toggle");
  const suggestionBox = document.getElementById("suggestions");

  if (cartPanel?.classList.contains("open")) {
    const inside      = event.target.closest("#cartPanel");
    const cartIcon    = event.target.closest(".cart-icon");
    const floatCart   = event.target.closest(".modal-floating-cart");
    const mobileBtn   = event.target.closest(".mobile-cart-btn");
    if (!inside && !cartIcon && !floatCart && !mobileBtn) {
      cartPanel.classList.remove("open");
    }
  }

  if (nav?.classList.contains("show") &&
      !nav.contains(event.target) &&
      !toggle?.contains(event.target)) {
    nav.classList.remove("show");
  }

  if (suggestionBox &&
      !suggestionBox.contains(event.target) &&
      event.target.id !== "searchInput") {
    suggestionBox.style.display = "none";
  }
});
// ==============================
// MOBILE FILTER TOGGLE
// ==============================
function toggleMobileFilter() {
  const panel = document.getElementById("mobileFilterPanel");
  if (!panel) return;
  panel.classList.toggle("open");
}

// ==============================
// INIT
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  updateCartUI();

 // Inside DOMContentLoaded, after loadProducts():
if (document.getElementById("rawContainer")) {
  loadProducts();
  renderRecentlyViewed(); // ← update this line
}

  // Modal add to cart button
  const modalAddBtn = document.getElementById("modalAddToCart");
  if (modalAddBtn) {
    modalAddBtn.addEventListener("click", function(event) {
      if (!currentModalProduct) return;
      const v = currentModalProduct.variants[currentModalProduct.selectedVariant || 0];
      addToCart(
        event,
        `${currentModalProduct.name} (${v.size})`,
        currentModalProduct.images ? currentModalProduct.images[0] : currentModalProduct.image,
        v.price,
        modalQuantity,
        currentModalProduct.sku,
        v.quantity || ""
      );
    });
  }

  // Cart panel delegated click handler
  const cartPanel = document.getElementById("cartPanel");
  if (cartPanel) {
    cartPanel.addEventListener("click", function(e) {
      e.stopPropagation();
      const item = e.target.closest(".cart-item");
      if (!item) return;
      const index = parseInt(item.dataset.index);

      if (e.target.classList.contains("qty-plus")) {
        cart[index].qty = Number(cart[index].qty) + 1;
        updateCartStorage();
      }
      if (e.target.classList.contains("qty-minus")) {
        if (cart[index].qty > 1) {
          cart[index].qty = Number(cart[index].qty) - 1;
        } else {
          cart.splice(index, 1);
        }
        updateCartStorage();
      }
      if (e.target.classList.contains("remove-item")) {
        cart.splice(index, 1);
        updateCartStorage();
      }
    });
  }

  // Search enter key support
  // Search enter key support
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        applyFilters();
        const suggestions = document.getElementById("suggestions");
        if (suggestions) suggestions.style.display = "none";
      }
    });
  }

  // Lens tooltip on touch/hover      ← ADD FROM HERE
  const lensBtn = document.querySelector(".img-search-btn");
  const lensTooltip = document.getElementById("lensTooltip");
  if (lensBtn && lensTooltip) {
    lensBtn.addEventListener("mouseenter", () => {
      lensTooltip.style.display = "block";
    });
    lensBtn.addEventListener("mouseleave", () => {
      lensTooltip.style.display = "none";
    });
    lensBtn.addEventListener("touchstart", (e) => {
      if (lensTooltip.style.display !== "block") {
        e.preventDefault();
        lensTooltip.style.display = "block";
        setTimeout(() => lensTooltip.style.display = "none", 2500);
      }
    });
  }                                   // ← TO HERE

}); // ← this is the existing closing of DOMContentLoaded

// ==============================
// AI IMAGE SEARCH
// ==============================
async function handleImageSearch(event) {
  const file = event.target.files[0];
  if (!file) return;

  const status = document.getElementById("aiSearchStatus");
  if (status) status.style.display = "flex";

  let base64;
  try {
    base64 = await new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 600;
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        res(canvas.toDataURL("image/jpeg", 0.75).split(",")[1]);
      };
      img.onerror = () => rej(new Error("Failed to load image"));
      img.src = url;
    });
  } catch (err) {
    alert("Could not read image file.");
    if (status) status.style.display = "none";
    return;
  }

  // Send product list with name + category + material for better matching
  const productList = allProducts
    .map(p => `${p.name} (${p.category} | ${p.material})`)
    .join(", ");

  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, mimeType: "image/jpeg", productList })
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch(e) {
      throw new Error("Server returned invalid response");
    }

    if (data.error) {
      alert("API Error: " + data.error.message);
      if (status) status.style.display = "none";
      event.target.value = "";
      return;
    }

    // Extract AI text response
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const clean = aiText.replace(/```json|```/g, "").trim();

    let matchedNames = [];
    try {
      matchedNames = JSON.parse(clean);
    } catch(e) {
      // If JSON parse fails, try to extract product names from text
      matchedNames = allProducts
        .filter(p => aiText.toLowerCase().includes(p.name.toLowerCase()))
        .map(p => p.name);
    }

    // Match against catalogue - also do fuzzy matching on words
    const matched = allProducts.filter(p => {
      // Exact name match
      const exactMatch = matchedNames.some(
        name => name.toLowerCase() === p.name.toLowerCase()
      );
      if (exactMatch) return true;

      // Partial match - if AI returned partial name
      const partialMatch = matchedNames.some(name => {
        const n = name.toLowerCase();
        const pn = p.name.toLowerCase();
        return pn.includes(n) || n.includes(pn);
      });
      return partialMatch;
    });

    if (status) status.style.display = "none";

    if (matched.length === 0) {
      alert("No similar products found. Try a clearer image.");
      event.target.value = "";
      return;
    }

    filteredProducts = matched;
    currentPage = 1;
    renderProducts(filteredProducts);

    const resultCount = document.getElementById("resultCount");
    if (resultCount) resultCount.innerText = `📷 ${matched.length} similar products found`;

    event.target.value = "";

  } catch (err) {
    console.error("Image search error:", err);
    if (status) status.style.display = "none";
    alert("Image search failed: " + err.message);
    event.target.value = "";
  }
}
// ==============================
// PRODUCT SHARING
// ==============================
// ==============================
// SHARE — MEESHO STYLE BOTTOM SHEET
// ==============================
function shareProduct(event, globalIndex) {
  event.stopPropagation();
  const p = currentProducts[globalIndex];
  if (!p) return;
  openShareSheet(p);
}

function shareProductFromModal() {
  const p = currentModalProduct;
  if (!p) return;
  openShareSheet(p);
}

function openShareSheet(p) {
  // Remove existing
  const existing = document.getElementById("shareOverlay");
  if (existing) existing.remove();

  const productUrl = `${window.location.origin}/raw.html?product=${encodeURIComponent(p.SKU)}`;
  const waMessage = `🛍 *${p.name}* — Radhe Handicraft\nMaterial: ${p.material} | Size: ${p.size}\n\n🔗 View: ${productUrl}\n\n📞 Order: https://wa.me/${WHATSAPP_NUMBER}`;
  const imgSrc = (p.images && p.images[0]) ? p.images[0] : (p.image || "/images/default.jpg");

  const overlay = document.createElement("div");
  overlay.id = "shareOverlay";
  overlay.className = "share-overlay";
  overlay.innerHTML = `
    <div class="share-sheet" id="shareSheet">
      <div class="share-sheet-handle"></div>
      <div class="share-sheet-header">
        <span class="share-sheet-title">Share Product</span>
        <button class="share-sheet-close" onclick="closeShareSheet()">✕</button>
      </div>
      <div class="share-product-preview">
        <img src="${imgSrc}" alt="${p.name}">
        <div class="share-product-info">
          <div class="share-product-name">${p.name}</div>
          <div class="share-product-meta">${p.material} • ${p.size}</div>
        </div>
      </div>
      <div class="share-options">
        <button class="share-option wa" onclick="shareViaWhatsApp('${encodeURIComponent(waMessage)}')">
          <div class="share-option-icon">
            <i class="fab fa-whatsapp" style="color:#25D366"></i>
          </div>
          <span class="share-option-label">WhatsApp</span>
        </button>
        <button class="share-option copy" onclick="copyShareLink('${productUrl}', this)">
          <div class="share-option-icon">
            🔗
          </div>
          <span class="share-option-label">Copy Link</span>
        </button>
      </div>
      <div class="share-link-bar">
        <input class="share-link-text" value="${productUrl}" readonly>
        <button class="share-link-copy-btn" onclick="copyShareLink('${productUrl}', this)">Copy</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  setTimeout(() => {
    overlay.classList.add("show");
    document.getElementById("shareSheet").classList.add("show");
  }, 10);

  // Close on overlay click
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) closeShareSheet();
  });
}

function closeShareSheet() {
  const overlay = document.getElementById("shareOverlay");
  const sheet = document.getElementById("shareSheet");
  if (!overlay) return;
  overlay.classList.remove("show");
  if (sheet) sheet.classList.remove("show");
  setTimeout(() => overlay.remove(), 350);
}

function shareViaWhatsApp(encodedMessage) {
  window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
}

function copyShareLink(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    const original = btn.textContent;
    btn.textContent = "✔ Copied!";
    if (btn.classList.contains("share-link-copy-btn")) {
      btn.style.background = "#2ecc71";
    }
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = "";
    }, 2000);
  });
}

// On page load — open product from shared URL
function checkSharedProduct() {
  const params = new URLSearchParams(window.location.search);
  const sku = params.get("product");
  if (!sku) return;
  const index = allProducts.findIndex(p => p.SKU === sku);
  if (index !== -1) openModal(index);
}
// ==============================
// RECENTLY VIEWED
// ==============================
function addToRecentlyViewed(p) {
  let recent = JSON.parse(localStorage.getItem("recentlyViewed")) || [];
  // Remove if already exists
  recent = recent.filter(item => item.SKU !== p.SKU);
  // Add to front
  recent.unshift({
    SKU: p.SKU,
    name: p.name,
    material: p.material,
    size: p.size,
    image: (p.images && p.images[0]) ? p.images[0] : (p.image || "/images/default.jpg"),
    price: p.variants ? p.variants[0].price : 0
  });
  // Keep only last 6
  recent = recent.slice(0, 6);
  localStorage.setItem("recentlyViewed", JSON.stringify(recent));
}

function renderRecentlyViewed() {
  const recent = JSON.parse(localStorage.getItem("recentlyViewed")) || [];
  const section = document.getElementById("recentlyViewedSection");
  const container = document.getElementById("recentlyViewedContainer");
  if (!section || !container) return;

  if (recent.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  container.innerHTML = recent.map(p => `
    <div class="rv-card" onclick="openModalBySKU('${p.SKU}')">
      <div class="rv-img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
      </div>
      <div class="rv-info">
        <p class="rv-name">${p.name}</p>
        <p class="rv-price">₹${p.price}</p>
      </div>
    </div>
  `).join("");
}

function openModalBySKU(sku) {
  const index = currentProducts.findIndex(p => p.SKU === sku);
  if (index !== -1) {
    openModal(index);
  } else {
    // Product not in current filtered view — find in allProducts
    const index2 = allProducts.findIndex(p => p.SKU === sku);
    if (index2 !== -1) {
      filteredProducts = allProducts;
      currentProducts = allProducts;
      renderProducts(allProducts);
      setTimeout(() => openModal(index2), 100);
    }
  }
}
// ==============================
// SIMILAR PRODUCTS IN MODAL
// ==============================
function renderSimilarProducts(p) {
  const container = document.getElementById("similarContainer");
  const section = document.getElementById("modalSimilar");
  if (!container || !section) return;

  // Match by same category first, then by material
  const pCategories = (p.category || "").split(",").map(c => c.trim());

  let similar = allProducts.filter(item => {
    if (item.SKU === p.SKU) return false;
    const itemCats = (item.category || "").split(",").map(c => c.trim());
    return pCategories.some(cat => itemCats.includes(cat));
  });

  // If not enough, fill with same material
  if (similar.length < 5) {
    const byMaterial = allProducts.filter(item =>
      item.SKU !== p.SKU &&
      item.material === p.material &&
      !similar.find(s => s.SKU === item.SKU)
    );
    similar = [...similar, ...byMaterial];
  }

  // Shuffle and take 5
  similar = similar.sort(() => 0.5 - Math.random()).slice(0, 5);

  if (similar.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  container.innerHTML = similar.map(item => `
    <div class="similar-card" onclick="openModalBySKU('${item.SKU}')">
      <div class="similar-img-wrap">
        <img src="${item.image || '/images/default.jpg'}" alt="${item.name}" loading="lazy">
      </div>
      <p class="similar-name">${item.name}</p>
      <p class="similar-price">₹${item.variants ? item.variants[0].price : 0}</p>
    </div>
  `).join("");
}