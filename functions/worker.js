const CERT_URL="https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let certCache={data:null,expiresAt:0};

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(request.method==="OPTIONS") return cors(new Response("",{status:204}));
    try{
      if(url.pathname==="/telegram/webhook"&&request.method==="POST") return await handleTelegram(await request.json(),env);
      if(url.pathname==="/api/health") return cors(json({ok:true,service:"keuanganku-worker"}));
      if(url.pathname==="/api/transactions"&&request.method==="GET") return await listTransactions(request,env);
      if(url.pathname==="/api/expense"&&request.method==="POST") return await createExpense(request,env);
      return cors(json({error:"not_found"},404));
    }catch(e){return cors(json({ok:false,error:e.message},500))}
  }
};

async function handleTelegram(update,env){
  const msg=update?.message;
  if(!msg?.text) return json({ok:true,ignored:true});
  if(env.TELEGRAM_CHAT_ID&&String(msg.chat?.id)!==String(env.TELEGRAM_CHAT_ID)) return json({ok:false,error:"chat_not_allowed"},403);
  const parsed=parseExpense(msg.text);
  if(!parsed){
    await tg(env,msg.chat.id,"format belum dikenali. contoh: makan 25k");
    return json({ok:true,parsed:false});
  }
  const data={...parsed,userId:env.DEFAULT_USER_ID,source:"telegram",telegramChatId:String(msg.chat.id),telegramMessageId:String(msg.message_id)};
  const result=await writeFirestore(data,env);
  await tg(env,msg.chat.id,"tercatat: "+parsed.note+" · "+idr(parsed.amount)+" · "+parsed.category);
  return json({ok:true,result});
}

async function createExpense(request,env){
  const uid=await authenticate(request,env);
  const body=await request.json();
  if(!body?.amount||!body?.note) return cors(json({ok:false,error:"amount dan note wajib"},400));
  return cors(json(await writeFirestore({...body,userId:uid,source:body.source||"api"},env)));
}

async function listTransactions(request,env){
  const uid=await authenticate(request,env);
  const base=firestoreBase(env,uid)+"/transactions";
  const r=await fetch(base+"?pageSize=100&orderBy=createdAt%20desc",{headers:{authorization:"Bearer "+await serviceAccessToken(env)}});
  if(!r.ok) throw new Error("Firestore read gagal: "+await r.text());
  const data=await r.json();
  const docs=(data.documents||[]).map(d=>fromFirestore(d));
  return cors(json({ok:true,transactions:docs}));
}

function parseExpense(text){
  const s=text.trim().replace(/,/g,".");
  const m=s.match(/(\d+(?:\.\d{1,3})?)\s*(jt|juta|rb|ribu|k|000)?\s*$/i);
  if(!m)return null;
  let n=parseFloat(m[1]); const unit=(m[2]||"").toLowerCase();
  if(unit==="jt"||unit==="juta")n*=1e6;else if(unit==="rb"||unit==="ribu"||unit==="k")n*=1e3;
  const note=s.slice(0,m.index).trim();
  return {date:new Date().toISOString().slice(0,10),note,category:cat(note),amount:Math.round(n),type:"expense"};
}
function cat(note){const n=note.toLowerCase();if(/makan|warung|kopi|minum/.test(n))return"makan";if(/grab|gojek|ojek|bensin|parkir|transport/.test(n))return"transportasi";if(/pulsa|listrik|wifi|tagihan|internet/.test(n))return"tagihan";if(/hibur|nonton|game/.test(n))return"hiburan";if(/tabung|saving/.test(n))return"tabungan";if(/beli|belanja|shop/.test(n))return"belanja";return"lainnya"}

async function writeFirestore(data,env){
  const id=crypto.randomUUID();
  const doc={fields:Object.fromEntries(Object.entries({...data,id,createdAt:new Date().toISOString()}).map(([k,v])=>[k,{stringValue:String(v)}]))};
  const url=firestoreBase(env,data.userId)+"/transactions/"+encodeURIComponent(id);
  const r=await fetch(url,{method:"PATCH",headers:{authorization:"Bearer "+await serviceAccessToken(env),"content-type":"application/json"},body:JSON.stringify(doc)});
  if(!r.ok)throw new Error("Firestore write gagal: "+await r.text());
  return {id};
}
function firestoreBase(env,uid){return "https://firestore.googleapis.com/v1/projects/"+env.FIREBASE_PROJECT_ID+"/databases/(default)/documents/users/"+encodeURIComponent(uid)}
function fromFirestore(doc){const f=doc.fields||{};const out={id:doc.name?.split("/").pop()};for(const [k,v] of Object.entries(f)){out[k]=Object.values(v)[0]}if(out.amount)out.amount=Number(out.amount);return out}

async function serviceAccessToken(env){
  const now=Math.floor(Date.now()/1000);
  const header={alg:"RS256",typ:"JWT"};
  const claim={iss:env.GCP_CLIENT_EMAIL,scope:"https://www.googleapis.com/auth/datastore",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600};
  const unsigned=b64u(JSON.stringify(header))+"."+b64u(JSON.stringify(claim));
  const key=await crypto.subtle.importKey("pkcs8",pemBytes(env.GCP_PRIVATE_KEY),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned));
  const jwt=unsigned+"."+b64u(sig);
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt}).toString()});
  if(!r.ok)throw new Error("OAuth service account gagal: "+await r.text());
  return (await r.json()).access_token;
}

async function authenticate(request,env){
  const h=request.headers.get("authorization")||"";
  const token=h.startsWith("Bearer ")?h.slice(7):"";
  if(!token)throw new Error("unauthorized");
  const parts=token.split(".");
  if(parts.length!==3)throw new Error("invalid_token");
  const header=JSON.parse(td(b64d(parts[0]))),payload=JSON.parse(td(b64d(parts[1])));
  if(payload.aud!==env.FIREBASE_PROJECT_ID||payload.iss!=="https://securetoken.google.com/"+env.FIREBASE_PROJECT_ID||!payload.sub)throw new Error("invalid_claims");
  if(payload.exp<Date.now()/1000)throw new Error("token_expired");
  const certs=await getCerts();
  const cert=certs[header.kid];if(!cert)throw new Error("unknown_key");
  const key=await crypto.subtle.importKey("spki",pemBytes(cert),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const ok=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64d(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  if(!ok)throw new Error("invalid_signature");
  return payload.user_id||payload.sub;
}
async function getCerts(){if(certCache.data&&certCache.expiresAt>Date.now())return certCache.data;const r=await fetch(CERT_URL);if(!r.ok)throw new Error("cert fetch failed");certCache.data=await r.json();certCache.expiresAt=Date.now()+3600000;return certCache.data}

async function tg(env,chat_id,text){if(!env.TELEGRAM_BOT_TOKEN||!chat_id)return;await fetch("https://api.telegram.org/bot"+env.TELEGRAM_BOT_TOKEN+"/sendMessage",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id,text})})}
function idr(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n)}
function pemBytes(pem){const b=pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g,"");return Uint8Array.from(atob(b),c=>c.charCodeAt(0))}
function b64u(v){const b=typeof v==="string"?new TextEncoder().encode(v):new Uint8Array(v);let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")}
function b64d(s){s=s.replaceAll("-","+").replaceAll("_","/");while(s.length%4)s+="=";const bin=atob(s);return Uint8Array.from(bin,c=>c.charCodeAt(0))}
function td(bytes){return new TextDecoder().decode(bytes)}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}})}
function cors(r){const h=new Headers(r.headers);h.set("access-control-allow-origin","*");h.set("access-control-allow-methods","GET,POST,OPTIONS");h.set("access-control-allow-headers","content-type,authorization");return new Response(r.body,{status:r.status,headers:h})}