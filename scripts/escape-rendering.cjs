// One-time migration, retained to document which rendering data was escaped.
const fs=require('fs');
for(const file of fs.readdirSync('public/js').filter(f=>f.endsWith('.js')&&f!=='safety.js')) {
 let s=fs.readFileSync('public/js/'+file,'utf8');
 s=s.replace(/\$\{([^{}]*)\}/g,(match,expr)=>{
   if(expr.includes('escapeHtml(')||expr.includes('safeImageUrl(')||/[`<>]/.test(expr)) return match;
   if(/^(i|item)\.image$/.test(expr)) return '${safeImageUrl('+expr+')}';
   if(/\.(?:name|name_en|item_name|item_name_en|employee_name|customer_name|customer_phone|phone|email|address|note|notes|details|icon|unit|group_name|group_name_en|delivery_notes|exported_at|summary|payment_method|status|action|message|restaurant_name|restaurant_address|restaurant_phone)\b/.test(expr) || /^(displayName|gName|name|raw|actionText|currency|restaurantName|restaurantNameEn|address|phone|footer|empName|methodName|stationName|customerName)$/.test(expr.trim()) || /^JSON\.stringify\(data\)/.test(expr)) {
     return '${escapeHtml('+expr+')}';
   }
   return match;
 });
 // Names must never be interpolated into JavaScript string literals in event attributes.
 s=s.replace(/deleteEmployee\(\$\{e.id\}, '\$\{escapeHtml\(e.name\)\}', true\)/g,"deleteEmployee(${e.id}, '', true)");
 s=s.replace(/openAdjustStockModal\(\$\{item.id\}, '\$\{escapeHtml\(item.item_name\)\}', \$\{item.quantity\}\)/g,"openAdjustStockModal(${item.id}, '', ${item.quantity})");
 // Entire JSON objects embedded in attributes require HTML escaping, including ampersands.
 s=s.replace(/JSON.stringify\(c\)\.replace\(\/"\/g, '&quot;'\)/g,'escapeHtml(JSON.stringify(c))');
 fs.writeFileSync('public/js/'+file,s);
}
for(const file of ['public/index.html','public/kds.html']) {
 let s=fs.readFileSync(file,'utf8');s=s.replace('<script src="i18n.js','<script src="js/safety.js?v=1"></script>\n  <script src="i18n.js');fs.writeFileSync(file,s);
}
