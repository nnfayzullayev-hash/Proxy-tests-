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

const WEBHOOK_URL =
  process.env.WEBHOOK_URL?.trim() ||
  "https://proxy-tests.onrender.com";

const PAYMENT_CARD =
  process.env.PAYMENT_CARD?.trim() ||
  "Karta raqami sozlanmagan";

const WEBHOOK_PATH = "/telegram/webhook";

let bot = null;
let pool = null;

// ======================================================
// LOG
// ======================================================

console.log("========================================");
console.log("🚀 PROXY TESTS BOT");
console.log("========================================");

console.log(
  BOT_TOKEN
    ? "✅ BOT_TOKEN topildi"
    : "❌ BOT_TOKEN TOPILMADI!"
);

console.log(
  ADMIN_ID
    ? "✅ ADMIN_ID topildi"
    : "⚠️ ADMIN_ID topilmadi"
);

console.log(
  DATABASE_URL
    ? "✅ DATABASE_URL topildi"
    : "❌ DATABASE_URL TOPILMADI!"
);

console.log(`🌐 WEBHOOK: ${WEBHOOK_URL}`);

// ======================================================
// EXPRESS
// ======================================================

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send(
    "✅ Proxy Tests Bot server ishlayapti!"
  );
});

app.get("/health", (req, res) => {
  res.status(200).json({
    server: "online",
    telegram: BOT_TOKEN ? "configured" : "missing",
    database: DATABASE_URL ? "configured" : "missing",
    webhook: WEBHOOK_URL
  });
});

// ======================================================
// DATABASE
// ======================================================

async function initDatabase() {

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL mavjud emas!");
    return false;
  }

  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  pool.on("error", (error) => {
    console.error(
      "❌ PostgreSQL xatosi:",
      error.message
    );
  });

  try {

    console.log("⏳ Database ulanmoqda...");

    await pool.query("SELECT NOW()");

    console.log("✅ Database ulandi");

    // ==================================================
    // USERS
    // ==================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY
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

    // ID sequence
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS users_id_seq
    `);

    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN id
      SET DEFAULT nextval('users_id_seq')
    `);

    await pool.query(`
      ALTER SEQUENCE users_id_seq
      OWNED BY users.id
    `);

    const maxUserId = await pool.query(`
      SELECT COALESCE(MAX(id), 0) AS max_id
      FROM users
    `);

    const nextUserId =
      Number(maxUserId.rows[0].max_id) + 1;

    await pool.query(
      `
      SELECT setval(
        'users_id_seq',
        $1,
        false
      )
      `,
      [nextUserId]
    );

    console.log("✅ Users jadvali tayyor");

    // ==================================================
    // TESTS
    // ==================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tests (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TIMESTAMP,
        created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Tests jadvali tayyor");

    // ==================================================
    // TICKETS
    // ==================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        ticket_number VARCHAR(6) UNIQUE,
        telegram_id BIGINT,
        full_name TEXT,
        test_name TEXT,
        test_id INTEGER,
        receipt_file_id TEXT,
        payment_status VARCHAR(20)
        DEFAULT 'pending',
        approved_by BIGINT,
        approved_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
      )
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

    console.log("✅ Tickets jadvali tayyor");

    // ==================================================
    // NEWS
    // ==================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title TEXT,
        content TEXT,
        test_date TEXT,
        created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ News jadvali tayyor");

    console.log("========================================");
    console.log("✅ DATABASE TAYYOR");
    console.log("========================================");

    return true;

  } catch (error) {

    console.error(
      "❌ DATABASE XATOSI:",
      error.message
    );

    return false;
  }
}

// ======================================================
// USER SAQLASH
// ======================================================

async function saveUser(
  telegramId,
  fullName,
  username
) {

  if (!pool) {
    throw new Error("Database ulanmagan");
  }

  const existing = await pool.query(
    `
    SELECT id
    FROM users
    WHERE telegram_id = $1
    LIMIT 1
    `,
    [telegramId]
  );

  if (existing.rows.length > 0) {

    await pool.query(
      `
      UPDATE users
      SET
        full_name = $1,
        username = $2
      WHERE telegram_id = $3
      `,
      [
        fullName,
        username || null,
        telegramId
      ]
    );

  } else {

    const result = await pool.query(
      `
      INSERT INTO users
      (
        telegram_id,
        full_name,
        username
      )
      VALUES
      ($1, $2, $3)
      RETURNING id
      `,
      [
        telegramId,
        fullName,
        username || null
      ]
    );

    console.log(
      `✅ User saqlandi. ID: ${result.rows[0].id}`
    );
  }
}

// ======================================================
// CHIPTA RAQAMI
// ======================================================

async function generateTicketNumber() {

  while (true) {

    const number =
      Math.floor(
        100000 + Math.random() * 900000
      ).toString();

    const result = await pool.query(
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
// BOT YARATISH
// ======================================================

function createBot() {

  if (!BOT_TOKEN) {
    console.error(
      "❌ BOT_TOKEN mavjud emas!"
    );

    return null;
  }

  const telegramBot =
    new Telegraf(BOT_TOKEN);

  // ====================================================
  // START
  // ====================================================

  telegramBot.start(async (ctx) => {

    try {

      const telegramId =
        ctx.from.id;

      const firstName =
        ctx.from.first_name || "";

      const lastName =
        ctx.from.last_name || "";

      const username =
        ctx.from.username || "";

      const fullName =
        `${firstName} ${lastName}`.trim();

      console.log(
        `📩 /start: ${telegramId} ${fullName}`
      );

      await saveUser(
        telegramId,
        fullName,
        username
      );

      await ctx.reply(
        `Assalomu alaykum, ${
          fullName || "foydalanuvchi"
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
        "❌ START XATOSI:",
        error.message
      );

      try {

        await ctx.reply(
          "❌ Xatolik yuz berdi. Qaytadan urinib ko'ring."
        );

      } catch {}
    }
  });

  // ====================================================
  // YANGILIKLAR
  // ====================================================

  telegramBot.hears(
    "📰 Yangiliklar",
    async (ctx) => {

      try {

        const result =
          await pool.query(`
            SELECT
              title,
              content,
              test_date
            FROM news
            ORDER BY created_at DESC
            LIMIT 10
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
            `📌 ${news.title || "Yangilik"}\n` +
            `${news.content || ""}\n` +
            `${
              news.test_date
                ? `📅 ${news.test_date}\n`
                : ""
            }\n`;
        }

        await ctx.reply(text);

      } catch (error) {

        console.error(
          "❌ YANGILIKLAR XATOSI:",
          error.message
        );

        await ctx.reply(
          "❌ Yangiliklarni olishda xatolik."
        );
      }
    }
  );

  // ====================================================
  // CHIPTA
  // ====================================================

  telegramBot.hears(
    "🎫 Chipta",
    async (ctx) => {

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

Hozircha testlar mavjud emas.

Admin test qo'shishi kerak.`
          );

          return;
        }

        const buttons =
          result.rows.map((test) => [
            Markup.button.callback(
              `📝 ${test.name}`,
              `buy_ticket:${test.id}`
            )
          ]);

        await ctx.reply(
          `🎫 CHIPTA OLISH

Qaysi test uchun chipta olmoqchisiz?`,

          Markup.inlineKeyboard(buttons)
        );

      } catch (error) {

        console.error(
          "❌ CHIPTA XATOSI:",
          error.message
        );

        await ctx.reply(
          "❌ Testlarni olishda xatolik."
        );
      }
    }
  );

  // ====================================================
  // TEST TANLASH
  // ====================================================

  telegramBot.action(
    /^buy_ticket:(\d+)$/,
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
            LIMIT 1
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

        const pending =
          await pool.query(
            `
            SELECT id
            FROM tickets
            WHERE telegram_id = $1
            AND test_id = $2
            AND payment_status = 'pending'
            AND receipt_file_id IS NOT NULL
            LIMIT 1
            `,
            [
              ctx.from.id,
              testId
            ]
          );

        if (pending.rows.length > 0) {

          await ctx.answerCbQuery(
            "Chekingiz allaqachon yuborilgan."
          );

          await ctx.reply(
            `⏳ Siz "${test.name}" uchun chek yuborgansiz.

Admin tasdiqlashini kuting.`
          );

          return;
        }

        const ticket =
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

              `${ctx.from.first_name || ""} ${
                ctx.from.last_name || ""
              }`.trim(),

              test.name,
              testId
            ]
          );

        const ticketId =
          ticket.rows[0].id;

        await ctx.answerCbQuery();

        await ctx.reply(
          `🎫 CHIPTA

📝 Test: ${test.name}

💳 To'lov uchun karta:

${PAYMENT_CARD}

💰 To'lovni amalga oshirgandan so'ng,
chek rasmini shu chatga yuboring.

⚠️ Chek aniq ko'rinsin.

🆔 Buyurtma ID: ${ticketId}`
        );

      } catch (error) {

        console.error(
          "❌ TEST TANLASH XATOSI:",
          error.message
        );

        await ctx.answerCbQuery(
          "Xatolik yuz berdi."
        );
      }
    }
  );
    // ====================================================
  // CHEK QABUL QILISH
  // ====================================================

  telegramBot.on(
    "photo",
    async (ctx, next) => {

      try {

        const pending =
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

        if (pending.rows.length === 0) {
          return next();
        }

        const ticket =
          pending.rows[0];

        const photos =
          ctx.message.photo;

        const largestPhoto =
          photos[photos.length - 1];

        const fileId =
          largestPhoto.file_id;

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
          `✅ Chek qabul qilindi.

📝 Test: ${ticket.test_name}

⏳ Admin tekshiradi.

Tasdiqlangandan keyin 6 xonali chipta beriladi.`
        );

        // ADMINGA CHEK YUBORISH
        if (ADMIN_ID) {

          await bot.telegram.sendPhoto(
            ADMIN_ID,
            fileId,
            {
              caption:
                `💳 YANGI TO'LOV

🆔 Buyurtma ID: ${ticket.id}

📝 Test: ${ticket.test_name}

👤 Telegram ID: ${ctx.from.id}

👤 F.I.SH:
${(
  `${ctx.from.first_name || ""} ${
    ctx.from.last_name || ""
  }`
).trim()}

Chekni tekshiring.`,

              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ TASDIQLASH",
                      callback_data:
                        `approve_ticket:${ticket.id}`
                    }
                  ],
                  [
                    {
                      text: "❌ RAD ETISH",
                      callback_data:
                        `reject_ticket:${ticket.id}`
                    }
                  ]
                ]
              }
            }
          );
        }

      } catch (error) {

        console.error(
          "❌ CHEK XATOSI:",
          error.message
        );

        await ctx.reply(
          "❌ Chekni qabul qilishda xatolik."
        );
      }
    }
  );

  // ====================================================
  // ADMIN TASDIQLASH
  // ====================================================

  telegramBot.action(
    /^approve_ticket:(\d+)$/,
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
            "Ticket topilmadi."
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

        if (
          ticket.payment_status ===
          "rejected"
        ) {

          await ctx.answerCbQuery(
            "Bu ticket rad etilgan."
          );

          return;
        }

        // 6 XONALI CHIPTA
        const ticketNumber =
          await generateTicketNumber();

        // 24 SOAT
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

        // FOYDALANUVCHIGA CHIPTA
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
ushbu chipta raqamini kiriting.`
        );

        await ctx.answerCbQuery(
          "✅ To'lov tasdiqlandi!"
        );

        try {

          await ctx.editMessageCaption(
            `✅ TO'LOV TASDIQLANDI

🆔 Buyurtma ID: ${ticketId}

📝 Test: ${ticket.test_name}

🔢 Chipta: ${ticketNumber}

👤 Telegram ID:
${ticket.telegram_id}`
          );

        } catch {}

      } catch (error) {

        console.error(
          "❌ TASDIQLASH XATOSI:",
          error.message
        );

        await ctx.answerCbQuery(
          "Tasdiqlashda xatolik."
        );
      }
    }
  );

  // ====================================================
  // ADMIN RAD ETISH
  // ====================================================

  telegramBot.action(
    /^reject_ticket:(\d+)$/,
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
            "Ticket topilmadi."
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

          `❌ TO'LOV RAD ETILDI.

📝 Test:
${ticket.test_name}

Iltimos, chekni tekshirib,
qaytadan chipta olishga urinib ko'ring.`
        );

        await ctx.answerCbQuery(
          "❌ To'lov rad etildi."
        );

        try {

          await ctx.editMessageCaption(
            `❌ TO'LOV RAD ETILDI

🆔 Buyurtma ID: ${ticketId}

📝 Test:
${ticket.test_name}

👤 Telegram ID:
${ticket.telegram_id}`
          );

        } catch {}

      } catch (error) {

        console.error(
          "❌ RAD ETISH XATOSI:",
          error.message
        );

        await ctx.answerCbQuery(
          "Rad etishda xatolik."
        );
      }
    }
  );

  // ====================================================
  // TESTLAR
  // ====================================================

  telegramBot.hears(
    "📝 Testlar",
    async (ctx) => {

      await ctx.reply(
        `📝 TESTLAR

Testni boshlash uchun 6 xonali
chipta raqamingizni yuboring.

Masalan:

123456`
      );
    }
  );

  // ====================================================
  // CHIPTA TEKSHIRISH
  // ====================================================

  telegramBot.on(
    "text",
    async (ctx, next) => {

      const text =
        ctx.message.text.trim();

      if (
        text.startsWith("/") ||
        text === "🎫 Chipta" ||
        text === "📝 Testlar" ||
        text === "📰 Yangiliklar" ||
        text === "🏆 Liga"
      ) {
        return next();
      }

      // FAQAT 6 XONALI RAQAM
      if (!/^\d{6}$/.test(text)) {
        return next();
      }

      try {

        const result =
          await pool.query(
            `
            SELECT
              ticket_number,
              test_name,
              test_id,
              expires_at,
              telegram_id
            FROM tickets
            WHERE ticket_number = $1
            AND payment_status = 'approved'
            LIMIT 1
            `,
            [text]
          );

        if (result.rows.length === 0) {

          await ctx.reply(
            "❌ Chipta topilmadi yoki hali tasdiqlanmagan."
          );

          return;
        }

        const ticket =
          result.rows[0];

        // MUDDAT
        if (
          ticket.expires_at &&
          new Date(ticket.expires_at) <
          new Date()
        ) {

          await ctx.reply(
            `❌ Bu chiptaning muddati tugagan.

🎫 Chipta:
${text}`
          );

          return;
        }

        // EGASINI TEKSHIRISH
        if (
          String(ticket.telegram_id) !==
          String(ctx.from.id)
        ) {

          await ctx.reply(
            "❌ Bu chipta boshqa foydalanuvchiga tegishli."
          );

          return;
        }

        await ctx.reply(
          `✅ CHIPTA TASDIQLANDI!

🎫 Chipta:
${ticket.ticket_number}

📝 Test:
${ticket.test_name}

⏰ Chipta 24 soat amal qiladi.

👤 F.I.SH'ingizni yuboring.

⚠️ Test tizimi keyingi bosqichda ulanadi.`
        );

      } catch (error) {

        console.error(
          "❌ CHIPTA TEKSHIRISH XATOSI:",
          error.message
        );

        await ctx.reply(
          "❌ Chiptani tekshirishda xatolik."
        );
      }
    }
  );

  // ====================================================
  // LIGA
  // ====================================================

  telegramBot.hears(
    "🏆 Liga",
    async (ctx) => {

      try {

        const result =
          await pool.query(`
            SELECT full_name
            FROM users
            WHERE full_name IS NOT NULL
            ORDER BY id ASC
            LIMIT 10
          `);

        if (result.rows.length === 0) {

          await ctx.reply(
            `🏆 LIGA

Hozircha reyting mavjud emas.`
          );

          return;
        }

        let text =
          "🏆 LIGA REYTINGI\n\n";

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

        console.error(
          "❌ LIGA XATOSI:",
          error.message
        );

        await ctx.reply(
          "❌ Liga ma'lumotlarini olishda xatolik."
        );
      }
    }
  );

  // ====================================================
  // ID
  // ====================================================

  telegramBot.command(
    "id",
    async (ctx) => {

      await ctx.reply(
        `🆔 Sizning Telegram ID'ingiz:

${ctx.from.id}`
      );
    }
  );

  // ====================================================
  // ADMIN
  // ====================================================

  telegramBot.command(
    "admin",
    async (ctx) => {

      if (
        ADMIN_ID &&
        String(ctx.from.id) !==
        String(ADMIN_ID)
      ) {

        await ctx.reply(
          "❌ Siz administrator emassiz."
        );

        return;
      }

      await ctx.reply(
        `👨‍💼 ADMIN PANEL

✅ Bot ishlayapti
✅ Database ulangan
✅ Webhook ishlayapti
✅ Chipta tizimi faol`
      );
    }
  );

  // ====================================================
  // BOT XATOLARI
  // ====================================================

  telegramBot.catch(
    (error, ctx) => {

      console.error(
        "❌ TELEGRAM XATOSI:",
        error.message
      );

      console.error(
        "Update turi:",
        ctx?.updateType
      );
    }
  );

  return telegramBot;
}

// ======================================================
// WEBHOOK
// ======================================================

async function setupWebhook() {

  const webhookUrl =
    `${WEBHOOK_URL}${WEBHOOK_PATH}`;

  console.log(
    "🔵 Webhook o'rnatilmoqda..."
  );

  console.log(
    `🌐 ${webhookUrl}`
  );

  await bot.telegram.setWebhook(
    webhookUrl
  );

  console.log(
    "✅ TELEGRAM WEBHOOK O'RNATILDI!"
  );
}

// ======================================================
// SERVER
// ======================================================

async function startServer() {

  try {

    console.log(
      "🚀 Server ishga tushmoqda..."
    );

    const databaseReady =
      await initDatabase();

    if (!databaseReady) {

      console.error(
        "❌ Database tayyor emas!"
      );
    }

    // BOT
    bot = createBot();

    if (!bot) {

      console.error(
        "❌ Bot yaratilmadi!"
      );

      return;
    }

    // WEBHOOK ROUTE
    app.use(
      WEBHOOK_PATH,
      bot.webhookCallback(WEBHOOK_PATH)
    );

    // SERVER
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

          await setupWebhook();

        } catch (error) {

          console.error(
            "❌ WEBHOOK XATOSI:",
            error.message
          );
        }
      }
    );

    console.log(
      "🟢 server.js oxirigacha bajarildi"
    );

  } catch (error) {

    console.error(
      "❌ SERVER XATOSI:",
      error.message
    );
  }
}

// ======================================================
// SHUTDOWN
// ======================================================

function shutdown(signal) {

  console.log(
    `🛑 ${signal} qabul qilindi`
  );

  if (pool) {
    pool.end();
  }

  process.exit(0);
}

process.once(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.once(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

// ======================================================
// START
// ======================================================

startServer();