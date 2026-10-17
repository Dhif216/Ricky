const products = [
  { id: 'orbit-headphones', name: 'Orbit headphones', detail: 'Your own little sound bubble.', price: 64, category: 'audio', tag: 'BESTSELLER', color: 'lilac', emoji: '♫', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=85', imageAlt: 'Black over-ear headphones on a clean white desk' },
  { id: 'pocket-speaker', name: 'Pocket speaker', detail: 'Big sound. Tiny plus-one.', price: 38, category: 'audio', tag: 'NEW', color: 'yellow', emoji: '◉', image: 'https://images.pexels.com/photos/12021852/pexels-photo-12021852.jpeg?auto=compress&cs=tinysrgb&w=900', imageAlt: 'Compact red portable speaker against a blue background' },
  { id: 'loop-cable', name: 'Loop cable kit', detail: 'A tangle-free kind of day.', price: 18, category: 'carry', tag: '', color: 'blue', emoji: '↻', image: 'https://images.pexels.com/photos/6726749/pexels-photo-6726749.jpeg?auto=compress&cs=tinysrgb&w=900', imageAlt: 'Close-up of a USB cable and connector' },
  { id: 'daily-stand', name: 'Daily phone stand', detail: 'Your desk’s new best angle.', price: 29, category: 'desk', tag: 'STAFF PICK', color: 'pink', emoji: '▱', image: 'https://images.pexels.com/photos/6373077/pexels-photo-6373077.jpeg?auto=compress&cs=tinysrgb&w=900', imageAlt: 'Smartphone propped up on a wooden stand' }
];

const cart = new Map();
const productGrid = document.querySelector('#product-grid');
const cartPanel = document.querySelector('#cart-panel');
const cartOverlay = document.querySelector('#cart-overlay');
const toast = document.querySelector('#toast');
let toastTimer;

function renderProducts(filter = 'all') {
  const visibleProducts = products.filter((product) => filter === 'all' || product.category === filter);
  productGrid.innerHTML = visibleProducts.map((product) => `
    <article class="product-card">
      <div class="product-art ${product.color}">
        ${product.tag ? `<span class="product-tag">${product.tag}</span>` : ''}
        <img class="product-photo" src="${product.image}" alt="${product.imageAlt}" loading="lazy" decoding="async">
        <button class="product-add" type="button" data-add="${product.id}" aria-label="Add ${product.name} to bag">+</button>
      </div>
      <div class="product-info"><div><h3 class="product-name">${product.name}</h3><p class="product-description">${product.detail}</p></div><span class="product-price">€${product.price.toFixed(2)}</span></div>
    </article>
  `).join('');
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2100);
}

function addToCart(id) {
  cart.set(id, (cart.get(id) || 0) + 1);
  renderCart();
  const product = products.find((item) => item.id === id);
  notify(`${product.name} added to your bag`);
}

function changeQuantity(id, amount) {
  const nextQuantity = (cart.get(id) || 0) + amount;
  if (nextQuantity <= 0) cart.delete(id);
  else cart.set(id, nextQuantity);
  renderCart();
}

function renderCart() {
  const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  const itemsElement = document.querySelector('#cart-items');
  const emptyElement = document.querySelector('#cart-empty');
  const summaryElement = document.querySelector('#cart-summary');
  document.querySelector('#cart-count').textContent = count;
  document.querySelector('#cart-title-count').textContent = `(${count})`;
  emptyElement.hidden = count > 0;
  summaryElement.hidden = count === 0;
  itemsElement.innerHTML = [...cart.entries()].map(([id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return `<article class="cart-line"><div class="cart-thumb ${product.color}">${product.emoji}</div><div><h3>${product.name}</h3><p>€${product.price.toFixed(2)} each</p><div class="quantity-controls"><button type="button" data-quantity="-1" data-id="${id}" aria-label="Remove one ${product.name}">−</button><span>${quantity}</span><button type="button" data-quantity="1" data-id="${id}" aria-label="Add one ${product.name}">+</button></div></div><span class="cart-line-price">€${(product.price * quantity).toFixed(2)}</span></article>`;
  }).join('');
  const subtotal = [...cart.entries()].reduce((sum, [id, quantity]) => sum + products.find((item) => item.id === id).price * quantity, 0);
  document.querySelector('#cart-subtotal').textContent = `€${subtotal.toFixed(2)}`;
}

function setCartOpen(open) {
  cartPanel.classList.toggle('open', open);
  cartPanel.setAttribute('aria-hidden', String(!open));
  cartOverlay.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) document.querySelector('#cart-close').focus();
}

productGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add]');
  if (button) addToCart(button.dataset.add);
});

document.querySelector('.category-row').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  document.querySelectorAll('.filter-chip').forEach((chip) => chip.classList.toggle('active', chip === button));
  renderProducts(button.dataset.filter);
});

document.querySelector('#cart-items').addEventListener('click', (event) => {
  const button = event.target.closest('[data-quantity]');
  if (button) changeQuantity(button.dataset.id, Number(button.dataset.quantity));
});

document.querySelector('#cart-open').addEventListener('click', () => setCartOpen(true));
document.querySelector('#cart-close').addEventListener('click', () => setCartOpen(false));
document.querySelector('#keep-shopping').addEventListener('click', () => setCartOpen(false));
cartOverlay.addEventListener('click', () => setCartOpen(false));
document.querySelector('.search-toggle').addEventListener('click', () => document.querySelector('#shop').scrollIntoView({ behavior: 'smooth' }));
document.querySelector('#checkout-button').addEventListener('click', () => notify('Checkout is a demo — no payment will be taken.'));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setCartOpen(false); });

function setupOptionalAnalytics() {
  const backdrop = document.querySelector('#consent-backdrop');
  const dialog = document.querySelector('#consent-dialog');
  const detailsButton = document.querySelector('#consent-details-toggle');
  const details = document.querySelector('#consent-details');
  const choiceKey = 'ricky-market-analytics-choice-v4';
  const savedChoice = localStorage.getItem(choiceKey);

  function sendAnalyticsVisit(gpsCoordinates = null) {
    fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent: true,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        gpsConsent: gpsCoordinates !== null,
        ...(gpsCoordinates ? { latitude: gpsCoordinates.latitude, longitude: gpsCoordinates.longitude } : {})
      }),
      keepalive: true
    }).catch(() => {});
  }

  if (savedChoice === 'accepted') sendAnalyticsVisit();
  if (savedChoice === 'declined') return;

  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  document.querySelector('#analytics-accept').focus();

  function closeConsent() {
    backdrop.hidden = true;
    document.body.style.overflow = '';
  }

  detailsButton.addEventListener('click', () => {
    const expanded = detailsButton.getAttribute('aria-expanded') === 'true';
    detailsButton.setAttribute('aria-expanded', String(!expanded));
    detailsButton.querySelector('span').textContent = expanded ? '＋' : '−';
    details.hidden = expanded;
  });

  document.querySelector('#analytics-accept').addEventListener('click', () => {
    localStorage.setItem(choiceKey, 'accepted');
    closeConsent();
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => sendAnalyticsVisit({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }),
        () => sendAnalyticsVisit(),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      sendAnalyticsVisit();
    }
  }, { once: true });
  document.querySelector('#analytics-close').addEventListener('click', () => {
    localStorage.setItem(choiceKey, 'declined');
    closeConsent();
  }, { once: true });

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled])')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

renderProducts();
renderCart();
setupOptionalAnalytics();
