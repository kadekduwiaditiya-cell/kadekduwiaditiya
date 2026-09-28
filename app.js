const state = { salary:Number(localStorage.getItem('salary')||0), transactions:JSON.parse(localStorage.getItem('transactions')||'[]'), allocations:JSON.parse(localStorage.getItem('allocations')||'[]'), targets:JSON.parse(localStorage.getItem('targets')||'[]'), selectedMonth:new Date().toISOString().slice(0,7) };
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
const monthOf=d=>String(d).slice(0,7);
const fmtDate=d=>new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d+'T00:00:00'));
const filtered=()=>state.transactions.filter(t=>monthOf(t.date)===state.selectedMonth);
function save(){localStorage.setItem('salary',state.salary);localStorage.setItem('transactions',JSON.stringify(state.transactions));localStorage.setItem('allocations',JSON.stringify(state.allocations));localStorage.setItem('targets',JSON.stringify(state.targets))}
function render(){
  const tx=filtered(), ex=tx.filter(t=>t.type!=='income'), out=ex.reduce((a,t)=>a+Number(t.amount||0),0);
  const saveAlloc=state.allocations.filter(a=>a.category==='tabungan').reduce((a,t)=>a+Number(t.amount||0),0);
  const allocationTotal=state.allocations.reduce((a,t)=>a+Number(t.amount||0),0);
  $('salaryTotal').textContent=money(state.salary); $('salarySource').textContent=state.salary?'gaji tersimpan':'belum ada gaji';
  $('expenseTotal').textContent=money(out); $('expenseCount').textContent=ex.length+' transaksi';
  $('balanceTotal').textContent=money(state.salary-out); $('savingTotal').textContent=money(saveAlloc); $('savingMeta').textContent=allocationTotal?money(allocationTotal)+' total dialokasikan':'belum ada alokasi';
  $('flowIncome').textContent=money(state.salary); $('flowExpense').textContent=money(out); $('flowBalance').textContent=money(state.salary-out);
  $('periodLabel').textContent=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(state.selectedMonth+'-01T00:00:00'));
  $('todayLabel').textContent=new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  renderMonths(); renderAllocations(); renderTables(); renderTargets();
}
function renderMonths(){
  const months=new Set([new Date().toISOString().slice(0,7),...state.transactions.map(t=>monthOf(t.date))]);
  $('monthSelect').innerHTML=[...months].sort().reverse().map(m=>'<option value="'+m+'" '+(m===state.selectedMonth?'selected':'')+'>'+new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(m+'-01T00:00:00'))+'</option>').join('');
  $('monthSelect').onchange=e=>{state.selectedMonth=e.target.value;render()}
}
function renderAllocations(){
  const list=state.allocations;
  $('allocationList').innerHTML=list.length?list.map(a=>'<div class="alloc"><div class="allocTop"><span>'+esc(a.name)+'</span><b>'+money(a.amount)+'</b></div><div class="bar"><i style="width:'+Math.min((a.amount/(state.salary||1))*100,100)+'%"></i></div></div>').join(''):'<div style="color:#708078;font-size:11px">belum ada alokasi.</div>';
  $('allocationEditor').innerHTML=list.length?list.map((a,i)=>'<div style="display:grid;grid-template-columns:1fr 130px 120px auto;gap:8px;margin-bottom:8px"><input data-ai="'+i+'" data-k="name" value="'+esc(a.name)+'"><input type="number" data-ai="'+i+'" data-k="amount" value="'+a.amount+'"><select data-ai="'+i+'" data-k="category"><option '+(a.category==='kebutuhan'?'selected':'')+'>kebutuhan</option><option '+(a.category==='tabungan'?'selected':'')+'>tabungan</option><option '+(a.category==='hiburan'?'selected':'')+'>hiburan</option><option '+(a.category==='lainnya'?'selected':'')+'>lainnya</option></select><button type="button" class="light" data-rm="'+i+'">hapus</button></div>').join('')+'<button type="button" id="saveAlloc">simpan alokasi</button>':'<div style="color:#708078;font-size:11px">belum ada alokasi.</div>';
  document.querySelectorAll('[data-ai]').forEach(x=>x.oninput=()=>{const i=Number(x.dataset.ai);state.allocations[i][x.dataset.k]=x.dataset.k==='amount'?Number(x.value):x.value});
  document.querySelectorAll('[data-rm]').forEach(x=>x.onclick=()=>{state.allocations.splice(Number(x.dataset.rm),1);save();render()});
  $('saveAlloc')?.addEventListener('click',()=>{save();render()});
}
function rows(items,withActions=false){return items.map(t=>'<tr><td>'+fmtDate(t.date)+'</td><td>'+esc(t.note)+'</td><td>'+esc(t.category)+'</td><td>'+esc(t.source||'manual')+'</td><td>'+money(t.amount)+'</td>'+(withActions?'<td><button type="button" class="light" data-del="'+t.id+'">hapus</button></td>':'')+'</tr>').join('')}
function renderTables(){
  const q=($('searchInput')?.value||'').toLowerCase(), cat=$('categoryFilter')?.value||'';
  const items=filtered().filter(t=>(!q||((t.note||'')+' '+(t.category||'')).toLowerCase().includes(q))&&(!cat||t.category===cat)).sort((a,b)=>b.date.localeCompare(a.date));
  $('transactionTable').innerHTML=rows(items,true)||'<tr><td colspan="6" style="text-align:center;color:#708078">belum ada transaksi.</td></tr>';
  $('recentTransactions').innerHTML=rows(items.slice(0,7))||'<tr><td colspan="5" style="text-align:center;color:#708078">belum ada transaksi.</td></tr>';
  document.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>{state.transactions=state.transactions.filter(t=>t.id!==x.dataset.del);save();render()});
}
function renderTargets(){
  $('targetGrid').innerHTML=state.targets.length?state.targets.map((t,i)=>{const p=Math.min((t.saved/(t.goal||1))*100,100);return '<article class="target"><h3>'+esc(t.name)+'</h3><small>terkumpul</small><br><b>'+money(t.saved)+'</b><div class="bar"><i style="width:'+p+'%"></i></div><small>'+p.toFixed(0)+'% · target '+money(t.goal)+'</small><div class="mini"><button type="button" class="light" data-add="'+i+'">tambah dana</button><button type="button" class="light danger" data-targetdel="'+i+'">hapus</button></div></article>'}).join(''):'<article class="target"><h3>belum ada target</h3><small>buat target rumah, handphone, dana darurat, dan lainnya.</small></article>';
  document.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>modal('tambah dana ke target','<label>nominal</label><input id="v" type="number" min="0" required placeholder="500000">',()=>{state.targets[Number(x.dataset.add)].saved+=Number($('v').value);save();render()}));
  document.querySelectorAll('[data-targetdel]').forEach(x=>x.onclick=()=>{state.targets.splice(Number(x.dataset.targetdel),1);save();render()});
}
function modal(title,body,onSave){
  $('modalTitle').textContent=title; $('modalBody').innerHTML=body; $('modal').showModal();
  const submit=e=>{e.preventDefault();onSave();$('modal').close();$('modalForm').removeEventListener('submit',submit)};
  $('modalForm').addEventListener('submit',submit);
}
$('closeModal').onclick=$('cancelModal').onclick=()=>$('modal').close();
$('salaryBtn').onclick=()=>modal('input gaji','<label>nominal gaji bulan ini</label><input id="v" type="number" min="0" value="'+(state.salary||'')+'" required placeholder="5000000">',()=>{state.salary=Number($('v').value);save();render()});
$('expenseBtn').onclick=()=>modal('tambah pengeluaran','<label>tanggal</label><input id="d" type="date" value="'+new Date().toISOString().slice(0,10)+'" required><label>keterangan</label><input id="n" required placeholder="makan siang"><label>kategori</label><select id="c"><option>makan</option><option>transportasi</option><option>belanja</option><option>tagihan</option><option>hiburan</option><option>tabungan</option><option>lainnya</option></select><label>nominal</label><input id="a" type="number" min="0" required placeholder="25000">',()=>{state.transactions.push({id:crypto.randomUUID(),date:$('d').value,note:$('n').value,category:$('c').value,amount:Number($('a').value),type:'expense',source:'manual'});save();render()});
function allocModal(){modal('tambah alokasi','<label>nama pos</label><input id="n" required placeholder="tabungan rumah"><label>kategori</label><select id="c"><option>kebutuhan</option><option>tabungan</option><option>hiburan</option><option>lainnya</option></select><label>nominal</label><input id="a" type="number" min="0" required placeholder="1000000">',()=>{state.allocations.push({id:crypto.randomUUID(),name:$('n').value,category:$('c').value,amount:Number($('a').value)});save();render()})}
$('allocationBtn').onclick=allocModal;$('allocationBtn2').onclick=allocModal;
$('targetBtn').onclick=()=>modal('target baru','<label>nama target</label><input id="n" required placeholder="rumah"><label>nominal target</label><input id="g" type="number" min="0" required placeholder="100000000"><label>tabungan awal</label><input id="s" type="number" min="0" value="0">',()=>{state.targets.push({id:crypto.randomUUID(),name:$('n').value,goal:Number($('g').value),saved:Number($('s').value)});save();render()});
$('searchInput').oninput=renderTables;$('categoryFilter').onchange=renderTables;
$('exportBtn').onclick=()=>{const data=[['tanggal','keterangan','kategori','sumber','nominal'],...state.transactions.map(t=>[t.date,t.note,t.category,t.source||'manual',t.amount])];const csv=data.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='keuanganku-transaksi.csv';a.click()};
render();