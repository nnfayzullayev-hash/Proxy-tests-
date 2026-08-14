import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import pg from 'pg';
import PDFDocument from 'pdfkit';

const { Pool } = pg;
const app = express();
app.use(express.json({limit:'10mb'}));
app.use(express.static('web'));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || '');
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized:false } });

async function db(q, params=[]) { return pool.query(q, params); }

async function init() {
  await db(`CREATE TABLE IF NOT EXISTS users(
    id BIGINT PRIMARY KEY, name TEXT, created_at TIMESTAMPTZ DEFAULT now()
  )`);
  await db(`CREATE TABLE IF NOT EXISTS tests(
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, start_at TIMESTAMPTZ, duration_min INT DEFAULT 30,
    questions JSONB NOT NULL DEFAULT '[]', active BOOLEAN DEFAULT TRUE
  )`);
  await db(`CREATE TABLE IF NOT EXISTS tickets(
    code CHAR(6) PRIMARY KEY, user_id BIGINT, full_name TEXT, test_id INT REFERENCES tests(id),
    status TEXT DEFAULT 'pending', expires_at TIMESTAMPTZ, receipt_file_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`);
  await db(`CREATE TABLE IF NOT EXISTS attempts(
    id SERIAL PRIMARY KEY, user_id BIGINT, test_id INT REFERENCES tests(id),
    full_name TEXT, answers JSONB, started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ
  )`);
  await db(`CREATE TABLE IF NOT EXISTS news(
    id SERIAL PRIMARY KEY, text TEXT, created_at TIMESTAMPTZ DEFAULT now()
  )`);
}
await init();

function makeCode(){ return String(Math.floor(100000 + Math.random()*900000)); }

const bot = new Telegraf(BOT_TOKEN);
bot.start(async ctx => {
  const id = ctx.from.id;
  await db(`INSERT INTO users(id,name) VALUES($1,$2)
            ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name`, [id, ctx.from.first_name || '']);
  await ctx.reply(
    'Proxy Tests bot\\n\\nMini Appni ochish uchun tugmani bosing.',
    { reply_markup: { inline_keyboard: [[{text:'🚀 Mini Appni ochish', web_app:{url:PUBLIC_URL}}]] } }
  );
});

bot.command('admin', async ctx => {
  if (String(ctx.from.id)!==ADMIN_ID) return ctx.reply('Ruxsat yo‘q.');
  await ctx.reply('Admin panel: ' + PUBLIC_URL + '/admin.html');
});

bot.on('photo', async ctx => {
  if (String(ctx.from.id)!==ADMIN_ID) return;
  await ctx.reply('Chek rasmi qabul qilindi. Mini Appdagi chipta so‘rovi bilan tekshirib, admin paneldan tasdiqlang.');
});

app.get('/api/config', (req,res)=>res.json({paymentCard:process.env.PAYMENT_CARD||''}));

app.get('/api/news', async (req,res)=>{
  const r=await db('SELECT * FROM news ORDER BY created_at DESC LIMIT 20');
  res.json(r.rows);
});
app.get('/api/tests', async (req,res)=>{
  const r=await db('SELECT id,title,start_at,duration_min FROM tests WHERE active=true ORDER BY start_at NULLS LAST,id DESC');
  res.json(r.rows);
});
app.post('/api/register', async (req,res)=>{
  const {telegramId,fullName}=req.body;
  if(!telegramId || !fullName) return res.status(400).json({error:'F.I.SH va Telegram ID kerak'});
  await db(`INSERT INTO users(id,name) VALUES($1,$2)
    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name`,[telegramId,fullName]);
  res.json({ok:true});
});
app.post('/api/ticket', async (req,res)=>{
  const {telegramId,fullName,testId,receiptFileId}=req.body;
  if(!telegramId||!fullName||!testId||!receiptFileId) return res.status(400).json({error:'Ma’lumotlar to‘liq emas'});
  const t=await db('SELECT id FROM tests WHERE id=$1 AND active=true',[testId]);
  if(!t.rowCount) return res.status(404).json({error:'Test topilmadi'});
  const code=makeCode();
  await db(`INSERT INTO tickets(code,user_id,full_name,test_id,status,expires_at,receipt_file_id)
            VALUES($1,$2,$3,$4,'pending',now()+interval '24 hours',$5)`,
            [code,telegramId,fullName,testId,receiptFileId]);
  if(ADMIN_ID) await bot.telegram.sendMessage(ADMIN_ID,
    `🎫 Yangi chipta so‘rovi\\nF.I.SH: ${fullName}\\nTest ID: ${testId}\\nChek file_id: ${receiptFileId}\\n\\nAdmin paneldan tasdiqlang.`);
  res.json({ok:true,message:'Chek qabul qilindi. Admin tekshirganidan so‘ng chipta faollashadi.'});
});
app.post('/api/verify-ticket', async (req,res)=>{
  const {telegramId,fullName,code,testId}=req.body;
  const r=await db(`SELECT t.*,x.title FROM tickets t JOIN tests x ON x.id=t.test_id
                    WHERE t.code=$1 AND t.user_id=$2 AND lower(t.full_name)=lower($3) AND t.test_id=$4`,
                    [code,telegramId,fullName,testId]);
  if(!r.rowCount) return res.status(404).json({error:'Chipta, F.I.SH yoki test mos emas.'});
  const t=r.rows[0];
  if(t.status!=='approved') return res.status(403).json({error:'Chipta hali tasdiqlanmagan.'});
  if(new Date(t.expires_at)<new Date()) return res.status(403).json({error:'Chipta muddati tugagan.'});
  res.json({ok:true,ticket:t});
});
app.get('/api/test/:id', async (req,res)=>{
  const r=await db('SELECT * FROM tests WHERE id=$1 AND active=true',[req.params.id]);
  if(!r.rowCount) return res.status(404).json({error:'Test topilmadi'});
  res.json(r.rows[0]);
});
app.post('/api/attempt', async (req,res)=>{
  const {telegramId,testId,fullName,answers,startedAt}=req.body;
  if(!telegramId||!testId||!fullName||!Array.isArray(answers)) return res.status(400).json({error:'Ma’lumotlar to‘liq emas'});
  const r=await db(`INSERT INTO attempts(user_id,test_id,full_name,answers,started_at,finished_at)
                    VALUES($1,$2,$3,$4,$5,now()) RETURNING id`,
                    [telegramId,testId,fullName,JSON.stringify(answers),startedAt||new Date()]);
  const attemptId=r.rows[0].id;
  if(ADMIN_ID){
    const doc=new PDFDocument({margin:50});
    const chunks=[];
    doc.on('data',d=>chunks.push(d));
    doc.on('end',async()=>{
      try{
        await bot.telegram.sendDocument(ADMIN_ID,{source:Buffer.concat(chunks),filename:`javoblar-${attemptId}.pdf`},
          {caption:`📝 Test javoblari\\nF.I.SH: ${fullName}\\nTest ID: ${testId}`});
      }catch(e){ console.error(e.message); }
    });
    doc.fontSize(18).text('TEST JAVOBLAR VARAQASI').moveDown();
    doc.fontSize(12).text(`F.I.SH: ${fullName}`);
    doc.text(`Test ID: ${testId}`);
    doc.text(`Yakunlangan: ${new Date().toLocaleString('uz-UZ')}`).moveDown();
    answers.forEach((a,i)=>doc.text(`${i+1}. ${a || 'Belgilanmagan'}`));
    doc.end();
  }
  res.json({ok:true,attemptId});
});

app.get('/api/admin/tickets', async (req,res)=>{
  if(req.headers['x-admin-id']!==ADMIN_ID) return res.status(403).json({error:'Ruxsat yo‘q'});
  const r=await db(`SELECT t.code,t.full_name,t.status,t.expires_at,x.title
                    FROM tickets t JOIN tests x ON x.id=t.test_id ORDER BY t.created_at DESC`);
  res.json(r.rows);
});
app.post('/api/admin/ticket/:code/approve', async (req,res)=>{
  if(req.headers['x-admin-id']!==ADMIN_ID) return res.status(403).json({error:'Ruxsat yo‘q'});
  await db(`UPDATE tickets SET status='approved',expires_at=now()+interval '24 hours' WHERE code=$1`,[req.params.code]);
  res.json({ok:true});
});
app.post('/api/admin/news', async (req,res)=>{
  if(req.headers['x-admin-id']!==ADMIN_ID) return res.status(403).json({error:'Ruxsat yo‘q'});
  await db('INSERT INTO news(text) VALUES($1)',[req.body.text]);
  res.json({ok:true});
});
app.post('/api/admin/tests', async (req,res)=>{
  if(req.headers['x-admin-id']!==ADMIN_ID) return res.status(403).json({error:'Ruxsat yo‘q'});
  const {title,startAt,durationMin,questions}=req.body;
  const r=await db(`INSERT INTO tests(title,start_at,duration_min,questions) VALUES($1,$2,$3,$4) RETURNING *`,
    [title,startAt||null,durationMin||30,JSON.stringify(questions||[])]);
  res.json(r.rows[0]);
});

app.listen(PORT,()=>console.log(`Server running on ${PORT}`));
bot.launch().then(()=>console.log('Telegram bot started')).catch(console.error);
process.once('SIGINT',()=>bot.stop('SIGINT'));
process.once('SIGTERM',()=>bot.stop('SIGTERM'));
