export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response("", {status:204}));
    try {
      if (url.pathname === "/telegram/webhook" && request.method === "POST") {
        return await handleTelegram(await request.json(), env);
      }
      if (url.pathname === "/api/health") return cors(json({ok:true,service:"keuanganku-worker"}));
      if (url.pathname === "/api/expense" && request.method === "POST") {
        return await createExpense(await request.json(), env);
      }
      return cors(json({error:"not_found"},404));
    } catch (e) { return cors(json({ok:false,error:e.message},500)); }
  }
};

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}})}
function cors(r){const h=new Headers(r.headers);h.set("access-control-allow-origin","*");h.set("access-control-allow-methods","GET,POST,OPTIONS");h.set("access-control-allow-headers","content-type,authorization");return new Response(r.body,{status:r.status,headers:h})}
async function handleTelegram(update,env){
  const msg=update?.message; if(!msg?.text) return json({ok:true,ignored:true});
  if(env.TELEGRAM_SECRET && msg.chat?.id && String(msg.chat.id)!==String(env.TELEGRAM_CHAT_ID)) return json({ok:false,error:"chat_not_allowed"},403);
  const parsed=parseExpense(msg.text);
  if(!parsed) { await tg(env,msg.chat.id,"format belum dikenali. contoh: makan 25k"); return json({ok:true,parsed:false}); }
  const result=await writeFirestore({...parsed,userId:env.DEFAULT_USER_ID,source:"telegram",telegramChatId:String(msg.chat.id),telegramMessageId:String(msg.message_id)},env);
  await tg(env,msg.chat.id,"tercatat: "+parsed.note+" · "+idr(parsed.amount)+" · "+parsed.category);
  return json({ok:true,result});
}
async function createExpense(data,env){
  if(!data?.amount || !data?.note) return json({ok:false,error:"amount dan note wajib"},400);
  return cors(json(await writeFirestore({...data,userId:data.userId||env.DEFAULT_USER_ID,source:data.source||"api"},env)));
}
function parseExpense(text){
  const s=text.trim().replace(/,/g,".");
  const m=s.match(/(\d+(?:\.\d{1,3})?)\s*(jt|juta|rb|ribu|k|000)?\s*$/i); if(!m) return null;
  let n=parseFloat(m[1]); const unit=(m[2]||"").toLowerCase();
  if(unit==="jt"||unit==="juta") n*=1000000; else if(unit==="rb"||unit==="ribu"||unit==="k") n*=1000;
  const note=s.slice(0,m.index).trim(); const category=cat(note);
  return {date:new Date().toISOString().slice(0,10),note,category,amount:Math.round(n),type:"expense"};
}
function cat(note){const n=note.toLowerCase();if(/makan|warung|kopi|minum/.test(n))return"makan";if(/grab|gojek|ojek|bensin|parkir|transport/.test(n))return"transportasi";if(/pulsa|listrik|wifi|tagihan|internet/.test(n))return"tagihan";if(/hibur|nonton|game/.test(n))return"hiburan";if(/tabung|saving/.test(n))return"tabungan";if(/beli|belanja|shop/.test(n))return"belanja";return"lainnya"}
async function tg(env,chat_id,text){if(!env.TELEGRAM_BOT_TOKEN||!chat_id)return;await fetch("https://api.telegram.org/bot"+env.TELEGRAM_BOT_TOKEN+"/sendMessage",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id,text})})}
function idr(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n)}
async function writeFirestore(data,env){
  if(!env.FIRESTORE_URL) throw new Error("FIRESTORE_URL belum diset");
  const id=crypto.randomUUID();
  const payload={fields:Object.fromEntries(Object.entries({...data,id,createdAt:new Date().toISOString()}).map(([k,v])=>[k,{stringValue:String(v)}]))};
  const r=await fetch(env.FIRESTORE_URL+"/"+encodeURIComponent(id),{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  if(!r.ok) throw new Error("Firestore write gagal: "+await r.text());
  return {id};
}