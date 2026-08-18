import 'dotenv/config';
import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import pg from 'pg';

const { Pool } = pg;

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const DATABASE_URL = process.env.DATABASE_URL;

console.log('================================');
console.log('🚀 Server ishga tushmoqda...');

// ===============================
// ENV TEKSHIRISH
// ===============================

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN topilmadi!');
} else {
  console.log('✅ BOT_TOKEN topildi');
}

if (!ADMIN_ID) {
  console.warn('⚠️ ADMIN_ID topilmadi');
} else {
  console.log('✅ ADMIN_ID topildi');
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL topilmadi!');
} else {
  console.log('✅ DATABASE_URL topildi');
}

// ===============================
// DATABASE
// ===============================

let pool = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  pool.query('SELECT NOW()')
    .then(() => {
      console.log('✅ Database ulandi');

      return pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          telegram_id BIGINT UNIQUE NOT NULL,
          full_name TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    })
    .then(() => {
      console.log('✅ Database jadvallari tayyor');
    })
    .catch((err) => {
      console.error('❌ Database xatosi:', err.message);
    });
}

// ===============================
// EXPRESS SERVER
// ===============================

app.get('/', (req, res) => {
  res.send('Proxy Tests Bot ishlayapti! ✅');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: BOT_TOKEN ? 'configured' : 'missing',
    database: DATABASE_URL ? 'configured' : 'missing'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on ${PORT}`);
});

// ===============================
// TELEGRAM BOT
// ===============================

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN yo‘qligi sababli bot ishga tushmadi!');
} else {

  const bot = new Telegraf(BOT_TOKEN);

  // /start
  bot.start(async (ctx) => {

    try {

      const telegramId = ctx.from.id;
      const fullName =
        `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim();

      console.log(`👤 /start: ${telegramId} - ${fullName}`);

      // Userni databasega saqlash
      if (pool) {
        await pool.query(
          `
          INSERT INTO users (telegram_id, full_name)
          VALUES ($1, $2)
          ON CONFLICT (telegram_id)
          DO UPDATE SET full_name = EXCLUDED.full_name
          `,
          [telegramId, fullName]
        );
      }

      await ctx.reply(
        `Assalomu alaykum, ${fullName || 'foydalanuvchi'}! 👋\n\n` +
        `Proxy Tests botiga xush kelibsiz!`,
        Markup.keyboard([
          ['📰 Yangiliklar', '🎫 Chipta'],
          ['📝 Testlar']
        ]).resize()
      );

    } catch (error) {
      console.error('❌ /start xatosi:', error);
      await ctx.reply('❌ Xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.');
    }
  });

  // Yangiliklar
  bot.hears('📰 Yangiliklar', async (ctx) => {
    await ctx.reply(
      '📰 Yangiliklar bo‘limi\n\n' +
      'Hozircha yangiliklar mavjud emas.'
    );
  });

  // Chipta
  bot.hears('🎫 Chipta', async (ctx) => {
    await ctx.reply(
      '🎫 Chipta bo‘limi\n\n' +
      'Chipta sotib olish funksiyasi tez orada ishga tushadi.'
    );
  });

  // Testlar
  bot.hears('📝 Testlar', async (ctx) => {
    await ctx.reply(
      '📝 Testlar bo‘limi\n\n' +
      'Testni boshlash uchun chipta raqamingiz kerak.'
    );
  });

  // Xatolarni ushlash
  bot.catch((err, ctx) => {
    console.error(
      `❌ Telegram xatosi [${ctx.updateType}]:`,
      err
    );
  });

  // Botni ishga tushirish
  bot.launch()
    .then(async () => {

      console.log('================================');
      console.log('✅ TELEGRAM BOT ISHGA TUSHDI!');
      console.log('================================');

      try {
        const me = await bot.telegram.getMe();

        console.log(
          `🤖 Bot: @${me.username}`
        );

        console.log(
          `🆔 Bot ID: ${me.id}`
        );

        console.log(
          '✅ Telegram bilan aloqa muvaffaqiyatli!'
        );

      } catch (error) {
        console.error(
          '❌ Bot maʼlumotlarini olishda xato:',
          error.message
        );
      }
    })
    .catch((error) => {
      console.error('================================');
      console.error('❌ TELEGRAM BOT ISHGA TUSHMADI!');
      console.error('❌ XATO:', error.message);
      console.error('================================');
    });

  // Render o‘chirganda botni to‘xtatish
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}