// BAIBESIK.KZ — Merkezi sistem (cart.js)
// Supabase URL/KEY her sayfada const olarak tanımlı — buraya koymuyoruz

const CART_KEY = 'baibesik_cart';

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
    const ex = items.find(i => i.id === product.id);
    if(ex) { ex.qty++; } else { items.push({...product, qty:1}); }
    Cart.save(items);
  },
  remove(id) { Cart.save(Cart.get().filter(i => i.id !== id)); },
  changeQty(id, delta) {
    const items = Cart.get();
    const item = items.find(i => i.id === id);
    if(item) { item.qty = Math.max(1, item.qty + delta); Cart.save(items); }
  },
  clear() { localStorage.removeItem(CART_KEY); Cart.updateUI(); },
  count() { return Cart.get().reduce((s,i) => s + i.qty, 0); },
  total() { return Cart.get().reduce((s,i) => s + i.price * i.qty, 0); },
  updateUI() {
    const n = Cart.count();
    document.querySelectorAll('.cart-count, #cart-count').forEach(el => {
      el.textContent = n;
      el.style.display = n > 0 ? 'flex' : 'none';
    });
  }
};

// Auth — oturum yönetimi
const Auth = {
  _sb: null,
  async getSB() {
    if(!Auth._sb) {
      const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
      Auth._sb = createClient(
        'https://fciofuexujtxxjlamxno.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjaW9mdWV4dWp0eHhqbGFteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTYwOTcsImV4cCI6MjA5NTczMjA5N30.dDvtfabQ6xHmSd5NDntme2ggJpzNKLtXovFFDW2Kc80'
      );
    }
    return Auth._sb;
  },
  async getSession() {
    try {
      const sb = await Auth.getSB();
      const {data:{session}} = await sb.auth.getSession();
      return session;
    } catch(e) { return null; }
  },
  async getUser() {
    try {
      const sb = await Auth.getSB();
      const {data:{session}} = await sb.auth.getSession();
      if(!session) return null;
      const {data:user} = await sb.from('users')
        .select('*').eq('id', session.user.id).single();
      return user ? {...user, access_token: session.access_token, uid: session.user.id} : null;
    } catch(e) { return null; }
  },
  async requireLogin(allowedRoles) {
    const user = await Auth.getUser();
    if(!user) { window.location.href = 'login.html'; return null; }
    if(allowedRoles && !allowedRoles.includes(user.role)) {
      const routes = {
        super_admin:'admin.html', store_owner:'store_owner.html',
        manager:'vendor.html', warehouse:'depo_panel.html',
        wholesale:'toptanci_dashboard.html', customer:'musteri_dashboard.html'
      };
      window.location.href = routes[user.role] || 'index.html';
      return null;
    }
    return user;
  },
  async signOut() {
    const sb = await Auth.getSB();
    await sb.auth.signOut();
    window.location.href = 'login.html';
  }
};

window.Cart = Cart;
window.Auth = Auth;

window.addEventListener('DOMContentLoaded', () => Cart.updateUI());

// ── MULTI-TENANT: subdomain varsa dükkanın temasını uygula ──
(async function(){
  try {
    const { applyStoreTheme } = await import('./supabase_client.js');
    await applyStoreTheme();
  } catch(e){ console.error('cart theme', e); }
})();
