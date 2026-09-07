function receiveKitchenSession() {
  const hash = typeof location !== 'undefined' ? String(location.hash || '') : '';
  const match = hash.match(/(?:^#|&)session=([^&]+)/);
  const transferred = match ? decodeURIComponent(match[1]) : '';
  if (transferred) {
    localStorage.setItem('pos_kitchen_token', transferred);
    if (typeof history !== 'undefined') history.replaceState(null, '', location.pathname + location.search);
  }
  return transferred || localStorage.getItem('pos_kitchen_token') || '';
}
const kitchenToken = receiveKitchenSession();
// The API and real-time socket are both protected by the signed login token.
const socket = io({ auth: { token: kitchenToken } });
let hasLoadedOrders = false;
let knownOrderIds = new Set();

function kitchenHeaders(json = false) {
  const headers = {"Accept-Language":currentLang};
  if (json) headers['Content-Type'] = 'application/json';
  if (kitchenToken) headers.Authorization = `Bearer ${kitchenToken}`;
  return headers;
}

// State
let kdsOrders = [];
let audioContext;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (typeof applyTranslations === 'function') applyTranslations();
  initClock();
  fetchActiveOrders();
  initAudio();
  // A safety net for a temporary network interruption. Normal updates arrive
  // immediately through Socket.IO; this picks up anything missed after reconnect.
  setInterval(() => fetchActiveOrders(false), 10000);
});

function initClock() {
  const clockEl = document.getElementById('kds-clock');
  setInterval(() => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
  }, 1000);
}

// User gesture needed for audio
function initAudio() {
  const btn = document.getElementById('btn-enable-sound');
  if (btn) {
    btn.style.display = 'block';
    btn.onclick = () => {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      playNotification();
      btn.textContent = '🔊 الصوت مفعل';
      btn.style.opacity = '0.75';
    };
  }
  document.body.addEventListener('click', () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, { once: true });
}

function playNotification() {
  // A short built-in beep works even if the external sound file is blocked.
  try {
    if (audioContext) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.14, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.35);
    }
  } catch (e) { console.warn('Kitchen beep failed', e); }
  const audio = document.getElementById('notification-sound');
  if (audio) {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        console.log('Audio play prevented by browser', e);
        const btn = document.getElementById('btn-enable-sound');
        if (btn) {
          btn.style.display = 'block';
          btn.onclick = () => {
            audio.play();
            btn.style.display = 'none';
          };
        }
      });
    }
  }
}

// Socket Listeners
socket.on('order:created', () => fetchActiveOrders(true));
socket.on('order:updated', () => fetchActiveOrders());
socket.on('order:items_changed', () => fetchActiveOrders());
socket.on('kds:new_order', () => {
  fetchActiveOrders(true);
});

async function fetchActiveOrders(isNew = false) {
  try {
    const res = await fetch('/api/orders/kitchen', {
      headers: kitchenHeaders()
    });
    if (!res.ok) throw new Error(res.status === 401 ? 'يرجى تسجيل الدخول من شاشة نقطة البيع أولاً' : `HTTP ${escapeHtml(res.status)}`);
    const data = await res.json();
    
    // Filter out orders that don't have items or are already "ready" in KDS
    // For now, let's assume any active order that is not "ready" is shown.
    // If attributes has kds_status == 'ready', we hide it from KDS? No, maybe show it with a different color.
    
    // For now, let's just show all active orders
    kdsOrders = data.filter(order => {
      try {
        const attr = JSON.parse(order.attributes || '{}');
        return attr.kds_status !== 'ready'; // Hide ready orders from active KDS view? Or keep them?
      } catch (e) {
        return true;
      }
    });
    
    const incomingIds = new Set(kdsOrders.map(order => String(order.id)));
    const hasNewOrder = hasLoadedOrders && [...incomingIds].some(id => !knownOrderIds.has(id));
    knownOrderIds = incomingIds;
    hasLoadedOrders = true;
    renderTickets();
    
    if (isNew || hasNewOrder) {
      playNotification();
    }
  } catch (err) {
    console.error('Failed to fetch orders for KDS', err);
    const container = document.getElementById('kds-container');
    if (container) container.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#a11;padding:50px;font-size:1.1rem;">${escapeHtml(err.message)}</div>`;
  }
}

async function markOrderReady(orderId) {
  try {
    const order=kdsOrders.find(o=>o.id===Number(orderId));
    if(!order) return;
    const updateRes=await fetch('/api/orders/'+orderId+'/ready',{method:'POST',headers:kitchenHeaders(true),body:JSON.stringify({version:order.version})});
    if (updateRes.ok) {
      fetchActiveOrders();
    } else {
      const errText = await updateRes.text();
      alert('فشل تحديث الطلب: ' + errText);
    }
  } catch (err) {
    console.error('Error marking order as ready', err);
    alert('حدث خطأ في الشبكة أو السيرفر');
  }
}

function renderTickets() {
  const container = document.getElementById('kds-container');
  container.innerHTML = '';
  
  if (kdsOrders.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #888; padding: 50px; font-size: 1.5rem;">${typeof t === 'function' ? t('kds_no_orders') : 'لا توجد طلبات نشطة للمطبخ'}</div>`;
    return;
  }
  
  // Sort by created_at (oldest first)
  const sorted = [...kdsOrders].sort((a, b) => parsePOSDate(a.created_at) - parsePOSDate(b.created_at));
  
  sorted.forEach(order => {
    let attr = {};
    try { attr = JSON.parse(order.attributes || '{}'); } catch(e) {}
    
    // Only show if it's sent to kitchen. Let's assume all active orders are sent to kitchen by default,
    // OR we only show orders where attr.kds_sent === true.
    // The user didn't specify, so let's just show all active orders.
    
    const ticket = document.createElement('div');
    ticket.className = `kds-ticket type-${order.type}`;
    
    const time = parsePOSDate(order.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    
    let title = order.type === 'dine_in'
      ? (order.table_number ? `${typeof t === 'function' ? t('kds_table') : 'طاولة'} ${order.table_number}` : (typeof t === 'function' ? t('kds_no_table') : 'بدون طاولة'))
      : (order.type === 'takeaway' ? (typeof t === 'function' ? t('takeaway') : 'سفري') : (typeof t === 'function' ? t('delivery') : 'توصيل'));
    
    let itemsHtml = (order.items || []).map(item => `
      <li class="kds-ticket-item" onclick="this.classList.toggle('done')">
        <div>
          <span>${escapeHtml(currentLang==='ar'?item.item_name:(item.item_name_en||item.item_name))}</span>
          ${item.note ? `<span class="note">${escapeHtml(item.note)}</span>` : ''}
        </div>
        <span class="qty">x${item.quantity}</span>
      </li>
    `).join('');
    
    ticket.innerHTML = `
      <div class="kds-ticket-header">
        <h3>#${order.invoice_number || order.id} - ${title}</h3>
        <div>
          <span class="kds-ticket-type">${order.type === 'dine_in' ? (typeof t === 'function' ? t('dine_in') : 'محلي') : (order.type === 'takeaway' ? (typeof t === 'function' ? t('takeaway') : 'سفري') : (typeof t === 'function' ? t('delivery') : 'توصيل'))}</span>
          <span class="kds-ticket-time">${time}</span>
        </div>
      </div>
      <ul class="kds-ticket-items">
        ${itemsHtml}
      </ul>
      <div class="kds-ticket-footer">
        <button class="btn-ready" onclick="markOrderReady(${order.id})">${typeof t === 'function' ? t('kds_ready') : 'جاهز ✅'}</button>
      </div>
    `;
    
    container.appendChild(ticket);
  });
}
