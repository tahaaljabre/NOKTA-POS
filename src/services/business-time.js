const {db}=require('../database/db');
const {error}=require('./orders.service');
function zone() {return db.prepare("SELECT value FROM settings WHERE key='business_timezone'").get()?.value||'Asia/Bangkok';}
function dayOf(value=new Date(),timeZone=zone()) {
  const date=value instanceof Date?value:new Date(String(value).includes('T')?value:String(value).replace(' ','T')+'Z');
  return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function validDay(day) {if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw error('تاريخ غير صالح / Invalid date');return day;}
// Local midnight expressed in UTC. Iterate because zone offsets may include DST.
function midnight(day) {
  validDay(day);const target=Date.parse(day+'T00:00:00Z');let guess=target;
  for(let i=0;i<3;i++) {
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone(),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)).map(p=>[p.type,p.value]));
    const displayed=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);guess+=target-displayed;
  }
  return new Date(guess).toISOString();
}
function range(from,to=from) {
  validDay(from);validDay(to);if(from>to)throw error('نطاق تاريخ غير صالح / Invalid date range');
  const next=new Date(to+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);
  return {start:midnight(from),end:midnight(next.toISOString().slice(0,10))};
}
module.exports={dayOf,range,zone,validDay};
