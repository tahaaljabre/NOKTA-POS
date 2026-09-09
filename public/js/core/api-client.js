// Authenticated API client, pagination, and normalized network errors.
// ===== API =====
const API_BASE = (window.location.protocol === 'file:') ? 'http://localhost:3000' : '';

async function api(url, method = 'GET', body = null) {
  const fullUrl = url.startsWith('http') ? url : (API_BASE + url);
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Accept-Language':currentLang } };
  if (currentUser?.token) opts.headers.Authorization = `Bearer ${currentUser.token}`;
  if (body) opts.body = JSON.stringify(body);
  let res;
  const controller=new AbortController();opts.signal=controller.signal;
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{res=await fetch(fullUrl,opts);}catch(cause){const e=new Error(currentLang === "ar" ? "تعذر الوصول للخادم" : "Server is unreachable");e.network=true;throw e;}finally{clearTimeout(timeout);}
  isOnline=true;
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let errMsg = `Error ${escapeHtml(res.status)}`;
    if (contentType.includes('application/json')) {
      const errJson = await res.json();
      errMsg = errJson.error || errJson.message || errMsg;
    } else {
      const text = await res.text();
      errMsg = text.replace(/<[^>]*>?/gm, '').trim().slice(0, 100) || errMsg;
    }
    const failure=new Error(errMsg);failure.status=res.status;throw failure;
  }
  if (contentType.includes('application/json')) {
    const data=await res.json();
    if(method==='GET' && /^\/api\/orders\?/.test(url) && !/[?&](offset|limit)=/.test(url) && Array.isArray(data) && data.length===200){let result=data;for(let offset=200;offset<50000;offset+=200){const page=await api(url+'&limit=200&offset='+offset);result=result.concat(page);if(page.length<200)break;}return result;}
    return data;
  }
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return text; }
}
