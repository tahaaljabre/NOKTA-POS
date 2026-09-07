// Escape data at HTML interpolation sites, never modify stored business values.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function safeImageUrl(value) {
  const text=String(value||'');
  if(/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(text)) return text;
  try { const url=new URL(text,location.origin);return ['http:','https:'].includes(url.protocol)?escapeHtml(url.href):''; } catch {return '';}
}

function businessDate(value=new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:localStorage.getItem('pos_business_timezone')||'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);}
function parsePOSDate(value){return new Date(typeof value==='string' && /^\d{4}-\d{2}-\d{2} /.test(value)?value.replace(' ','T')+'Z':value);}
