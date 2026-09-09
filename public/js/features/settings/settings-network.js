// Server network information, refresh, and copy actions.
async function loadServerNetworkInfo() {
  try {
    const net = await api('/api/settings/network');
    const primaryInput = document.getElementById('server-primary-url');
    const openBtn = document.getElementById('btn-open-server-url');
    const listContainer = document.getElementById('server-interfaces-list');
    
    if (net && net.primaryUrl) {
      currentServerUrl = net.primaryUrl;
      if (primaryInput) primaryInput.value = net.primaryUrl;
      if (openBtn) openBtn.href = net.primaryUrl;
    }

    if (listContainer && net && net.networkIps) {
      if (net.networkIps.length > 0) {
        listContainer.innerHTML = `
          <div style="margin-top:10px;font-size:12px;color:var(--text-light);font-weight:600;">عناوين الشبكات المتاحة على هذا الجهاز:</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
            ${net.networkIps.map(ip => `
              <div class="network-badge" style="background:var(--bg);border:1px solid var(--border);padding:6px 10px;border-radius:8px;display:flex;align-items:center;gap:6px;font-size:12px;">
                <span style="color:#28a745;">●</span>
                <strong>${ip.iface}:</strong>
                <code style="background:rgba(0,0,0,0.05);padding:2px 6px;border-radius:4px;">${ip.url}</code>
                <button type="button" class="btn" style="padding:2px 8px;font-size:11px;" onclick="copySpecificUrl('${ip.url}')">نسخ</button>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        listContainer.innerHTML = `<div style="font-size:12px;color:var(--text-light);margin-top:6px;">الرابط المحلي: <code>http://localhost:${net.port || 3000}</code></div>`;
      }
    }
  } catch(e) {
    console.warn('Network info endpoint note:', e.message);
    const primaryInput = document.getElementById('server-primary-url');
    if (primaryInput && (!primaryInput.value || primaryInput.value === '')) {
      primaryInput.value = window.location.origin;
    }
  }
}

function refreshNetworkInfo() {
  toast(currentLang === 'ar' ? 'جاري فحص وتحديث عنوان IP للسيرفر...' : 'Refreshing Server IP and Network links...', 'info');
  loadServerNetworkInfo().then(() => {
    toast(currentLang === 'ar' ? 'تم جلب عنوان السيرفر بنجاح' : 'Server network info updated', 'success');
  });
}

function copyServerUrl() {
  const input = document.getElementById('server-primary-url');
  if (!input) return;
  const url = input.value || window.location.origin;
  copySpecificUrl(url);
}

function copySpecificUrl(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      toast(currentLang === 'ar' ? `✅ تم نسخ الرابط: ${url} (أرسله للموظفين عبر الواتساب أو افتحه في جوالاتهم)` : `✅ Copied link: ${url}`, 'success');
    }).catch(() => fallbackCopy(url));
  } else {
    fallbackCopy(url);
  }
}

function fallbackCopy(text) {
  const temp = document.createElement('textarea');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  toast(currentLang === 'ar' ? `✅ تم نسخ الرابط: ${text}` : `✅ Copied: ${text}`, 'success');
}
