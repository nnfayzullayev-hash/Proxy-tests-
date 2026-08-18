import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import pg from 'pg';
import PDFDocument from 'pdfkit';

const { Pool } = pg;

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static('web'));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
const ADMIN_ID = String(process.env.ADMIN_ID || '').trim();
const DATABASE_URL = process.env.DATABASE_URL?.trim();
const PAYMENT_CARD = process.env.PAYMENT_CARD?.trim() || '';

console.log('--------------------------------');
console.log('Proxy Tests bot starting...');
console.log('PORT:', PORT);
console.log('BOT_TOKEN:', BOT_TOKEN ? 'FOUND' : 'NOT FOUND');
console.log('ADMIN_ID:', ADMIN_ID ? 'FOUND' : 'NOT FOUND');
console.log('DATABASE_URL:', DATABASE_URL ? 'FOUND' : 'NOT FOUND');
console.log('--------------------------------');

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN topilmadi!');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL topilmadi!');
  process.exit(1);
}

const PUBLIC_URL =
  process.env.PUBLIC_URL ||
  `https://proxy-tests.onrender.com`;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function db(query, params = []) {
  return pool.query(query, params);
}

/* =========================
   DATABASE
========================= */

async function initDatabase() {
  console.log('⏳ Database ulanishi tekshirilmoqda...');

  await db('SELECT NOW()');

  console.log('✅ Database ulandi');

  await db(`
    CREATE TABLE IF NOT EXISTS users(
      id BIGINT PRIMARY KEY,
      name TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await db(`
    CREATE TABLE IF NOT EXISTS tests(
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      start_at TIMESTAMPTZ,
      duration_min INT DEFAULT 30,
      questions JSONB NOT NULL DEFAULT '[]',
      active BOOLEAN DEFAULT TRUE
    )
  `);

  await db(`
    CREATE TABLE IF NOT EXISTS tickets(
      code CHAR(6) PRIMARY KEY,
      user_id BIGINT,
      full_name TEXT,
      test_id INT REFERENCES tests(id),
      status TEXT DEFAULT 'pending',
      expires_at TIMESTAMPTZ,
      receipt_file_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await db(`
    CREATE TABLE IF NOT EXISTS attempts(
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      test_id INT REFERENCES tests(id),
      full_name TEXT,
      answers JSONB,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ
    )
  `);

  await db(`
    CREATE TABLE IF NOT EXISTS news(
      id SERIAL PRIMARY KEY,
      text TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  console.log('✅ Database jadvallari tayyor');
}

/* =========================
   TELEGRAM BOT
========================= */

const bot = new Telegraf(BOT_TOKEN);

bot.catch((error, ctx) => {
  console.error(
    '❌ Telegram bot xatosi:',
    error?.message || error
  );

  console.error(
    'Update:',
    ctx?.update?.update_id
  );
});

/* START */

bot.start(async (ctx) => {
  try {
    console.log(
      `📩 /start: ${ctx.from.id} - ${ctx.from.first_name || ''}`
    );

    await db(
      `
      INSERT INTO users(id, name)
      VALUES($1, $2)
      ON CONFLICT(id)
      DO UPDATE SET name = EXCLUDED.name
      `,
      [
        ctx.from.id,
        ctx.from.first_name || ''
      ]
    );

    await ctx.reply(
      '🤖 Proxy Tests bot\n\n' +
      'Test tizimiga kirish uchun quyidagi tugmani bosing.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🚀 Mini Appni ochish',
                web_app: {
                  url: PUBLIC_URL
                }
              }
            ]
          ]
        }
      }
    );

    console.log('✅ /start javobi yuborildi');
  } catch (error) {
    console.error(
      '❌ /start xatosi:',
      error?.message || error
    );
  }
});

/* ADMIN */

bot.command('admin', async (ctx) => {
  try {
    if (String(ctx.from.id) !== ADMIN_ID) {
      return ctx.reply('❌ Ruxsat yo‘q.');
    }

    await ctx.reply(
      '👨‍💼 Admin panel:\n' +
      PUBLIC_URL +
      '/admin.html'
    );
  } catch (error) {
    console.error(
      '❌ Admin command xatosi:',
      error?.message || error
    );
  }
});

/* CHEK RASMI */

bot.on('photo', async (ctx) => {
  try {
    if (String(ctx.from.id) !== ADMIN_ID) {
      return;
    }

    await ctx.reply(
      '🧾 Chek rasmi qabul qilindi.\n\n' +
      'Admin panel orqali tekshirib tasdiqlang.'
    );
  } catch (error) {
    console.error(
      '❌ Photo xatosi:',
      error?.message || error
    );
  }
});

/* =========================
   API
========================= */

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Proxy Tests</title>
      </head>
      <body>
        <h1>Proxy Tests server ishlayapti ✅</h1>
        <p>Telegram bot ham ishga tushirilmoqda.</p>
      </body>
    </html>
  `);
});

app.get('/health', async (req, res) => {
  try {
    await db('SELECT NOW()');

    res.json({
      ok: true,
      server: 'online',
      database: 'connected',
      botToken: Boolean(BOT_TOKEN)
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/* CONFIG */

app.get('/api/config', (req, res) => {
  res.json({
    paymentCard: PAYMENT_CARD
  });
});

/* NEWS */

app.get('/api/news', async (req, res) => {
  try {
    const result = await db(
      `
      SELECT *
      FROM news
      ORDER BY created_at DESC
      LIMIT 20
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Yangiliklarni olishda xato'
    });
  }
});

/* TESTS */

app.get('/api/tests', async (req, res) => {
  try {
    const result = await db(
      `
      SELECT
        id,
        title,
        start_at,
        duration_min
      FROM tests
      WHERE active = true
      ORDER BY start_at NULLS LAST, id DESC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Testlarni olishda xato'
    });
  }
});

/* REGISTER */

app.post('/api/register', async (req, res) => {
  try {
    const {
      telegramId,
      fullName
    } = req.body;

    if (!telegramId || !fullName) {
      return res.status(400).json({
        error: 'F.I.SH va Telegram ID kerak'
      });
    }

    await db(
      `
      INSERT INTO users(id, name)
      VALUES($1, $2)
      ON CONFLICT(id)
      DO UPDATE SET name = EXCLUDED.name
      `,
      [
        telegramId,
        fullName
      ]
    );

    res.json({
      ok: true
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Ro‘yxatdan o‘tishda xato'
    });
  }
});

/* TICKET */

app.post('/api/ticket', async (req, res) => {
  try {
    const {
      telegramId,
      fullName,
      testId,
      receiptFileId
    } = req.body;

    if (
      !telegramId ||
      !fullName ||
      !testId ||
      !receiptFileId
    ) {
      return res.status(400).json({
        error: 'Ma’lumotlar to‘liq emas'
      });
    }

    const test = await db(
      `
      SELECT id
      FROM tests
      WHERE id = $1
      AND active = true
      `,
      [testId]
    );

    if (!test.rowCount) {
      return res.status(404).json({
        error: 'Test topilmadi'
      });
    }

    let code;

    do {
      code = String(
        Math.floor(
          100000 + Math.random() * 900000
        )
      );

      const exists = await db(
        'SELECT code FROM tickets WHERE code=$1',
        [code]
      );

      if (!exists.rowCount) break;

    } while (true);

    await db(
      `
      INSERT INTO tickets(
        code,
        user_id,
        full_name,
        test_id,
        status,
        expires_at,
        receipt_file_id
      )
      VALUES(
        $1,
        $2,
        $3,
        $4,
        'pending',
        now() + interval '24 hours',
        $5
      )
      `,
      [
        code,
        telegramId,
        fullName,
        testId,
        receiptFileId
      ]
    );

    if (ADMIN_ID) {
      await bot.telegram.sendMessage(
        ADMIN_ID,
        `🎫 Yangi chipta so‘rovi

F.I.SH: ${fullName}
Test ID: ${testId}
Chek: ${receiptFileId}

Admin paneldan tasdiqlang.`
      );
    }

    res.json({
      ok: true,
      message:
        'Chek qabul qilindi. Admin tekshirganidan keyin chipta faollashadi.'
    });

  } catch (error) {
    console.error(
      '❌ Ticket xatosi:',
      error?.message || error
    );

    res.status(500).json({
      error: 'Chipta yaratishda xato'
    });
  }
});

/* VERIFY TICKET */

app.post('/api/verify-ticket', async (req, res) => {
  try {
    const {
      telegramId,
      fullName,
      code,
      testId
    } = req.body;

    const result = await db(
      `
      SELECT
        t.*,
        x.title
      FROM tickets t
      JOIN tests x
        ON x.id = t.test_id
      WHERE
        t.code = $1
        AND t.user_id = $2
        AND lower(t.full_name) = lower($3)
        AND t.test_id = $4
      `,
      [
        code,
        telegramId,
        fullName,
        testId
      ]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        error:
          'Chipta, F.I.SH yoki test mos emas.'
      });
    }

    const ticket = result.rows[0];

    if (ticket.status !== 'approved') {
      return res.status(403).json({
        error:
          'Chipta hali tasdiqlanmagan.'
      });
    }

    if (
      new Date(ticket.expires_at) <
      new Date()
    ) {
      return res.status(403).json({
        error:
          'Chipta muddati tugagan.'
      });
    }

    res.json({
      ok: true,
      ticket
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Chiptani tekshirishda xato'
    });
  }
});

/* TEST */

app.get('/api/test/:id', async (req, res) => {
  try {
    const result = await db(
      `
      SELECT *
      FROM tests
      WHERE id = $1
      AND active = true
      `,
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        error: 'Test topilmadi'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Testni olishda xato'
    });
  }
});

/* ATTEMPT */

app.post('/api/attempt', async (req, res) => {
  try {
    const {
      telegramId,
      testId,
      fullName,
      answers,
      startedAt
    } = req.body;

    if (
      !telegramId ||
      !testId ||
      !fullName ||
      !Array.isArray(answers)
    ) {
      return res.status(400).json({
        error: 'Ma’lumotlar to‘liq emas'
      });
    }

    const result = await db(
      `
      INSERT INTO attempts(
        user_id,
        test_id,
        full_name,
        answers,
        started_at,
        finished_at
      )
      VALUES(
        $1,
        $2,
        $3,
        $4,
        $5,
        now()
      )
      RETURNING id
      `,
      [
        telegramId,
        testId,
        fullName,
        JSON.stringify(answers),
        startedAt || new Date()
      ]
    );

    const attemptId =
      result.rows[0].id;

    /* PDF */

    if (ADMIN_ID) {

      const doc =
        new PDFDocument({
          margin: 50
        });

      const chunks = [];

      doc.on('data', chunk => {
        chunks.push(chunk);
      });

      doc.on('end', async () => {
        try {

          const pdf =
            Buffer.concat(chunks);

          await bot.telegram.sendDocument(
            ADMIN_ID,
            {
              source: pdf,
              filename:
                `javoblar-${attemptId}.pdf`
            },
            {
              caption:
                `📝 Test javoblari

F.I.SH: ${fullName}
Test ID: ${testId}
Natija ID: ${attemptId}`
            }
          );

          console.log(
            '✅ PDF adminga yuborildi'
          );

        } catch (error) {
          console.error(
            '❌ PDF yuborishda xato:',
            error?.message || error
          );
        }
      });

      doc
        .fontSize(18)
        .text(
          'TEST JAVOBLAR VARAQASI'
        )
        .moveDown();

      doc
        .fontSize(12)
        .text(
          `F.I.SH: ${fullName}`
        );

      doc.text(
        `Test ID: ${testId}`
      );

      doc.text(
        `Natija ID: ${attemptId}`
      );

      doc
        .text(
          `Yakunlangan: ${new Date().toLocaleString('uz-UZ')}`
        )
        .moveDown();

      answers.forEach(
        (answer, index) => {
          doc.text(
            `${index + 1}. ${
              answer || 'Belgilanmagan'
            }`
          );
        }
      );

      doc.end();
    }

    res.json({
      ok: true,
      attemptId
    });

  } catch (error) {
    console.error(
      '❌ Attempt xatosi:',
      error?.message || error
    );

    res.status(500).json({
      error: 'Test natijasini saqlashda xato'
    });
  }
});

/* =========================
   ADMIN API
========================= */

function checkAdmin(req, res) {
  if (
    !ADMIN_ID ||
    req.headers['x-admin-id'] !== ADMIN_ID
  ) {
    res.status(403).json({
      error: 'Ruxsat yo‘q'
    });

    return false;
  }

  return true;
}

/* TICKETS */

app.get('/api/admin/tickets', async (req, res) => {

  if (!checkAdmin(req, res)) return;

  try {

    const result = await db(
      `
      SELECT
        t.code,
        t.full_name,
        t.status,
        t.expires_at,
        x.title
      FROM tickets t
      JOIN tests x
        ON x.id = t.test_id
      ORDER BY t.created_at DESC
      `
    );

    res.json(result.rows);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Chiptalarni olishda xato'
    });
  }
});

/* APPROVE TICKET */

app.post(
  '/api/admin/ticket/:code/approve',
  async (req, res) => {

    if (!checkAdmin(req, res)) return;

    try {

      await db(
        `
        UPDATE tickets
        SET
          status = 'approved',
          expires_at =
            now() + interval '24 hours'
        WHERE code = $1
        `,
        [req.params.code]
      );

      res.json({
        ok: true
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          'Chiptani tasdiqlashda xato'
      });
    }
  }
);

/* NEWS */

app.post(
  '/api/admin/news',
  async (req, res) => {

    if (!checkAdmin(req, res)) return;

    try {

      await db(
        'INSERT INTO news(text) VALUES($1)',
        [req.body.text]
      );

      res.json({
        ok: true
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          'Yangilik qo‘shishda xato'
      });
    }
  }
);

/* CREATE TEST */

app.post(
  '/api/admin/tests',
  async (req, res) => {

    if (!checkAdmin(req, res)) return;

    try {

      const {
        title,
        startAt,
        durationMin,
        questions
      } = req.body;

      const result = await db(
        `
        INSERT INTO tests(
          title,
          start_at,
          duration_min,
          questions
        )
        VALUES(
          $1,
          $2,
          $3,
          $4
        )
        RETURNING *
        `,
        [
          title,
          startAt || null,
          durationMin || 30,
          JSON.stringify(
            questions || []
          )
        ]
      );

      res.json(
        result.rows[0]
      );

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          'Test yaratishda xato'
      });
    }
  }
);

/* =========================
   SERVER START
========================= */

async function startServer() {

  try {

    console.log(
      '⏳ Server ishga tushmoqda...'
    );

    await initDatabase();

    app.listen(
      PORT,
      () => {
        console.log(
          `✅ Server running on ${PORT}`
        );
        console.log(
          `🌐 Public URL: ${PUBLIC_URL}`
        );
      }
    );

    console.log(
      '⏳ Telegram bot ishga tushmoqda...'
    );

    await bot.launch();

    console.log(
      '================================'
    );
    console.log(
      '✅ TELEGRAM BOT STARTED!'
    );
    console.log(
      '================================'
    );

  } catch (error) {

    console.error(
      '================================'
    );

    console.error(
      '❌ SERVER/BOT START XATOSI'
    );

    console.error(
      error?.message || error
    );

    console.error(
      error?.stack || ''
    );

    console.error(
      '================================'
    );

    process.exit(1);
  }
}

process.once(
  'SIGINT',
  () => bot.stop('SIGINT')
);

process.once(
  'SIGTERM',
  () => bot.stop('SIGTERM')
);

startServer();