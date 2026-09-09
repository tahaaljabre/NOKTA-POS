// Production ticket printing for kitchen and preparation stations.
async function printProductionTickets(order, orderItems) {
  let settings = {};
  try { settings = await api('/api/settings'); } catch (error) { return; }
  let printerConfigs = [];
  try { printerConfigs = JSON.parse(settings.printers_config || '[]'); } catch (error) { return; }

  for (const printer of printerConfigs) {
    if (!printer.auto_print || !Array.isArray(printer.category_ids) || !printer.category_ids.length) continue;
    const categoryIds = new Set(printer.category_ids.map(Number));
    const printerItems = orderItems.filter(item => categoryIds.has(Number(item.category_id)));
    if (printerItems.length) await generateProductionTicket(order, printer, printerItems);
  }
}

function generateProductionTicket(order, printer, ticketItems) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const typeLabel = { dine_in: 'داخل المنشأة', takeaway: 'سفري', delivery: 'توصيل' }[order.type] || order.type || '';
  const table = order.table_number ? ` - طاولة ${escape(order.table_number)}` : '';
  const ticket = document.createElement('iframe');
  ticket.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0;';
  document.body.appendChild(ticket);
  const doc = ticket.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(escape(printer.name))}</title><style>@page{size:80mm auto;margin:0}body{width:76mm;margin:auto;padding:4mm 2mm;font-family:Arial,sans-serif;font-size:12px;color:#000}.head{text-align:center;font-weight:800;font-size:16px}.sub{text-align:center;margin:5px 0;border-bottom:1px dashed #000;padding-bottom:5px}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ddd}.note{font-size:10px;color:#a11;margin-top:3px}</style></head><body><div class="head">طلب إنتاج — ${escapeHtml(escape(printer.name))}</div><div class="sub">#${escape(order.invoice_number || order.id)} ${escape(typeLabel)}${table}<br>${new Date(order.created_at || Date.now()).toLocaleTimeString('ar-SA')}</div>${ticketItems.map(item => `<div class="row"><span><b>${escapeHtml(escape(item.name || item.item_name))}</b>${item.note ? `<div class="note">${escapeHtml(escape(item.note))}</div>` : ''}</span><b>× ${escape(item.quantity)}</b></div>`).join('')}<div class="sub">${escapeHtml(escape(order.note || ''))}</div></body></html>`);
  doc.close();
  setTimeout(() => {
    try { ticket.contentWindow.focus(); ticket.contentWindow.print(); } catch (error) { console.error('Production print error:', error); }
    setTimeout(() => ticket.remove(), 4000);
  }, 350);
}
