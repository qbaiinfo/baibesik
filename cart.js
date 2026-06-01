// ============================================================
// BAIBESIK.KZ — Merkezi Sepet Sistemi (cart.js)
// Tüm sayfalara ekle: <script src="cart.js"></script>
// ============================================================

const CART_KEY = 'baibesik_cart';
// SUPABASE_URL ve SUPABASE_KEY her sayfanın kendi script'inde tanımlı

// ── SEPET İŞLEMLERİ ──────────────────────────────────────────
const Cart = {
  get() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch(e) { return []; }
  },
  save(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    Cart.updateUI();
  },
  add(product) {
    const items = Cart.get();
    const existing = items.find(i => i.id === product.id);
    if(existing) { existing.qty++; }
    else { items.push({...product, qty: 1}); }
    Cart.save(items);
  },
  remove(id) {
    const items = Cart.get().filter(i => i.id !== id);
    Cart.save(items);
  },
  changeQty(id, delta) {
    const items = Cart.get();
    const item = items.find(i => i.id === id);
    if(item) {
      item.qty = Math.max(1, item.qty + delta);
      Cart.save(items);
    }
  },
  clear() {
    localStorage.removeItem(CART_KEY);
    Cart.updateUI();
  },
  count() {
    return Cart.get().reduce((s, i) => s + i.qty, 0);
  },
  total() {
    return Cart.get().reduce((s, i) => s + i.price * i.qty, 0);
  },
  updateUI() {
    const n = Cart.count();
    // Tüm sepet sayaçlarını güncelle
    document.querySelectorAll('.cart-count, #cart-count').forEach(el => {
      el.textContent = n;
      el.style.display = n > 0 ? 'flex' : 'none';
    });
    // Checkout butonunu göster/gizle
    const checkoutBtn = document.getElementById('checkout-btn');
    if(checkoutBtn) checkoutBtn.style.display = n > 0 ? 'block' : 'none';
  }
};

// ── OTURUM YÖNETİMİ ──────────────────────────────────────────
const Session = {
  async get() {
    try {
      const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
      const sb = createClient(window.SUPABASE_URL||"https://fciofuexujtxxjlamxno.supabase.co", window.SUPABASE_KEY||"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjaW9mdWV4dWp0eHhqbGFteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTYwOTcsImV4cCI6MjA5NTczMjA5N30.dDvtfabQ6xHmSd5NDntme2ggJpzNKLtXovFFDW2Kc80");
      const {data:{session}} = await sb.auth.getSession();
      return session;
    } catch(e) { return null; }
  },
  async getUser() {
    try {
      const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
      const sb = createClient(window.SUPABASE_URL||"https://fciofuexujtxxjlamxno.supabase.co", window.SUPABASE_KEY||"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjaW9mdWV4dWp0eHhqbGFteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTYwOTcsImV4cCI6MjA5NTczMjA5N30.dDvtfabQ6xHmSd5NDntme2ggJpzNKLtXovFFDW2Kc80");
      const {data:{session}} = await sb.auth.getSession();
      if(!session) return null;
      const {data:user} = await sb.from('users')
        .select('*').eq('id', session.user.id).single();
      return user ? {...user, access_token: session.access_token} : null;
    } catch(e) { return null; }
  }
};

// Sayfa yüklenince sepet sayacını güncelle
window.addEventListener('DOMContentLoaded', () => Cart.updateUI());

// Global erişim için
window.Cart = Cart;
window.Session = Session;
