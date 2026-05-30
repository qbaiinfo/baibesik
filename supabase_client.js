// ============================================================
// BAIBESIK.KZ — Supabase Client
// Этот файл подключить во ВСЕХ html страницах:
// <script src="supabase_client.js"></script>
// ============================================================

// ── ШАГ 1: Замените на ваши данные из Supabase ─────────────
// Settings → API → Project URL и anon public key
const SUPABASE_URL  = 'https://fciofuexujtxxjlamxno.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjaW9mdWV4dWp0eHhqbGFteG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTYwOTcsImV4cCI6MjA5NTczMjA5N30.dDvtfabQ6xHmSd5NDntme2ggJpzNKLtXovFFDW2Kc80';

// ── Инициализация ────────────────────────────────────────────
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// AUTH — Авторизация
// ============================================================

// Регистрация нового пользователя
async function signUp(phone, password, fullName) {
  const email = phone.replace(/\D/g,'') + '@baibesik.kz'; // phone как email
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone } }
  });
  if (error) throw error;

  // Создать запись в users
  await supabase.from('users').insert({
    id: data.user.id,
    phone,
    full_name: fullName,
    role: 'customer'
  });
  return data;
}

// Вход по телефону + пароль
async function signIn(phone, password) {
  const email = phone.replace(/\D/g,'') + '@baibesik.kz';
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Выход
async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

// Получить текущего пользователя
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
  return data;
}

// Перенаправление по роли после входа
async function redirectByRole() {
  const user = await getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }
  const routes = {
    super_admin: 'admin.html',
    store_owner: 'vendor.html',
    manager:     'vendor.html',
    warehouse:   'depo_panel.html',
    wholesale:   'toptanci_dashboard.html',
    customer:    'musteri_dashboard.html',
  };
  window.location.href = routes[user.role] || 'index.html';
}

// ============================================================
// КАТАЛОГ — Товары
// ============================================================

// Получить все товары (с пагинацией)
async function getProducts({ categoryId, storeId, search, page = 1, perPage = 16 } = {}) {
  let query = supabase
    .from('products')
    .select('*, categories(name_ru, name_kk), stores(name)', { count: 'exact' })
    .eq('is_active', true)
    .range((page-1)*perPage, page*perPage - 1);

  if (categoryId) query = query.eq('category_id', categoryId);
  if (storeId)    query = query.eq('store_id', storeId);
  if (search)     query = query.ilike('name_ru', `%${search}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, total: count };
}

// Получить все категории
async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data;
}

// ============================================================
// КОРЗИНА
// ============================================================

// Добавить в корзину
async function addToCart(productId, quantity = 1) {
  const user = await getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }

  const { data, error } = await supabase
    .from('cart_items')
    .upsert({ user_id: user.id, product_id: productId, quantity },
             { onConflict: 'user_id,product_id' });
  if (error) throw error;
  return data;
}

// Получить корзину
async function getCart() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('cart_items')
    .select('*, products(*, stores(name, kaspi_merchant_id, halyk_merchant_id, preferred_bank))')
    .eq('user_id', user.id);
  if (error) throw error;
  return data;
}

// Обновить количество
async function updateCartQty(productId, quantity) {
  const user = await getCurrentUser();
  if (!user) return;
  if (quantity <= 0) return removeFromCart(productId);

  await supabase.from('cart_items')
    .update({ quantity })
    .eq('user_id', user.id)
    .eq('product_id', productId);
}

// Удалить из корзины
async function removeFromCart(productId) {
  const user = await getCurrentUser();
  if (!user) return;

  await supabase.from('cart_items')
    .delete()
    .eq('user_id', user.id)
    .eq('product_id', productId);
}

// Очистить корзину
async function clearCart() {
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('cart_items').delete().eq('user_id', user.id);
}

// ============================================================
// ЗАКАЗЫ
// ============================================================

// Оформить заказ (разбивает по магазинам автоматически)
async function placeOrder({ cartItems, paymentMethod, deliveryType, address, recipientName, recipientPhone, comment }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  // Группируем по магазинам
  const byStore = {};
  cartItems.forEach(item => {
    const sid = item.products.store_id;
    if (!byStore[sid]) byStore[sid] = { storeId: sid, items: [] };
    byStore[sid].items.push(item);
  });

  const createdOrders = [];

  // Создаём отдельный заказ для каждого магазина
  for (const [storeId, group] of Object.entries(byStore)) {
    const subtotal = group.items.reduce((s, i) => s + i.products.price_retail * i.quantity, 0);

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        customer_id:      user.id,
        store_id:         storeId,
        customer_type:    user.role === 'wholesale' ? 'wholesale' : 'retail',
        delivery_address: address,
        recipient_name:   recipientName,
        recipient_phone:  recipientPhone,
        comment,
        payment_method:   paymentMethod,
        delivery_type:    deliveryType,
        subtotal,
        total:            subtotal,
        status:           'new',
      })
      .select()
      .single();

    if (error) throw error;

    // Позиции заказа
    const items = group.items.map(i => ({
      order_id:     order.id,
      product_id:   i.product_id,
      product_name: i.products.name_ru,
      product_spec: i.products.spec,
      shelf_code:   i.products.shelf_code,
      quantity:     i.quantity,
      unit_price:   i.products.price_retail,
      total_price:  i.products.price_retail * i.quantity,
    }));

    await supabase.from('order_items').insert(items);

    // Уведомление для менеджера магазина
    const managers = await supabase
      .from('store_members')
      .select('user_id')
      .eq('store_id', storeId)
      .in('role', ['owner','manager']);

    if (managers.data) {
      const notifs = managers.data.map(m => ({
        user_id:  m.user_id,
        type:     'order',
        title_ru: `Новый заказ ${order.order_number}`,
        title_kk: `Жаңа тапсырыс ${order.order_number}`,
        body_ru:  `Сумма: ${subtotal.toLocaleString()} ₸ · ${deliveryType === 'courier' ? 'Курьер' : 'Самовывоз'}`,
        order_id: order.id,
      }));
      await supabase.from('notifications').insert(notifs);
    }

    createdOrders.push(order);
  }

  // Очищаем корзину
  await clearCart();

  return createdOrders;
}

// Получить заказы клиента
async function getMyOrders() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), stores(name)')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Получить заказы магазина (для менеджера)
async function getStoreOrders(storeId, status = null) {
  let query = supabase
    .from('orders')
    .select('*, order_items(*), users(full_name, phone)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Обновить статус заказа (для менеджера/деpo)
async function updateOrderStatus(orderId, status) {
  const { error } = await supabase
    .from('orders')
    .update({ status, ...(status === 'done' ? { completed_at: new Date().toISOString() } : {}) })
    .eq('id', orderId);
  if (error) throw error;

  // Уведомить клиента
  const { data: order } = await supabase.from('orders').select('customer_id, order_number').eq('id', orderId).single();
  const statusTexts = { preparing:'Собирается', ready:'Готов к выдаче', delivery:'В пути к вам', done:'Доставлен' };
  if (order && statusTexts[status]) {
    await supabase.from('notifications').insert({
      user_id:  order.customer_id,
      type:     'order',
      title_ru: `Заказ ${order.order_number}: ${statusTexts[status]}`,
      title_kk: `Тапсырыс ${order.order_number}: ${statusTexts[status]}`,
      order_id: orderId,
    });
  }
}

// ============================================================
// МАГАЗИНЫ
// ============================================================

// Получить все магазины (для супер-админа)
async function getAllStores() {
  const { data, error } = await supabase
    .from('stores')
    .select('*, store_members(count)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Получить мой магазин (для владельца/менеджера)
async function getMyStore() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase
    .from('store_members')
    .select('store_id, role, stores(*)')
    .eq('user_id', user.id)
    .single();
  return data;
}

// ============================================================
// ИЗБРАННОЕ
// ============================================================

async function toggleFavourite(productId) {
  const user = await getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }

  const { data: existing } = await supabase
    .from('favourites')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .single();

  if (existing) {
    await supabase.from('favourites').delete().eq('id', existing.id);
    return false; // удалено
  } else {
    await supabase.from('favourites').insert({ user_id: user.id, product_id: productId });
    return true; // добавлено
  }
}

async function getMyFavourites() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from('favourites')
    .select('*, products(*)')
    .eq('user_id', user.id);
  return data || [];
}

// ============================================================
// УВЕДОМЛЕНИЯ
// ============================================================

async function getMyNotifications() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  return data || [];
}

async function markNotificationRead(id) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

// Слушать новые уведомления в реальном времени
function subscribeToNotifications(userId, callback) {
  return supabase
    .channel('notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, callback)
    .subscribe();
}

// ============================================================
// ЭКСПОРТ
// ============================================================
export {
  supabase,
  // Auth
  signUp, signIn, signOut, getCurrentUser, redirectByRole,
  // Каталог
  getProducts, getCategories,
  // Корзина
  addToCart, getCart, updateCartQty, removeFromCart, clearCart,
  // Заказы
  placeOrder, getMyOrders, getStoreOrders, updateOrderStatus,
  // Магазины
  getAllStores, getMyStore,
  // Избранное
  toggleFavourite, getMyFavourites,
  // Уведомления
  getMyNotifications, markNotificationRead, subscribeToNotifications,
};
