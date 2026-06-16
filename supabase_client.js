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
    raskroi_manager: 'raskroi_manager.html',
    raskroi_worker:  'raskroi_manager.html',
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

// ── MULTI-TENANT: hostname (subdomain) → stores satırı ──────
// btm.baibesik.kz → slug='btm'. Subdomain yoksa (baibesik.kz/www)
// ?store=slug ile test edilebilir (DNS kurulana kadar).
let _currentStoreCache;
async function getCurrentStore() {
  if (_currentStoreCache !== undefined) return _currentStoreCache;
  const host = window.location.hostname;
  const hp = host.split('.');
  let slug = null;
  if (hp.length > 2 && hp[0] !== 'www') slug = hp[0];
  else slug = new URLSearchParams(window.location.search).get('store');
  if (!slug) { _currentStoreCache = null; return null; }
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) { console.error('getCurrentStore', error); _currentStoreCache = null; return null; }
  _currentStoreCache = data || null;
  return _currentStoreCache;
}

// ── MULTI-TENANT: dükkanın temasını sayfaya uygula (generic, idempotent) ──
// .logo varsa adını yanına ekler, yoksa sol üstte yüzen rozet gösterir.
// --orange/--orange-dark/--orange-light CSS değişkenlerini günceller.
// nav-shops / nav-shop-apply / nav-cutting (varsa) buna göre gizlenir.
let _themeApplied = false;
async function applyStoreTheme() {
  try {
    const store = await getCurrentStore();
    if (!store) return null;
    if (_themeApplied) return store;
    _themeApplied = true;

    function shade(hex, percent) {
      const f = parseInt(hex.slice(1), 16);
      const t = percent < 0 ? 0 : 255;
      const p = Math.abs(percent) / 100;
      const R = f >> 16, G = (f >> 8) & 0xff, B = f & 0xff;
      const r = Math.round((t - R) * p) + R;
      const g = Math.round((t - G) * p) + G;
      const b = Math.round((t - B) * p) + B;
      return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
    }
    const root = document.documentElement.style;
    root.setProperty('--orange', store.theme_color);
    root.setProperty('--orange-dark', shade(store.theme_color, -20));
    root.setProperty('--orange-light', shade(store.theme_color, 92));

    const logo = document.querySelector('.logo');
    if (logo) {
      logo.insertAdjacentHTML('beforeend',
        ` <small style="font-size:18px;font-weight:600;opacity:.8">· ${store.name}</small>`);
    } else {
      const badge = document.createElement('div');
      badge.textContent = '🏪 ' + store.name;
      badge.style.cssText = 'position:fixed;top:8px;left:8px;z-index:9999;background:' +
        store.theme_color + ';color:#fff;padding:5px 12px;border-radius:20px;' +
        'font-size:13px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.25);font-family:sans-serif';
      document.body.appendChild(badge);
    }

    ['nav-shops', 'nav-shop-apply'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const cuttingLink = document.getElementById('nav-cutting');
    if (cuttingLink) cuttingLink.style.display = store.has_cutting ? '' : 'none';

    return store;
  } catch (e) { console.error('applyStoreTheme', e); return null; }
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
  getAllStores, getMyStore, getCurrentStore, applyStoreTheme,
  // Избранное
  toggleFavourite, getMyFavourites,
  // Уведомления
  getMyNotifications, markNotificationRead, subscribeToNotifications,
  // 💬 CHAT — baibesik + cutting integration
  getOrCreateDirectChat, getMyChatRooms, getChatRoom,
  getMessages, sendMessage, editMessage, deleteMessage, pinMessage,
  markMessagesAsRead,
  subscribeToMessages, subscribeToMessageUpdates, broadcastTyping, subscribeToTyping,
  getStoreChat, createCuttingProjectChat, sendCuttingMessage,
  // ✂️ RASKROI — Раскрой / Kesim
  getCuttingStores, createRaskroiOrder, getMyRaskroiOrders,
  getStoreRaskroiOrders, searchRaskroiOrders, updateRaskroiOrder,
  assignRaskroiWorker, addRaskroiWorkerToStore,
  applyCuttingShop, getMyCuttingApplication, getCuttingApplications,
  approveCuttingApplication, rejectCuttingApplication,
};
// ============================================================
// CHAT MOD — baibesik.kz + Cutting için
// supabase_client.js'ye eklenecek fonksiyonlar
// ============================================================

// ────────────────────────────────────────────────────────────
// CHAT ODALARI
// ────────────────────────────────────────────────────────────

// Direct chat oluştur veya var olanı al
async function getOrCreateDirectChat(otherUserId, appContext = 'baibesik') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const [id1, id2] = [user.id, otherUserId].sort();

  // Var olan odayı ara
  const { data: existing } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('type', 'direct')
    .eq('participant_1', id1)
    .eq('participant_2', id2)
    .eq('app_context', appContext)
    .single();

  if (existing) return existing.id;

  // Yeni oda oluştur
  const { data: newRoom, error } = await supabase
    .from('chat_rooms')
    .insert({
      type: 'direct',
      participant_1: id1,
      participant_2: id2,
      app_context: appContext,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newRoom.id;
}

// Chat odasını listele (kullanıcının katılımcı olduğu)
async function getMyChatRooms(appContext = 'baibesik') {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('chat_rooms')
    .select(`
      id, type, group_name, group_avatar, app_context,
      participant_1, participant_2, store_id,
      last_message_at, is_archived,
      messages(id, content, sender_id, created_at)
    `)
    .eq('app_context', appContext)
    .or(`participant_1.eq.${user.id}, participant_2.eq.${user.id}`)
    .eq('is_archived', false)
    .order('last_message_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Her odanın en son mesajını ve okuma durumunu ekle
  const enriched = await Promise.all((data || []).map(async (room) => {
    const lastMsg = room.messages?.[0];
    const unreadCount = lastMsg
      ? (await supabase
          .from('messages')
          .select('id')
          .eq('chat_room_id', room.id)
          .gt('created_at', lastMsg.created_at)
          .not('message_reads', 'is', null)
          .single()).data?.id
        ? 0
        : room.messages.length
      : 0;

    return { ...room, lastMsg, unreadCount };
  }));

  return enriched;
}

// Spesifik chat odasını getir
async function getChatRoom(chatRoomId) {
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('id', chatRoomId)
    .single();

  if (error) throw error;
  return data;
}

// ────────────────────────────────────────────────────────────
// MESAJLAR
// ────────────────────────────────────────────────────────────

// Mesajları getir (pagination)
async function getMessages(chatRoomId, page = 1, perPage = 50) {
  const offset = (page - 1) * perPage;

  const { data, count, error } = await supabase
    .from('messages')
    .select('*, users:sender_id(id, full_name, avatar_url), message_reads(*)', { count: 'exact' })
    .eq('chat_room_id', chatRoomId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) throw error;
  return { messages: (data || []).reverse(), total: count };
}

// Mesaj gönder
async function sendMessage(chatRoomId, content, type = 'text', fileUrl = null, cuttingData = null) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_room_id: chatRoomId,
      sender_id: user.id,
      type,
      content,
      file_url: fileUrl,
      cutting_data: cuttingData,
    })
    .select('*, users:sender_id(id, full_name, avatar_url)')
    .single();

  if (error) throw error;

  // Chat room'un last_message_at'ını güncelle
  await supabase
    .from('chat_rooms')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', chatRoomId);

  return data;
}

// Mesajı edit et
async function editMessage(messageId, newContent) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('messages')
    .update({
      content: newContent,
      is_edited: true,
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('sender_id', user.id);

  if (error) throw error;
}

// Mesajı sil
async function deleteMessage(messageId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('messages')
    .update({ is_deleted: true })
    .eq('id', messageId)
    .eq('sender_id', user.id);

  if (error) throw error;
}

// Mesajı pin yap
async function pinMessage(messageId, chatRoomId) {
  // Önceki pinli mesajı unpin yap
  await supabase
    .from('messages')
    .update({ is_pinned: false })
    .eq('chat_room_id', chatRoomId)
    .eq('is_pinned', true);

  // Yeni mesajı pin yap
  const { error } = await supabase
    .from('messages')
    .update({ is_pinned: true })
    .eq('id', messageId);

  if (error) throw error;
}

// ────────────────────────────────────────────────────────────
// OKU DURUMU
// ────────────────────────────────────────────────────────────

// Mesajları oku olarak işaretle
async function markMessagesAsRead(chatRoomId) {
  const user = await getCurrentUser();
  if (!user) return;

  // Okunmamış mesajları bul
  const { data: unreadMessages } = await supabase
    .from('messages')
    .select('id')
    .eq('chat_room_id', chatRoomId)
    .not('message_reads', 'is', null);

  if (!unreadMessages || unreadMessages.length === 0) return;

  // Oku kayıtlarını ekle
  const reads = unreadMessages.map(msg => ({
    message_id: msg.id,
    reader_id: user.id,
  }));

  await supabase.from('message_reads').upsert(reads, {
    onConflict: 'message_id,reader_id',
  });
}

// ────────────────────────────────────────────────────────────
// REALTIME LISTENERS
// ────────────────────────────────────────────────────────────

// Yeni mesajları dinle
function subscribeToMessages(chatRoomId, callback) {
  return supabase
    .channel(`chat:${chatRoomId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `chat_room_id=eq.${chatRoomId}`,
    }, (payload) => callback(payload.new))
    .subscribe();
}

// Mesaj güncellemelerini dinle (edit/delete)
function subscribeToMessageUpdates(chatRoomId, callback) {
  return supabase
    .channel(`chat-updates:${chatRoomId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `chat_room_id=eq.${chatRoomId}`,
    }, (payload) => callback(payload.new))
    .subscribe();
}

// Typing indicator (Realtime broadcast)
function broadcastTyping(chatRoomId, userId, isTyping) {
  return supabase
    .channel(`typing:${chatRoomId}`)
    .send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, isTyping },
    });
}

function subscribeToTyping(chatRoomId, callback) {
  return supabase
    .channel(`typing:${chatRoomId}`)
    .on('broadcast', { event: 'typing' }, (payload) => {
      callback(payload.payload);
    })
    .subscribe();
}

// ────────────────────────────────────────────────────────────
// STORE CHAT (Magaza desteği)
// ────────────────────────────────────────────────────────────

// Mağazanın support chat'ini getir
async function getStoreChat(storeId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('type', 'support')
    .eq('store_id', storeId)
    .single();

  if (data) return data.id;

  // Oluştur
  const { data: newRoom, error } = await supabase
    .from('chat_rooms')
    .insert({
      type: 'support',
      store_id: storeId,
      participant_1: user.id,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newRoom.id;
}

// ────────────────────────────────────────────────────────────
// CUTTING İNTEGRASYONU
// ────────────────────────────────────────────────────────────

// Cutting projesine bağlı chat oluştur
async function createCuttingProjectChat(cuttingJobId, storeOwnerId, appContext = 'both') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const [id1, id2] = [user.id, storeOwnerId].sort();

  const { data, error } = await supabase
    .from('chat_rooms')
    .insert({
      type: 'direct',
      participant_1: id1,
      participant_2: id2,
      app_context: appContext,
      related_cutting_job: cuttingJobId,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// Cutting verisiyle mesaj gönder
async function sendCuttingMessage(chatRoomId, content, cuttingData) {
  return sendMessage(chatRoomId, content, 'text', null, cuttingData);
}


// ============================================================
// ✂️ RASKROI (Раскрой / Kesim) FONKSİYONLARI
// ============================================================

// Kesme atölyesi olan dükkanlar (has_cutting = true)
async function getCuttingStores() {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('has_cutting', true)
    .eq('status', 'active');
  if (error) { console.error('getCuttingStores', error); return []; }
  return data || [];
}

// Yeni raskroi siparişi oluştur (müşteri)
async function createRaskroiOrder(order) {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('raskroi_orders')
    .insert({
      customer_id:    user?.id || null,
      customer_name:  order.customer_name || user?.full_name,
      customer_phone: order.customer_phone || user?.phone,
      store_id:       order.store_id || null,
      sheet_w:        order.sheet_w,
      sheet_h:        order.sheet_h,
      material:       order.material,
      grain_dir:      order.grain_dir || 'none',
      kerf:           order.kerf || 4,
      trim_margin:    order.trim_margin || 10,
      pvc_thickness:  order.pvc_thickness || '1',
      parts:          order.parts || [],
      layout:         order.layout || null,
      sheets_used:    order.sheets_used || 0,
      efficiency:     order.efficiency || 0,
      cut_length_m:   order.cut_length_m || 0,
      pvc_length_m:   order.pvc_length_m || 0,
      files:          order.files || [],
      status:         'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Müşterinin kendi raskroi siparişleri (geçmiş + yeniden gönder)
async function getMyRaskroiOrders() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('raskroi_orders')
    .select('*')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('getMyRaskroiOrders', error); return []; }
  return data || [];
}

// Atölye/çalışan için gelen siparişler (store_id'ye göre)
async function getStoreRaskroiOrders(storeId) {
  // storeId verilmemişse subdomain'den otomatik al
  if (!storeId) {
    const store = await getCurrentStore();
    if (store) storeId = store.id;
  }
  let q = supabase.from('raskroi_orders').select('*').order('created_at', { ascending: false });
  if (storeId) q = q.eq('store_id', storeId);
  const { data, error } = await q;
  if (error) { console.error('getStoreRaskroiOrders', error); return []; }
  return data || [];
}

// Müşteri arama (isim / telefon / sipariş no) — çalışan kullanır
async function searchRaskroiOrders(query) {
  const { data, error } = await supabase
    .from('raskroi_orders')
    .select('*')
    .or(`customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%,order_number.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { console.error('searchRaskroiOrders', error); return []; }
  return data || [];
}

// Sipariş güncelle (çalışan: parça düzenle, fiyat, durum, layout)
async function updateRaskroiOrder(orderId, updates) {
  const { data, error } = await supabase
    .from('raskroi_orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Siparişi çalışana ata
async function assignRaskroiWorker(orderId, workerId) {
  return updateRaskroiOrder(orderId, { assigned_worker: workerId });
}

// Çalışanı dükkana raskroi_worker olarak ata (store_owner kullanır)
async function addRaskroiWorkerToStore(storeId, userId) {
  const { data, error } = await supabase
    .from('store_members')
    .insert({ store_id: storeId, user_id: userId, role: 'raskroi_worker' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── ATÖLYE BAŞVURU SİSTEMİ ──
// Atölye başvurusu yap (giriş yapmış kullanıcı)
async function applyCuttingShop({ shop_name, phone, address, note }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Кіру қажет');
  const { data, error } = await supabase
    .from('cutting_applications')
    .insert({ user_id: user.id, shop_name, phone, address, note, status: 'pending' })
    .select().single();
  if (error) throw error;
  return data;
}

// Kendi başvurumun durumu
async function getMyCuttingApplication() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase
    .from('cutting_applications')
    .select('*').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data;
}

// Süper admin: başvuruları listele
async function getCuttingApplications(status) {
  let q = supabase.from('cutting_applications')
    .select('*, users(full_name, phone)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Süper admin: onayla (mağaza oluşturur)
async function approveCuttingApplication(appId) {
  const { data, error } = await supabase.rpc('approve_cutting_application', { app_id: appId });
  if (error) throw error;
  return data;
}

// Süper admin: reddet
async function rejectCuttingApplication(appId) {
  const { error } = await supabase.from('cutting_applications')
    .update({ status: 'rejected' }).eq('id', appId);
  if (error) throw error;
}

