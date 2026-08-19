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
let bot = null;

console.log("========================================");
console.log("🚀 PROXY TESTS BOT");
console.log("========================================");

// ======================================================
// ENV TEKSHIRISH
// ======================================================

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

// ======================================================
// EXPRESS SERVER
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
    database: DATABASE_URL ? "configured" : "missing"
  });
});

// ======================================================
// DATABASE
// ======================================================

let pool = null;

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

    console.log("✅ Users jadvali tayyor");

    // ==================================================
    // TICKETS
    // ==================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        ticket_number VARCHAR(6) UNIQUE NOT NULL,
        telegram_id BIGINT,
        full_name TEXT,
        test_name TEXT,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Tickets jadvali tayyor");

    // ==================================================
    // TESTS
    // ==================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tests (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Tests jadvali tayyor");

    // ==================================================
    // NEWS
    // ==================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title TEXT,
        content TEXT,
        test_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ News jadvali tayyor");

    console.log("✅ DATABASE TAYYOR");

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
    console.warn(
      "⚠️ Database mavjud emas"
    );
    return;
  }

  // Avval foydalanuvchini qidiramiz
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

    await pool.query(
      `
      INSERT INTO users
      (
        telegram_id,
        full_name,
        username
      )
      VALUES ($1, $2, $3)
      `,
      [
        telegramId,
        fullName,
        username || null
      ]
    );
  }

  console.log(
    "✅ Foydalanuvchi databasega saqlandi"
  );
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

  console.log(
    "🔵 Telegraf yaratilmoqda..."
  );

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

      // USERNI SAQLASH
      await saveUser(
        telegramId,
        fullName,
        username
      );

      // MENYU
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
          "❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring."
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

        if (!pool) {
          await ctx.reply(
            "❌ Database ulanmagan."
          );
          return;
        }

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

      await ctx.reply(
        `🎫 CHIPTA BO'LIMI

Test uchun chipta olish bo'limi.

Hozircha chipta tizimi sozlanmoqda.`
      );
    }
  );

  // ====================================================
  // TESTLAR
  // ====================================================

  telegramBot.hears(
    "📝 Testlar",
    async (ctx) => {

      await ctx.reply(
        `📝 TESTLAR BO'LIMI

Testni boshlash uchun amal qiluvchi chipta kerak.`
      );
    }
  );

  // ====================================================
  // LIGA
  // ====================================================

  telegramBot.hears(
    "🏆 Liga",
    async (ctx) => {

      try {

        if (!pool) {
          await ctx.reply(
            "❌ Database ulanmagan."
          );
          return;
        }

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
✅ Database ulangan`
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
// BOTNI ISHGA TUSHIRISH
// ======================================================

async function startBot() {

  console.log(
    "🔵 Telegram bot ishga tushirilmoqda..."
  );

  if (!BOT_TOKEN) {

    console.error(
      "❌ BOT_TOKEN mavjud emas!"
    );

    return;
  }

  try {

    // ==================================================
    // TELEGRAM API TEKSHIRISH
    // ==================================================

    console.log(
      "🔵 Telegram API tekshirilmoqda..."
    );

    const testBot =
      new Telegraf(BOT_TOKEN);

    const me =
      await testBot.telegram.getMe();

    console.log(
      "========================================"
    );

    console.log(
      "✅ TELEGRAM TOKEN TO'G'RI!"
    );

    console.log(
      `🤖 BOT: @${me.username}`
    );

    console.log(
      `🆔 BOT ID: ${me.id}`
    );

    console.log(
      "========================================"
    );

    // ==================================================
    // BOT YARATISH
    // ==================================================

    bot = createBot();

    if (!bot) {

      console.error(
        "❌ Bot yaratilmadi!"
      );

      return;
    }

    console.log(
      "🔵 bot.launch() chaqirilmoqda..."
    );

    // ==================================================
    // BOT LAUNCH
    // ==================================================

    await bot.launch({
      dropPendingUpdates: true
    });

    console.log(
      "========================================"
    );

    console.log(
      "✅ TELEGRAM BOT ISHGA TUSHDI!"
    );

    console.log(
      "========================================"
    );

  } catch (error) {

    console.error(
      "========================================"
    );

    console.error(
      "❌ TELEGRAM BOT XATOSI!"
    );

    console.error(
      "❌ XATO:",
      error.message
    );

    console.error(
      "========================================"
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

  if (bot) {
    bot.stop(signal);
  }

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
// SERVERNI ISHGA TUSHIRISH
// ======================================================

async function startServer() {

  try {

    console.log(
      "🚀 Server ishga tushmoqda..."
    );

    // DATABASE
    await initDatabase();

    // EXPRESS
    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          `✅ Server running on ${PORT}`
        );
      }
    );

    // BOT
    await startBot();

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
// START
// ======================================================

startServer();