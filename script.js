/* =========================================================
   Dinha Pérolas – comportamento do site
   Carrinho, filtros, busca, detalhes e WhatsApp
   ========================================================= */
(() => {
"use strict";

const WHATSAPP = "5571983018961";
const CART_KEY = "dinha_perolas_cart";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc = (s) => {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
};

let cart = loadCart();
let filterCategory = "all";
let filterQuery = "";
let quickViewProduct = null;
let quickViewSize = "";

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (e) {
    return [];
  }
}
function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
  catch (e) { console.warn("Não foi possível salvar o carrinho:", e); }
}

function getProduct(card) {
  const img = $(".card__media img", card);
  const desc = $(".card__desc", card);
  return {
    id: card.dataset.id || card.dataset.name,
    name: card.dataset.name || $("h3", card)?.textContent.trim() || "Produto Dinha Pérolas",
    category: card.dataset.category || "",
    price: Number(card.dataset.price),
    badge: card.dataset.badge || card.dataset.category || "",
    sizes: (card.dataset.sizes || "").split(",").map(s => s.trim()).filter(Boolean),
    image: img ? img.getAttribute("src") : "",
    description: desc ? desc.textContent.trim() : ""
  };
}

function selectedSize(card) {
  const active = $(".size.is-active:not(:disabled)", card);
  if (active) return active.dataset.size || active.textContent.trim();

  const firstAvailable = $(".size:not(:disabled)", card);
  if (firstAvailable) return firstAvailable.dataset.size || firstAvailable.textContent.trim();

  const sizes = (card.dataset.sizes || "").split(",").map(s => s.trim()).filter(Boolean);
  return sizes[0] || "A definir";
}

let toastTimer;
function showToast(msg) {
  const message = $("#toast-message");
  const toast = $("#toast");
  if (message) message.textContent = msg;
  if (toast) {
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  } else {
    console.info(msg);
  }
}

/* Menu mobile: o HTML usa .btn-sanduiche e #mobile-menu */
const menuBtn = $("#mobile-menu-btn") || $(".btn-sanduiche");
const mobileMenu = $("#mobile-menu");

function setMobileMenu(open) {
  if (!mobileMenu || !menuBtn) return;
  mobileMenu.hidden = !open;
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
}
if (menuBtn && mobileMenu) {
  menuBtn.addEventListener("click", () => setMobileMenu(mobileMenu.hidden));
  mobileMenu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMobileMenu(false);
  });
}

function applyFilters() {
  const grid = $("#product-grid");
  if (!grid) return;
  const q = normalize(filterQuery.trim());
  let visible = 0;
  $$(".card", grid).forEach(card => {
    const desc = $(".card__desc", card)?.textContent || "";
    const text = normalize(`${card.dataset.name || ""} ${desc} ${card.dataset.category || ""}`);
    const okCat = filterCategory === "all" || card.dataset.category === filterCategory;
    const show = okCat && (!q || text.includes(q));
    card.hidden = !show;
    if (show) visible++;
  });
  const noResults = $("#no-results");
  if (noResults) noResults.hidden = visible > 0;
}

const filters = $("#store-category-filters");
if (filters) {
  filters.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    filterCategory = chip.dataset.category || "all";
    $$(".chip", filters).forEach(c => {
      const on = c === chip;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-pressed", String(on));
    });
    applyFilters();
  });
}

["#catalog-search", "#mobile-search"].forEach(sel => {
  const field = $(sel);
  if (!field) return;
  field.addEventListener("input", (e) => {
    filterQuery = e.target.value;
    ["#catalog-search", "#mobile-search"].forEach(otherSel => {
      const other = $(otherSel);
      if (other && other !== field) other.value = filterQuery;
    });
    applyFilters();
  });
});

/* Adicionar produto: delegação de evento no catálogo */
const productGrid = $("#product-grid");
if (productGrid) {
  productGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;

    const sizeBtn = e.target.closest(".size");
    if (sizeBtn) {
      if (sizeBtn.disabled) return;
      $$(".size", card).forEach(b => {
        b.classList.toggle("is-active", b === sizeBtn);
        b.setAttribute("aria-pressed", String(b === sizeBtn));
      });
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;

    if (actionBtn.dataset.action === "add") {
      const product = getProduct(card);
      if (!Number.isFinite(product.price) || product.price <= 0) {
        showToast("Não foi possível identificar o preço deste produto.");
        console.error("Preço inválido no card:", card);
        return;
      }
      addToCart(product, selectedSize(card));
    } else if (actionBtn.dataset.action === "details") {
      openQuickView(card);
    }
  });
}

function addToCart(product, size, notes = "") {
  if (!product || !product.name || !Number.isFinite(product.price)) {
    showToast("Não foi possível adicionar este produto. Verifique os dados do cadastro.");
    return;
  }
  const safeSize = size || "A definir";
  // Inclui nome além do ID para evitar misturar produtos caso algum ID antigo esteja repetido.
  const key = `${product.id}|${product.name}|${safeSize}|${notes}`;
  const existing = cart.find(i => i.key === key);

  if (existing) {
    existing.quantity = Number(existing.quantity || 0) + 1;
  } else {
    cart.push({
      key, id: product.id, name: product.name, price: product.price,
      image: product.image || "", size: safeSize, notes, quantity: 1
    });
  }
  saveCart();
  renderCart();
  showToast(`"${product.name}" (${safeSize}) adicionado ao carrinho!`);
  openCart();
}

function renderCart() {
  const badge = $("#cart-badge");
  const box = $("#cart-items");
  const subtotal = $("#cart-subtotal");
  const totalEl = $("#cart-total");
  const count = cart.reduce((n, i) => n + Number(i.quantity || 0), 0);
  const total = cart.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);

  if (badge) badge.textContent = count;
  if (box) {
    if (!cart.length) {
      box.innerHTML = '<div class="cart-empty"><i class="fa-solid fa-bag-shopping"></i> Seu carrinho está vazio.</div>';
    } else {
      box.innerHTML = cart.map((item, idx) => `
        <div class="cart-item">
          <img class="cart-item__img" src="${esc(item.image || "")}" alt="${esc(item.name)}" onerror="this.style.visibility='hidden'">
          <div class="cart-item__info">
            <h4>${esc(item.name)}</h4>
            <small>Tam: <strong>${esc(item.size)}</strong></small>
            ${item.notes ? `<em>${esc(item.notes)}</em>` : ""}
            <div class="cart-item__price">${brl(Number(item.price) * Number(item.quantity))}</div>
          </div>
          <div class="cart-item__actions">
            <button type="button" class="cart-item__remove" data-cart="remove" data-index="${idx}" aria-label="Remover ${esc(item.name)}"><i class="fa-solid fa-trash-can"></i></button>
            <div class="qty">
              <button type="button" data-cart="dec" data-index="${idx}" aria-label="Diminuir quantidade">−</button>
              <span>${Number(item.quantity)}</span>
              <button type="button" data-cart="inc" data-index="${idx}" aria-label="Aumentar quantidade">+</button>
            </div>
          </div>
        </div>`).join("");
    }
  }
  if (subtotal) subtotal.textContent = brl(total);
  if (totalEl) totalEl.textContent = brl(total);
}

const cartItems = $("#cart-items");
if (cartItems) {
  cartItems.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cart]");
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    if (!cart[idx]) return;
    if (btn.dataset.cart === "remove") cart.splice(idx, 1);
    if (btn.dataset.cart === "inc") cart[idx].quantity += 1;
    if (btn.dataset.cart === "dec") {
      cart[idx].quantity -= 1;
      if (cart[idx].quantity <= 0) cart.splice(idx, 1);
    }
    saveCart();
    renderCart();
  });
}

const cartOverlay = $("#cart-overlay");
function openCart() {
  if (!cartOverlay) return;
  cartOverlay.classList.add("open");
  cartOverlay.setAttribute("aria-hidden", "false");
}
function closeCart() {
  if (!cartOverlay) return;
  cartOverlay.classList.remove("open");
  cartOverlay.setAttribute("aria-hidden", "true");
}
$("#open-cart-btn")?.addEventListener("click", openCart);
$("#close-cart-btn")?.addEventListener("click", closeCart);
cartOverlay?.addEventListener("click", e => {
  if (e.target === cartOverlay) closeCart();
});

$("#checkout-btn")?.addEventListener("click", () => {
  if (!cart.length) return showToast("Seu carrinho está vazio!");
  let total = 0;
  let msg = "*NOVO PEDIDO - ATELIÊ DINHA PÉROLAS*\n\nOlá, Dinha! Gostaria de encomendar os seguintes modelos do site:\n\n";
  cart.forEach((item, i) => {
    const sub = Number(item.price) * Number(item.quantity);
    total += sub;
    msg += `*${i + 1}. ${item.name}*\n   - Tamanho: ${item.size}\n`;
    if (item.notes) msg += `   - Obs: ${item.notes}\n`;
    msg += `   - Qtd: ${item.quantity}\n   - Subtotal: ${brl(sub)}\n\n`;
  });
  msg += `*VALOR TOTAL DOS PRODUTOS:* ${brl(total)}\n------------------------------------\nPor favor, me informe o frete e as opções de pagamento! ✨`;
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
});

/* Visualização rápida */
const qv = $("#quickview");
function openQuickView(card) {
  if (!qv) return;
  quickViewProduct = getProduct(card);
  quickViewSize = selectedSize(card);

  const img = $("#qv-image");
  if (img) {
    img.style.display = "";
    img.src = quickViewProduct.image;
    img.alt = quickViewProduct.name;
  }
  if ($("#qv-title")) $("#qv-title").textContent = quickViewProduct.name;
  if ($("#qv-badge")) $("#qv-badge").textContent = quickViewProduct.badge;
  if ($("#qv-price")) $("#qv-price").textContent = brl(quickViewProduct.price);
  if ($("#qv-description")) $("#qv-description").textContent = quickViewProduct.description;
  if ($("#qv-notes")) $("#qv-notes").value = "";

  const sizesBox = $("#qv-sizes");
  if (sizesBox) {
    sizesBox.innerHTML = quickViewProduct.sizes.map(s =>
      `<button type="button" class="size${s === quickViewSize ? " is-active" : ""}" data-size="${esc(s)}" aria-pressed="${s === quickViewSize}">${esc(s)}</button>`
    ).join("");
  }
  qv.classList.add("open");
  qv.setAttribute("aria-hidden", "false");
}
function closeQuickView() {
  if (!qv) return;
  qv.classList.remove("open");
  qv.setAttribute("aria-hidden", "true");
}
$("#qv-sizes")?.addEventListener("click", e => {
  const btn = e.target.closest(".size");
  if (!btn) return;
  quickViewSize = btn.dataset.size || btn.textContent.trim();
  $$("#qv-sizes .size").forEach(b => {
    b.classList.toggle("is-active", b === btn);
    b.setAttribute("aria-pressed", String(b === btn));
  });
});
$("#qv-add")?.addEventListener("click", () => {
  if (!quickViewProduct) return;
  addToCart(quickViewProduct, quickViewSize, $("#qv-notes")?.value.trim() || "");
  closeQuickView();
});
$("#qv-close")?.addEventListener("click", closeQuickView);
qv?.addEventListener("click", e => { if (e.target === qv) closeQuickView(); });

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeQuickView();
    closeCart();
    setMobileMenu(false);
  }
});

/* Formulário personalizado: só registra se existir no HTML */
const customForm = $("#custom-order-form");
if (customForm) {
  customForm.addEventListener("submit", e => {
    e.preventDefault();
    const v = id => $(id)?.value.trim() || "";
    const msgBox = $("#custom-msg");
    const show = (t, cls) => {
      if (msgBox) {
        msgBox.textContent = t;
        msgBox.className = "form-msg " + cls;
      } else showToast(t);
    };

    if (!v("#custom-name") || !v("#custom-phone") || !v("#custom-size")) {
      return show("Preencha nome, WhatsApp e numeração.", "erro");
    }
    if (v("#custom-email") && !/^\S+@\S+\.\S+$/.test(v("#custom-email"))) {
      return show("Informe um e-mail válido.", "erro");
    }

    let message = "*ENCOMENDA PERSONALIZADA - DINHA PÉROLAS*\n\n";
    message += `*Nome:* ${v("#custom-name")}\n*WhatsApp:* ${v("#custom-phone")}\n`;
    if (v("#custom-email")) message += `*E-mail:* ${v("#custom-email")}\n`;
    message += `*Numeração:* ${v("#custom-size")}\n*Cor:* ${v("#custom-color") || "A definir"}\n`;
    if (v("#custom-address")) message += `*Cidade/UF:* ${v("#custom-address")}\n`;
    message += `*Detalhes:* ${v("#custom-details") || "Sem detalhes adicionais"}\n\nOlá Dinha, gostaria de orçar essa Havaiana sob medida!`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    show("Pronto! Finalize o envio no WhatsApp.", "ok");
  });
}

const navLinks = $$(".nav a");
const sections = ["inicio", "produtos", "colecao-noivas", "sobre", "contato"]
  .map(id => document.getElementById(id)).filter(Boolean);
if ("IntersectionObserver" in window) {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        navLinks.forEach(a => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  sections.forEach(s => obs.observe(s));
}

if ($("#year")) $("#year").textContent = new Date().getFullYear();
renderCart();
applyFilters();

})();