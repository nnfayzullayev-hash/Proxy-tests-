import "dotenv/config";
import express from "express";
import { Telegraf, Markup } from "telegraf";
import pg from "pg";

const { Pool } = pg;

// ======================================================
// SOZLAMALAR
// ======================================================

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
const ADMIN_ID = process.env.ADMIN_ID?.trim();
const DATABASE_URL = process.env.DATABASE_URL?.trim();

const PAYMENT_CARD =
  process.env.PAYMENT_CARD?.trim() ||
  "Karta raqami sozlanmagan";

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN topilmadi!");
  process.exit(1);
}

// ======================================================
// EXPRESS
// ======================================================

const app = express();

app.get("/", (req, res) => {
  res.send("✅ Proxy Tests Bot ishlayapti!");
});

app.get("/health", (req, res) => {
  res.json({
    server: "online",
    database: DATABASE_URL ? "configured" : "missing",
    telegram: BOT_TOKEN ? "configured" : "missing"
  });
});

// ======================================================
// DATABASE
// ======================================================

let pool = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  pool.on("error", (error) => {
    console.error(
      "❌ PostgreSQL:",
      error.message
    );
  });
}

// ======================================================
// DATABASE INIT
// ======================================================

async function initDatabase() {

  if (!pool) {
    console.log("⚠️ DATABASE_URL mavjud emas.");
    return;
  }

  console.log("⏳ PostgreSQL ulanmoqda...");

  await pool.query("SELECT NOW()");

  console.log("✅ PostgreSQL ulandi");

  // ====================================================
  // USERS
  // ====================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      full_name TEXT,
      username TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS telegram_id BIGINT
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name TEXT
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username TEXT
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP
  `);

  console.log("✅ users jadvali tayyor");

  // ====================================================
  // NEWS
  // ====================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS news (
      id SERIAL PRIMARY KEY
    )
  `);

  await pool.query(`
    ALTER TABLE news
    ADD COLUMN IF NOT EXISTS title TEXT
  `);

  await pool.query(`
    ALTER TABLE news
    ADD COLUMN IF NOT EXISTS content TEXT
  `);

  await pool.query(`
    ALTER TABLE news
    ADD COLUMN IF NOT EXISTS test_date TEXT
  `);

  await pool.query(`
    ALTER TABLE news
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP
  `);

  console.log("✅ news jadvali tayyor");

  // ====================================================
  // TESTS
  // ====================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tests (
      id SERIAL PRIMARY KEY
    )
  `);

  await pool.query(`
    ALTER TABLE tests
    ADD COLUMN IF NOT EXISTS name TEXT
  `);

  await pool.query(`
    ALTER TABLE tests
    ADD COLUMN IF NOT EXISTS start_time TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE tests
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP
  `);

  console.log("✅ tests jadvali tayyor");

  // ====================================================
  // TICKETS
  // ====================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY
    )
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(6)
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS telegram_id BIGINT
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS full_name TEXT
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS test_name TEXT
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS test_id INTEGER
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS receipt_file_id TEXT
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20)
    DEFAULT 'pending'
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS approved_by BIGINT
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP
  `);

  console.log("✅ tickets jadvali tayyor");

  console.log("========================================");
  console.log("✅ DATABASE TAYYOR");
  console.log("========================================");
}

// ======================================================
// USER SAQLASH
// ======================================================

async function saveUser(ctx) {

  if (!pool) return;

  const telegramId = ctx.from.id;

  const fullName =
    `${ctx.from.first_name || ""} ${
      ctx.from.last_name || ""
    }`.trim();

  const username =
    ctx.from.username || null;

  try {

    await pool.query(
      `
      INSERT INTO users
      (
        telegram_id,
        full_name,
        username
      )
      VALUES
      ($1, $2, $3)

      ON CONFLICT (telegram_id)
      DO UPDATE SET
        full_name = EXCLUDED.full_name,
        username = EXCLUDED.username
      `,
      [
        telegramId,
        fullName,
        username
      ]
    );

  } catch (error) {

    console.error(
      "❌ USER SAQLASH:",
      error.message
    );
  }
}

// ======================================================
// CHIPTA GENERATOR
// ======================================================

async function generateTicketNumber() {

  while (true) {

    const number =
      Math.floor(
        100000 +
        Math.random() * 900000
      ).toString();

    const result =
      await pool.query(
        `
        SELECT id
        FROM tickets
        WHERE ticket_number = $1
        LIMIT 1
        `,
        [number]
      );

    if (result.rows.length === 0) {
      return number;
    }
  }
}

// ======================================================
// BOT
// ======================================================

const bot =
  new Telegraf(BOT_TOKEN);

// ======================================================
// START
// ======================================================

bot.start(async (ctx) => {

  try {

    console.log(
      `📩 /start: ${ctx.from.id}`
    );

    await saveUser(ctx);

    await ctx.reply(
      `Assalomu alaykum, ${
        ctx.from.first_name ||
        "foydalanuvchi"
      }! 👋

📝 Proxy Tests botiga xush kelibsiz!

Kerakli bo'limni tanlang:`,

      Markup.keyboard([
        [
          "📰 Yangiliklar",
          "🎫 Chipta"
        ],
        [
          "📝 Testlar",
          "🏆 Liga"
        ]
      ]).resize()
    );

  } catch (error) {

    console.error(
      "❌ START:",
      error.message
    );
  }
});

// ======================================================
// YANGILIKLAR
// ======================================================

bot.hears(
  "📰 Yangiliklar",
  async (ctx) => {

    if (!pool) {
      await ctx.reply(
        "❌ Database ulanmagan."
      );
      return;
    }

    try {

      const result =
        await pool.query(`
          SELECT
            id,
            title,
            content,
            test_date
          FROM news
          ORDER BY created_at DESC
          LIMIT 20
        `);

      if (result.rows.length === 0) {

        await ctx.reply(
          "📰 Hozircha yangiliklar mavjud emas."
        );

        return;
      }

      let text =
        "📰 YANGILIKLAR\n\n";

      for (const news of result.rows) {

        text +=
          `📌 ${news.title || "Yangilik"}\n`;

        text +=
          `${news.content || ""}\n`;

        if (news.test_date) {

          text +=
            `📅 ${news.test_date}\n`;
        }

        text +=
          "\n──────────────\n\n";
      }

      await ctx.reply(text);

    } catch (error) {

      console.error(
        "❌ YANGILIKLAR:",
        error.message
      );

      await ctx.reply(
        "❌ Yangiliklarni olishda xatolik."
      );
    }
  }
);

// ======================================================
// ADMIN: NEWS QO'SHISH
// ======================================================

bot.command(
  "addnews",
  async (ctx) => {

    if (
      ADMIN_ID &&
      String(ctx.from.id) !==
      String(ADMIN_ID)
    ) {

      await ctx.reply(
        "❌ Siz admin emassiz."
      );

      return;
    }

    if (!pool) {

      await ctx.reply(
        "❌ Database ulanmagan."
      );

      return;
    }

    const text =
      ctx.message.text
        .replace("/addnews", "")
        .trim();

    if (!text) {

      await ctx.reply(
        `📰 Format:

/addnews Sarlavha | Matn | Sana

Misol:

/addnews Yangi test | Ertaga test bo'ladi | 24.08.2026`
      );

      return;
    }

    const parts =
      text
        .split("|")
        .map(x => x.trim());

    if (parts.length < 2) {

      await ctx.reply(
        "❌ Format noto'g'ri."
      );

      return;
    }

    const title = parts[0];
    const content = parts[1];
    const testDate = parts[2] || null;

    try {

      await pool.query(
        `
        INSERT INTO news
        (
          title,
          content,
          test_date
        )
        VALUES
        ($1, $2, $3)
        `,
        [
          title,
          content,
          testDate
        ]
      );

      await ctx.reply(
        `✅ Yangilik qo'shildi!

📌 ${title}
📝 ${content}
📅 ${testDate || "Sana yo'q"}`
      );

    } catch (error) {

      console.error(
        "❌ NEWS INSERT:",
        error.message
      );

      await ctx.reply(
        `❌ Yangilikni saqlashda xatolik.

${error.message}`
      );
    }
  }
);

// ======================================================
// ADMIN: NEWS RO'YXATI
// ======================================================

bot.command(
  "newslist",
  async (ctx) => {

    if (
      ADMIN_ID &&
      String(ctx.from.id) !==
      String(ADMIN_ID)
    ) {

      await ctx.reply(
        "❌ Siz admin emassiz."
      );

      return;
    }

    const result =
      await pool.query(`
        SELECT
          id,
          title,
          test_date
        FROM news
        ORDER BY id DESC
      `);

    if (result.rows.length === 0) {

      await ctx.reply(
        "📰 Yangiliklar yo'q."
      );

      return;
    }

    let text =
      "📰 YANGILIKLAR\n\n";

    for (const news of result.rows) {

      text +=
        `🆔 ${news.id}\n`;

      text +=
        `📌 ${news.title}\n`;

      text +=
        `📅 ${
          news.test_date ||
          "Sana yo'q"
        }\n\n`;
    }

    await ctx.reply(text);
  }
);

// ======================================================
// ADMIN: NEWS O'CHIRISH
// ======================================================

bot.command(
  "delnews",
  async (ctx) => {

    if (
      ADMIN_ID &&
      String(ctx.from.id) !==
      String(ADMIN_ID)
    ) {

      await ctx.reply(
        "❌ Siz admin emassiz."
      );

      return;
    }

    const id =
      ctx.message.text
        .replace("/delnews", "")
        .trim();

    if (!id) {

      await ctx.reply(
        "Format: /delnews ID"
      );

      return;
    }

    try {

      const result =
        await pool.query(
          `
          DELETE FROM news
          WHERE id = $1
          RETURNING id
          `,
          [id]
        );

      if (result.rows.length === 0) {

        await ctx.reply(
          "❌ Yangilik topilmadi."
        );

        return;
      }

      await ctx.reply(
        `✅ Yangilik o'chirildi.

ID: ${id}`
      );

    } catch (error) {

      await ctx.reply(
        `❌ Xatolik: ${error.message}`
      );
    }
  }
);

// ======================================================
// ADMIN: TEST QO'SHISH
// ======================================================

bot.command(
  "addtest",
  async (ctx) => {

    if (
      ADMIN_ID &&
      String(ctx.from.id) !==
      String(ADMIN_ID)
    ) {

      await ctx.reply(
        "❌ Siz admin emassiz."
      );

      return;
    }

    if (!pool) {

      await ctx.reply(
        "❌ Database ulanmagan."
      );

      return;
    }

    const text =
      ctx.message.text
        .replace("/addtest", "")
        .trim();

    if (!text) {

      await ctx.reply(
        `📝 TEST QO'SHISH

Format:

/addtest Test nomi

Misol:

/addtest Tarix testi`
      );

      return;
    }

    try {

      const result =
        await pool.query(
          `
          INSERT INTO tests
          (
            name
          )
          VALUES
          ($1)
          RETURNING id, name
          `,
          [text]
        );

      const test =
        result.rows[0];

      await ctx.reply(
        `✅ Test qo'shildi!

🆔 ID: ${test.id}
📝 ${test.name}`
      );

    } catch (error) {

      await ctx.reply(
        `❌ Test qo'shishda xatolik.

${error.message}`
      );
    }
  }
);

// ======================================================
// ADMIN: TESTLAR RO'YXATI
// ======================================================

bot.command(
  "tests",
  async (ctx) => {

    if (
      ADMIN_ID &&
      String(ctx.from.id) !==
      String(ADMIN_ID)
    ) {

      await ctx.reply(
        "❌ Siz admin emassiz."
      );

      return;
    }

    const result =
      await pool.query(`
        SELECT
          id,
          name
        FROM tests
        ORDER BY id DESC
      `);

    if (result.rows.length === 0) {

      await ctx.reply(
        "📝 Testlar mavjud emas."
      );

      return;
    }

    let text =
      "📝 TESTLAR\n\n";

    for (const test of result.rows) {

      text +=
        `🆔 ${test.id} — ${test.name}\n`;
    }

    await ctx.reply(text);
  }
);

// ======================================================
// ADMIN: TEST O'CHIRISH
// ======================================================

bot.command(
  "deltest",
  async (ctx) => {

    if (
      ADMIN_ID &&
      String(ctx.from.id) !==
      String(ADMIN_ID)
    ) {

      await ctx.reply(
        "❌ Siz admin emassiz."
      );

      return;
    }

    const id =
      ctx.message.text
        .replace("/deltest", "")
        .trim();

    if (!id) {

      await ctx.reply(
        "Format: /deltest ID"
      );

      return;
    }

    try {

      const result =
        await pool.query(
          `
          DELETE FROM tests
          WHERE id = $1
          RETURNING id
          `,
          [id]
        );

      if (result.rows.length === 0) {

        await ctx.reply(
          "❌ Test topilmadi."
        );

        return;
      }

      await ctx.reply(
        `✅ Test o'chirildi.

ID: ${id}`
      );

    } catch (error) {

      await ctx.reply(
        `❌ Xatolik: ${error.message}`
      );
    }
  }
);

// ======================================================
// CHIPTA OLISH
// ======================================================

bot.hears(
  "🎫 Chipta",
  async (ctx) => {

    if (!pool) {

      await ctx.reply(
        "❌ Database ulanmagan."
      );

      return;
    }

    try {

      const result =
        await pool.query(`
          SELECT
            id,
            name
          FROM tests
          ORDER BY id ASC
        `);

      if (result.rows.length === 0) {

        await ctx.reply(
          `🎫 CHIPTA

Hozircha testlar mavjud emas.`
        );

        return;
      }

      const buttons =
        result.rows.map(
          (test) => [
            Markup.button.callback(
              `📝 ${test.name}`,
              `buy:${test.id}`
            )
          ]
        );

      await ctx.reply(
        `🎫 CHIPTA OLISH

Qaysi test uchun chipta olasiz?`,

        Markup.inlineKeyboard(
          buttons
        )
      );

    } catch (error) {

      console.error(
        "❌ CHIPTA:",
        error.message
      );

      await ctx.reply(
        "❌ Testlarni olishda xatolik."
      );
    }
  }
);

// ======================================================
// TEST TANLASH
// ======================================================

bot.action(
  /^buy:(\d+)$/,
  async (ctx) => {

    try {

      const testId =
        Number(ctx.match[1]);

      const result =
        await pool.query(
          `
          SELECT
            id,
            name
          FROM tests
          WHERE id = $1
          `,
          [testId]
        );

      if (result.rows.length === 0) {

        await ctx.answerCbQuery(
          "Test topilmadi."
        );

        return;
      }

      const test =
        result.rows[0];

      // Eski pending buyurtmani tekshirish

      const pending =
        await pool.query(
          `
          SELECT id
          FROM tickets
          WHERE telegram_id = $1
          AND test_id = $2
          AND payment_status = 'pending'
          LIMIT 1
          `,
          [
            ctx.from.id,
            testId
          ]
        );

      if (pending.rows.length > 0) {

        await ctx.answerCbQuery(
          "Sizda kutayotgan buyurtma bor."
        );

        await ctx.reply(
          `⏳ Siz "${test.name}" uchun allaqachon buyurtma bergansiz.

Chekni yuboring yoki admin tasdiqlashini kuting.`
        );

        return;
      }

      const fullName =
        `${ctx.from.first_name || ""} ${
          ctx.from.last_name || ""
        }`.trim();

      const resultTicket =
        await pool.query(
          `
          INSERT INTO tickets
          (
            telegram_id,
            full_name,
            test_name,
            test_id,
            payment_status
          )
          VALUES
          ($1, $2, $3, $4, 'pending')
          RETURNING id
          `,
          [
            ctx.from.id,
            fullName,
            test.name,
            testId
          ]
        );

      const ticketId =
        resultTicket.rows[0].id;

      await ctx.answerCbQuery();

      await ctx.reply(
        `🎫 CHIPTA BUYURTMASI

📝 Test:
${test.name}

💳 To'lov uchun karta:

${PAYMENT_CARD}

💰 To'lovni amalga oshirgach,
chek rasmini shu chatga yuboring.

🆔 Buyurtma ID:
${ticketId}`
      );

    } catch (error) {

      console.error(
        "❌ BUY XATOSI:",
        error.message
      );

      await ctx.answerCbQuery(
        "Xatolik yuz berdi."
      );
    }
  }
);

// ======================================================
// CHEK QABUL QILISH
// ======================================================

bot.on(
  "photo",
  async (ctx, next) => {

    if (!pool) {
      return next();
    }

    try {

      const result =
        await pool.query(
          `
          SELECT
            id,
            test_name
          FROM tickets
          WHERE telegram_id = $1
          AND payment_status = 'pending'
          AND receipt_file_id IS NULL
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [ctx.from.id]
        );

      if (result.rows.length === 0) {
        return next();
      }

      const ticket =
        result.rows[0];

      const photos =
        ctx.message.photo;

      const largest =
        photos[
          photos.length - 1
        ];

      const fileId =
        largest.file_id;

      await pool.query(
        `
        UPDATE tickets
        SET receipt_file_id = $1
        WHERE id = $2
        `,
        [
          fileId,
          ticket.id
        ]
      );

      await ctx.reply(
        `✅ CHEK QABUL QILINDI

🆔 Buyurtma:
${ticket.id}

📝 Test:
${ticket.test_name}

⏳ Admin tekshiruvini kuting.`
      );

      // ADMIN
      if (ADMIN_ID) {

        await bot.telegram.sendPhoto(
          ADMIN_ID,
          fileId,
          {
            caption:
              `💳 YANGI TO'LOV

🆔 Buyurtma:
${ticket.id}

📝 Test:
${ticket.test_name}

👤 Telegram ID:
${ctx.from.id}

👤 F.I.SH:
${(
  `${ctx.from.first_name || ""} ${
    ctx.from.last_name || ""
  }`
).trim()}`,

            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ TASDIQLASH",
                    callback_data:
                      `approve:${ticket.id}`
                  }
                ],
                [
                  {
                    text: "❌ RAD ETISH",
                    callback_data:
                      `reject:${ticket.id}`
                  }
                ]
              ]
            }
          }
        );
      }

    } catch (error) {

      console.error(
        "❌ CHEK:",
        error.message
      );

      await ctx.reply(
        "❌ Chekni saqlashda xatolik."
      );
    }
  }
);

// ======================================================
// ADMIN TASDIQLASH
// ======================================================

bot.action(
  /^approve:(\d+)$/,
  async (ctx) => {

    try {

      if (
        ADMIN_ID &&
        String(ctx.from.id) !==
        String(ADMIN_ID)
      ) {

        await ctx.answerCbQuery(
          "Siz admin emassiz."
        );

        return;
      }

      const ticketId =
        Number(ctx.match[1]);

      const result =
        await pool.query(
          `
          SELECT *
          FROM tickets
          WHERE id = $1
          LIMIT 1
          `,
          [ticketId]
        );

      if (result.rows.length === 0) {

        await ctx.answerCbQuery(
          "Buyurtma topilmadi."
        );

        return;
      }

      const ticket =
        result.rows[0];

      if (
        ticket.payment_status ===
        "approved"
      ) {

        await ctx.answerCbQuery(
          "Allaqachon tasdiqlangan."
        );

        return;
      }

      const ticketNumber =
        await generateTicketNumber();

      const expiresAt =
        new Date(
          Date.now() +
          24 * 60 * 60 * 1000
        );

      await pool.query(
        `
        UPDATE tickets
        SET
          ticket_number = $1,
          payment_status = 'approved',
          approved_by = $2,
          approved_at = CURRENT_TIMESTAMP,
          expires_at = $3
        WHERE id = $4
        `,
        [
          ticketNumber,
          ctx.from.id,
          expiresAt,
          ticketId
        ]
      );

      await bot.telegram.sendMessage(
        ticket.telegram_id,

        `🎉 TO'LOV TASDIQLANDI!

🎫 Sizning chiptangiz:

🔢 ${ticketNumber}

📝 Test:
${ticket.test_name}

⏰ Amal qilish muddati:
24 soat

📝 Testlar bo'limiga kirib,
chipta raqamingizni kiriting.`
      );

      await ctx.answerCbQuery(
        "✅ Tasdiqlandi!"
      );

      try {

        await ctx.editMessageCaption(
          `✅ TO'LOV TASDIQLANDI

🆔 Buyurtma:
${ticketId}

📝 Test:
${ticket.test_name}

🔢 Chipta:
${ticketNumber}

👤 Telegram ID:
${ticket.telegram_id}`
        );

      } catch {}

    } catch (error) {

      console.error(
        "❌ APPROVE:",
        error.message
      );

      await ctx.answerCbQuery(
        "Tasdiqlashda xatolik."
      );
    }
  }
);

// ======================================================
// ADMIN RAD ETISH
// ======================================================

bot.action(
  /^reject:(\d+)$/,
  async (ctx) => {

    try {

      if (
        ADMIN_ID &&
        String(ctx.from.id) !==
        String(ADMIN_ID)
      ) {

        await ctx.answerCbQuery(
          "Siz admin emassiz."
        );

        return;
      }

      const ticketId =
        Number(ctx.match[1]);

      const result =
        await pool.query(
          `
          SELECT *
          FROM tickets
          WHERE id = $1
          `,
          [ticketId]
        );

      if (result.rows.length === 0) {

        await ctx.answerCbQuery(
          "Buyurtma topilmadi."
        );

        return;
      }

      const ticket =
        result.rows[0];

      await pool.query(
        `
        UPDATE tickets
        SET
          payment_status = 'rejected',
          approved_by = $1,
          approved_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [
          ctx.from.id,
          ticketId
        ]
      );

      await bot.telegram.sendMessage(
        ticket.telegram_id,

        `❌ TO'LOV RAD ETILDI

📝 Test:
${ticket.test_name}

Iltimos, to'lov chekini tekshirib,
qaytadan urinib ko'ring.`
      );

      await ctx.answerCbQuery(
        "❌ Rad etildi."
      );

      try {

        await ctx.editMessageCaption(
          `❌ TO'LOV RAD ETILDI

🆔 Buyurtma:
${ticketId}

📝 Test:
${ticket.test_name}`
        );

      } catch {}

    } catch (error) {

      console.error(
        "❌ REJECT:",
        error.message
      );

      await ctx.answerCbQuery(
        "Rad etishda xatolik."
      );
    }
  }
);

// ======================================================
// TESTLAR BO'LIMI
// ======================================================

bot.hears(
  "📝 Testlar",
  async (ctx) => {

    await ctx.reply(
      `📝 TESTLAR

🎫 Testga kirish uchun tasdiqlangan
6 xonali chipta kerak.

Hozircha test tizimining o'zi
keyingi bosqichda ulanadi.`
    );
  }
);

// ======================================================
// LIGA
// ======================================================

bot.hears(
  "🏆 Liga",
  async (ctx) => {

    if (!pool) {

      await ctx.reply(
        "❌ Database ulanmagan."
      );

      return;
    }

    try {

      const result =
        await pool.query(`
          SELECT
            full_name
          FROM users
          WHERE full_name IS NOT NULL
          ORDER BY id ASC
          LIMIT 10
        `);

      if (result.rows.length === 0) {

        await ctx.reply(
          "🏆 Liga hozircha bo'sh."
        );

        return;
      }

      let text =
        "🏆 LIGA\n\n";

      result.rows.forEach(
        (user, index) => {

          text +=
            `${index + 1}. ${
              user.full_name
            }\n`;
        }
      );

      await ctx.reply(text);

    } catch (error) {

      await ctx.reply(
        "❌ Liga xatosi."
      );
    }
  }
);

// ======================================================
// USER ID
// ======================================================

bot.command(
  "id",
  async (ctx) => {

    await ctx.reply(
      `🆔 Sizning Telegram ID:

${ctx.from.id}`
    );
  }
);

// ======================================================
// ADMIN
// ======================================================

bot.command(
  "admin",
  async (ctx) => {

    if (
      ADMIN_ID &&
      String(ctx.from.id) !==
      String(ADMIN_ID)
    ) {

      await ctx.reply(
        "❌ Siz admin emassiz."
      );

      return;
    }

    await ctx.reply(
      `👨‍💼 ADMIN PANEL

📰 Yangilik:
 /addnews
 /newslist
 /delnews ID

📝 Test:
 /addtest
 /tests
 /deltest ID

🎫 Chipta:
Cheklar avtomatik keladi.

💳 Karta:
${PAYMENT_CARD}`
    );
  }
);

// ======================================================
// XATOLAR
// ======================================================

bot.catch(
  (error, ctx) => {

    console.error(
      "❌ TELEGRAM XATOSI:",
      error.message
    );

    console.error(
      "Update:",
      ctx?.updateType
    );
  }
);

// ======================================================
// START SERVER
// ======================================================

async function start() {

  try {

    console.log(
      "🚀 Server ishga tushmoqda..."
    );

    await initDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      async () => {

        console.log(
          `✅ Server running on ${PORT}`
        );

        try {

          const me =
            await bot.telegram.getMe();

          console.log(
            `🤖 BOT: @${me.username}`
          );

          await bot.launch();

          console.log(
            "🟢 Telegram bot ishga tushdi!"
          );

        } catch (error) {

          console.error(
            "❌ BOT XATOSI:",
            error.message
          );
        }
      }
    );

  } catch (error) {

    console.error(
      "❌ SERVER XATOSI:",
      error.message
    );

    process.exit(1);
  }
}

// ======================================================
// SHUTDOWN
// ======================================================

process.once(
  "SIGINT",
  () => {
    bot.stop("SIGINT");
  }
);

process.once(
  "SIGTERM",
  () => {
    bot.stop("SIGTERM");
  }
);

// ======================================================
// ISHGA TUSHIRISH
// ======================================================

start();