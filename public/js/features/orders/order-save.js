// Online/offline order persistence and stable request identifiers.
async function saveOrder(printAfterSave = false) {
  if (saveOrder.busy) return;
  if (!currentUser?.token) { toast(t('login_error'),'error'); return; }
  if (!currentOrder.items.length) { toast(currentLang==='ar'?'أضف صنفًا أولًا':'Add an item first','error');return; }
  saveOrder.busy=true;
  currentOrder.offline_id ||= newRequestId();
  const payload={offline_id:currentOrder.offline_id,employee_id:currentUser.id,table_id:currentOrder.table_id,customer_id:currentOrder.customer_id,type:currentOrder.type,note:currentOrder.note||'',discount_percent:currentOrder.discount||0,discount_amount:0,payment_method:currentOrder.payment_method||'cash',items:currentOrder.items,status:'active',attributes:currentOrder.attributes||{},created_at:new Date().toISOString(),print_pending:printAfterSave};
  let saved;
  try {
    saved=await api('/api/orders','POST',payload);
    resetOrder();
    toast(currentLang==='ar'?'تم حفظ الطلب':'Order saved','success');
    await printProductionTickets(saved,saved.items);
    if(printAfterSave) await generateReceipt(saved);
    await loadTables();loadActiveOrders();
  } catch(error) {
    if(!saved && error.network) {
      try {
        await saveOfflineOrder({...payload,auth_token:currentUser.token});
        resetOrder();
        toast(currentLang==='ar'?'حُفظ على الجهاز؛ ينتظر المزامنة ولم يصل للمطبخ بعد':'Saved on device; pending sync and not yet sent to kitchen','info');
        document.getElementById('offline-bar').classList.remove('hidden');
      }catch(storageError){toast(currentLang==='ar'?'تعذر الحفظ على الجهاز؛ احتفظ بالطلب مفتوحًا':'Device storage failed; keep this order open','error');}
    }else toast(saved ? (currentLang==='ar'?'الطلب محفوظ؛ تعذرت الطباعة أو إعادة التحميل':'Order saved; printing or refresh failed') : error.message,'error');
  } finally {saveOrder.busy=false;}
}

function newRequestId() {
  const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
  return 'order_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}

// ===== End Order Saving =====
