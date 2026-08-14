const app=document.getElementById('app');
let me={telegramId:new URLSearchParams(location.search).get('user_id')||'0',fullName:''};
async function get(u,o){const r=await fetch(u,o);return r.json()}
function show(x){if(x==='news')news(); if(x==='tickets')tickets(); if(x==='tests')tests();}
async function news(){const n=await get('/api/news');app.innerHTML='<h2>Yangiliklar</h2>'+n.map(x=>`<div class="card">${esc(x.text)}<br><small>${new Date(x.created_at).toLocaleString()}</small></div>`).join('')||'<p>Yangilik yo‘q</p>'}
async function tickets(){
 const c=await get('/api/config'); const ts=await get('/api/tests');
 app.innerHTML=`<h2>🎫 Chipta</h2><p>To‘lov uchun karta: <b>${esc(c.paymentCard)}</b></p>
 <input id="name" placeholder="F.I.SH"><select id="test">${ts.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>
 <input id="receipt" placeholder="Chek Telegram file_id"><button onclick="buy()">Chekni yuborish</button>
 <hr><input id="code" placeholder="6 xonali chipta"><button onclick="verify()">Chiptani tekshirish</button><div id="msg"></div>`}
async function buy(){const r=await get('/api/ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telegramId:me.telegramId,fullName:document.getElementById('name').value,testId:document.getElementById('test').value,receiptFileId:document.getElementById('receipt').value})});document.getElementById('msg').textContent=r.message||r.error}
async function verify(){const r=await get('/api/verify-ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telegramId:me.telegramId,fullName:document.getElementById('name').value,code:document.getElementById('code').value,testId:document.getElementById('test').value})});document.getElementById('msg').textContent=r.ok?'Chipta tasdiqlandi. Testlar bo‘limiga kiring.':r.error}
async function tests(){const ts=await get('/api/tests');app.innerHTML='<h2>📝 Testlar</h2>'+ts.map(t=>`<div class="card"><b>${esc(t.title)}</b><br>Davomiyligi: ${t.duration_min} daqiqa<br><button onclick="start(${t.id})">Boshlash</button></div>`).join('')||'<p>Test yo‘q</p>'}
async function start(id){const t=await get('/api/test/'+id);let name=prompt('Avval F.I.SH kiriting:');if(!name)return;await get('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telegramId:me.telegramId,fullName:name})});
let i=0,answers=Array(t.questions.length).fill('');function render(){const q=t.questions[i];app.innerHTML=`<div class="timer" id="tm"></div><h3>${i+1}. ${esc(q.text)}</h3>`+(q.options||[]).map((o,j)=>`<button class="answer" onclick="pick(${j})">${String.fromCharCode(65+j)}. ${esc(o)}</button>`).join('')+`<button onclick="next()">${i===t.questions.length-1?'Yakunlash':'Keyingi'}</button>`}
window.pick=j=>answers[i]=String.fromCharCode(65+j);window.next=async()=>{if(i<t.questions.length-1){i++;render()}else{await get('/api/attempt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telegramId:me.telegramId,testId:id,fullName:name,answers})});app.innerHTML='<h2>Test yakunlandi ✅</h2><p>Javoblar varaqasi admin uchun PDF ko‘rinishida yuborildi.</p>'}};render();
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
show('news');