const { db } = require('../database/db');
const { number,text,json,error } = require('./orders-validation');
const money = value => Math.round((Number(value)+Number.EPSILON)*100)/100;
function normalizeItems(input,oldItems=[]) {
  if(!Array.isArray(input) || !input.length || input.length>300) throw error('أضف من 1 إلى 300 صنف / Order needs 1 to 300 items');
  return input.map(row=>{
    if(!row || typeof row!=='object') throw error('صنف غير صالح / Invalid item');
    const quantity=number(row.quantity,'quantity',1,1000);
    if(!Number.isInteger(quantity)) throw error('الكمية يجب أن تكون عددًا صحيحًا / Quantity must be a whole number');
    const selected=json(row.modifiers??row.selected_modifiers,[]);
    if(!Array.isArray(selected) || selected.length>50) throw error('إضافات غير صالحة / Invalid modifiers');
    const ids=selected.map(m=>Number(m.id??m.modifier_id)).sort((a,b)=>a-b);
    if(new Set(ids).size!==ids.length || ids.some(id=>!Number.isSafeInteger(id))) throw error('إضافات مكررة أو غير صالحة / Invalid duplicate modifiers');
    const prior=oldItems.find(i=>i.item_id===Number(row.item_id) && JSON.stringify(json(i.selected_modifiers,[]).map(m=>Number(m.id??m.modifier_id)).sort((a,b)=>a-b))===JSON.stringify(ids));
    if(prior) return {item_id:prior.item_id,quantity,note:text(row.note),price:prior.price,cost_price:prior.cost_price,selected_modifiers:prior.selected_modifiers,discount_amount:0};
    const product=db.prepare('SELECT * FROM items WHERE id=? AND active=1').get(row.item_id);
    if(!product) throw error('الصنف غير متاح / Item is unavailable');
    const allowed=db.prepare('SELECT m.* FROM modifiers m JOIN item_modifiers im ON im.modifier_id=m.id WHERE im.item_id=? AND m.active=1').all(product.id);
    const mods=ids.map(id=>{const m=allowed.find(m=>m.id===id);if(!m) throw error('إضافة غير متاحة للصنف / Modifier unavailable for item');return m;});
    for(const group of new Set(allowed.map(m=>m.group_name))) {
      const choices=allowed.filter(m=>m.group_name===group), picked=mods.filter(m=>m.group_name===group);
      if(choices.some(m=>m.is_required) && !picked.length) throw error('اختر الإضافة المطلوبة / Required modifier missing');
      if(choices.some(m=>!m.is_multiple) && picked.length>1) throw error('اختر إضافة واحدة للمجموعة / Choose one modifier per group');
    }
    const extra=mods.reduce((sum,m)=>sum+Math.round(number(m.price_extra,'modifier price')*100),0);
    return {item_id:product.id,quantity,note:text(row.note),price:(Math.round(number(product.price,'price')*100)+extra)/100,cost_price:product.cost_price||0,discount_amount:0,selected_modifiers:JSON.stringify(mods.map(m=>({id:m.id,name:m.name,name_en:m.name_en,price_extra:m.price_extra})))};
  });
}
function totals(items,percent,amount,tax,taxType) {
  const subtotal=money(items.reduce((sum,i)=>sum+Math.round(i.price*100)*i.quantity,0)/100);
  const after=money(Math.max(0,subtotal-money(subtotal*percent/100)-amount));
  let taxAmount = 0;
  let total = after;
  if (taxType === 'inclusive') {
    taxAmount = money(after - (after / (1 + (tax/100))));
    total = after;
  } else {
    taxAmount = money(after * tax / 100);
    total = money(after + taxAmount);
  }
  return {subtotal,tax_amount:taxAmount,total};
}
function payment(method,status,paid,total,old,allowPlatform=false) {
  let list;try{list=JSON.parse(db.prepare("SELECT value FROM settings WHERE key='payment_methods_list'").get()?.value||'[]');}catch{list=[];}
  if(method==='platform' && !allowPlatform) throw error('تحصيل المنصة يتطلب تطبيق توصيل / Platform collection requires a delivery app');
  if(method!=='platform' && !list.some(p=>p.id===method && p.active!==false) && method!==old?.payment_method) throw error('طريقة الدفع غير متاحة / Payment method unavailable');
  const amount=paid===undefined ? (status==='completed'?total:0) : money(number(paid,'paid amount'));
  if(status==='completed' && amount<total) throw error('المبلغ المدفوع غير كافٍ / Payment does not cover total');
  return {paid_amount:amount,change_amount:method==='cash'?money(Math.max(0,amount-total)):0};
}
module.exports={normalizeItems,totals,payment};
