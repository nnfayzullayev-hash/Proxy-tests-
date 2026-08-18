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

console.log("========================================");
console.log("🚀 PROXY TESTS BOT");
console.log("========================================");

// ======================================================
// ENV TEKSHIRISH
// ======================================================

if (BOT_TOKEN) {
  console.log("✅ BOT_TOKEN topildi");
} else {
  console.error("❌ BOT_TOKEN TOPILMADI!");
}

if (ADMIN_ID) {
  console.log("✅ ADMIN_ID topildi");
} else {
  console.warn("⚠️ ADMIN_ID topilmadi");
}

if (DATABASE_URL) {
  console.log("✅ DATABASE_URL topildi");
} else {
  console.error("❌ DATABASE_URL TOPILMADI!");
}

// ======================================================
// EXPRESS
// ======================================================

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("✅ Proxy Tests Bot server ishlayapti!");
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
    console.error("❌ DATABASE_URL yo‘q!");
    return;
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        full_name TEXT,
        username TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tests (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title TEXT,
        content TEXT,
        test_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Database jadvallari tayyor");

  } catch (error) {

    console.error(
      "❌ Database xatosi:",
      error.message
    );

  }
}

// ======================================================
// TELEGRAM BOT
// ======================================================

let bot = null;

function createBot() {

  if (!BOT_TOKEN) {
    console.error(
      "❌ BOT_TOKEN yo‘q. Bot yaratilmaydi!"
    );
    return null;
  }

  console.log("🔵 Telegraf yaratilmoqda...");

  const telegramBot = new Telegraf(BOT_TOKEN);

  // ====================================================
  // /START
  // ====================================================

  telegramBot.start(async (ctx) => {

    try {

      const telegramId = ctx.from.id;

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

      if (pool) {

        await pool.query(
          `
          INSERT INTO users
          (
            telegram_id,
            full_name,
            username
          )
          VALUES ($1, $2, $3)

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

        console.log(
          "✅ Foydalanuvchi databasega saqlandi"
        );
      }

      await ctx.reply(
        `Assalomu alaykum, ${
          fullName || "foydalanuvchi"
        }! 👋\n\n` +
        `📝 Proxy Tests botiga xush kelibsiz!\n\n` +
        `Kerakli bo‘limni tanlang:`,
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
        "❌ START xatosi:",
        error.message
      );

      try {
        await ctx.reply(
          "❌ Xatolik yuz berdi."
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

        const result = await pool.query(`
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

        let text = "📰 YANGILIKLAR\n\n";

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
          "❌ Yangiliklar xatosi:",
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
        "🎫 CHIPTA BO‘LIMI\n\n" +
        "Bu yerda test uchun chipta sotib olish mumkin.\n\n" +
        "Hozircha chipta tizimi sozlanmoqda."
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
        "📝 TESTLAR BO‘LIMI\n\n" +
        "Testni boshlash uchun amal qiluvchi chipta kerak."
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

        const result = await pool.query(`
          SELECT full_name
          FROM users
          ORDER BY id ASC
          LIMIT 10
        `);

        if (result.rows.length === 0) {

          await ctx.reply(
            "🏆 LIGA\n\n" +
            "Hozircha reyting mavjud emas."
          );

          return;
        }

        let text =
          "🏆 LIGA REYTINGI\n\n";

        result.rows.forEach(
          (user, index) => {

            text +=
              `${index + 1}. ${
                user.full_name || "Noma'lum"
              }\n`;

          }
        );

        await ctx.reply(text);

      } catch (error) {

        console.error(
          "❌ Liga xatosi:",
          error.message
        );

        await ctx.reply(
          "❌ Liga ma’lumotlarini olishda xatolik."
        );
      }

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
        String(ctx.from.id) !== String(ADMIN_ID)
      ) {

        await ctx.reply(
          "❌ Siz administrator emassiz."
        );

        return;
      }

      await ctx.reply(
        "👨‍💼 ADMIN PANEL\n\n" +
        "✅ Bot ishlayapti\n" +
        "✅ Database ulangan"
      );

    }
  );

  // ====================================================
  // ID
  // ====================================================

  telegramBot.command(
    "id",
    async (ctx) => {

      await ctx.reply(
        `🆔 Sizning Telegram ID'ingiz:\n\n${ctx.from.id}`
      );

    }
  );

  // ====================================================
  // BOT ERROR
  // ====================================================

  telegramBot.catch(
    (error, ctx) => {

      console.error(
        "❌ Telegram bot xatosi:",
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
// SERVERNI ISHGA TUSHIRISH
// ======================================================

async function startServer() {

  try {

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
    console.log(
      "🔵 Telegram bot qismi boshlanmoqda..."
    );

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

    bot.launch({
      dropPendingUpdates: true
    })
    .then(async () => {

      console.log(
        "========================================"
      );

      console.log(
        "✅ TELEGRAM BOT ISHGA TUSHDI!"
      );

      console.log(
        "========================================"
      );

      try {

        const me =
          await bot.telegram.getMe();

        console.log(
          `🤖 BOT: @${me.username}`
        );

        console.log(
          `🆔 BOT ID: ${me.id}`
        );

        console.log(
          "✅ Telegram bilan aloqa muvaffaqiyatli!"
        );

      } catch (error) {

        console.error(
          "❌ getMe xatosi:",
          error.message
        );

      }

    })
    .catch((error) => {

      console.error(
        "========================================"
      );

      console.error(
        "❌ TELEGRAM BOT ISHGA TUSHMADI!"
      );

      console.error(
        "❌ XATO:",
        error.message
      );

      console.error(
        "========================================"
      );

    });

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

process.once(
  "SIGINT",
  () => {

    if (bot) {
      bot.stop("SIGINT");
    }

  }
);

process.once(
  "SIGTERM",
  () => {

    if (bot) {
      bot.stop("SIGTERM");
    }

  }
);

// ======================================================
// START
// ======================================================

startServer();