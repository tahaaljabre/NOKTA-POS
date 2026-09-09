// Shift startup, opening cash, and login-time shift check.
// ===== Open Shift & Opening Cash Management =====
async function checkShiftOnLogin() {
  if (!currentUser || currentUser.role === 'waiter') return; // Waiters don't carry cashier drawer
  const today = businessDate();

  // If already opened in this browser session today, don't prompt again
  if (localStorage.getItem(`shift_opened_${currentUser.id}_${today}`)) {
    return;
  }

  try {
    const shiftInfo = await api(`/api/daily-closings/current-shift?date=${today}`);
    if (shiftInfo && !shiftInfo.has_shift) {
      openShiftOpeningModal();
    } else if (shiftInfo && shiftInfo.has_shift) {
      // Record that shift is already active so prompt doesn't appear on subsequent logins today
      localStorage.setItem(`shift_opened_${currentUser.id}_${today}`, '1');
    }
  } catch(e) {
    console.warn('Check shift error:', e.message);
  }
}

function openShiftOpeningModal() {
  if (!currentUser) return;
  const currency = getCurrency();
  const today = businessDate();

  const modalTitle = currentLang === 'ar' ? `☀️ استلام الكاشير وفتح الوردية اليومية` : `☀️ Open Daily Shift & Cash Drawer`;
  const modalBody = `
    <div style="text-align:center;padding:10px 0;">
      <div style="font-size:42px;margin-bottom:10px;">🪙</div>
      <h3 style="color:var(--primary);margin-bottom:6px;font-size:17px;">
        ${currentLang === 'ar' ? `مرحباً بك يا ${escapeHtml(currentUser.name)}` : `Welcome ${escapeHtml(currentUser.name)}`}
      </h3>
      <p style="font-size:13px;color:var(--text-light);margin-bottom:18px;line-height:1.5;">
        ${currentLang === 'ar' ? 'لبدء اليوم واستلام الكاشير، يرجى إدخال مبلغ العُهدة النقدية (الفكة الافتتاحية) الموجودة بالدرج:' : 'Please enter the opening cash float in the drawer to start your shift:'}
      </p>

      <div style="background:#fdfdfd;border:2px dashed var(--gold);border-radius:12px;padding:16px;max-width:320px;margin:0 auto 16px;">
        <label style="font-size:12px;font-weight:700;color:#333;display:block;margin-bottom:8px;">
          ${currentLang === 'ar' ? 'مبلغ العُهدة الافتتاحية (فكة الصندوق):' : 'Opening Cash Float:'}
        </label>
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;">
          <input type="number" id="shift-opening-cash-input" value="0.00" min="0" step="1" 
                 style="font-size:24px;font-weight:800;text-align:center;width:150px;padding:8px;border-radius:8px;border:1.5px solid var(--border);color:var(--primary);"
                 onfocus="this.select()">
          <span style="font-size:16px;font-weight:700;color:var(--gold);">${escapeHtml(currency)}</span>
        </div>
      </div>

      <div style="margin-bottom:16px;max-width:320px;margin:0 auto 16px;">
        <input type="text" id="shift-opening-notes" placeholder="${currentLang === 'ar' ? 'ملاحظات الاستلام (اختياري)...' : 'Notes (optional)...'}" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid #ddd;font-size:12px;">
      </div>
    </div>
  `;

  openModal(
    modalTitle, 
    modalBody, 
    async () => {
      await submitShiftOpening();
    },
    currentLang === 'ar' ? '🚀 فتح الوردية واستلام الصندوق' : '🚀 Open Shift'
  );
}

async function submitShiftOpening() {
  const floatInput = document.getElementById('shift-opening-cash-input');
  const floatAmt = parseFloat(floatInput?.value) || 0;
  const notes = document.getElementById('shift-opening-notes')?.value || '';
  const today = businessDate();

  const res = await api('/api/daily-closings/open', 'POST', {
    opening_cash: floatAmt,
    notes: notes,
    date: today
  });

  if (res.error) {
    throw new Error(res.error);
  }

  // Cache locally that this employee has opened their shift today
  if (currentUser) {
    localStorage.setItem(`shift_opened_${currentUser.id}_${today}`, '1');
  }

  toast(currentLang === 'ar' ? `✅ تم فتح الوردية بنجاح! رصيد العُهدة الافتتاحي: ${floatAmt.toFixed(2)} ${getCurrency()}` : `✅ Shift opened with float: ${floatAmt.toFixed(2)}`, 'success');
}
