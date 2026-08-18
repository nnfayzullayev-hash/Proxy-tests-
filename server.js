import "dotenv/config";
import express from "express";
import { Telegraf, Markup } from "telegraf";
import pg from "pg";

const { Pool } = pg;

// ======================================================
// SOZLAMALAR
// ======================================================

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const DATABASE_URL = process.env.DATABASE_URL;

console.log("========================================");
console.log("🚀 PROXY TESTS BOT");
console.log("========================================");

// ======================================================
// ENVIRONMENT VARIABLES TEKSHIRISH
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on ${PORT}`);
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
      "❌ PostgreSQL xatosi:",
      error.message
    );
  });

  try {
    await pool.query("SELECT NOW()");

    console.log("✅ Database ulandi");

    // USERS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        full_name TEXT,
        username TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // TICKETS
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

    // NEWS
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

console.log("🔵 Telegram bot qismi boshlandi");

if (!BOT_TOKEN) {

  console.error(
    "❌ BOT_TOKEN yo‘q. Telegram bot ishga tushmaydi!"
  );

} else {

  console.log("🔵 Telegraf yaratilmoqda...");

  const bot = new Telegraf(BOT_TOKEN);

  // ----------------------------------------------------
  // BOT ERROR
  // ----------------------------------------------------

  bot.catch((error, ctx) => {
    console.error(
      "❌ Telegram bot xatosi:",
      error.message
    );

    console.error(
      "Update turi:",
      ctx?.updateType
    );
  });

  // ----------------------------------------------------
  // START
  // ----------------------------------------------------

  bot.start(async (ctx) => {

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

      // USER DATABASE
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
        `Assalomu alaykum, ${fullName || "foydalanuvchi"}! 👋\n\n` +
        `📝 Proxy Tests botiga xush kelibsiz!\n\n` +
        `Kerakli bo‘limni tanlang:`,
        Markup.keyboard([
          [
            "📰 Yangiliklar",
            "🎫 Chipta"
          ],
          [
            "📝 Testlar"
          ]
        ]).resize()
      );

    } catch (error) {

      console.error(
        "❌ START xatosi:",
        error.message
      );

      await ctx.reply(
        "❌ Xatolik yuz berdi."
      );
    }
  });

  // ----------------------------------------------------
  // YANGILIKLAR
  // ----------------------------------------------------

  bot.hears("📰 Yangiliklar", async (ctx) => {

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
          `${news.test_date ? `📅 ${news.test_date}\n` : ""}` +
          `\n`;
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
  });

  // ----------------------------------------------------
  // CHipta
  // ----------------------------------------------------

  bot.hears("🎫 Chipta", async (ctx) => {

    await ctx.reply(
      "🎫 CHIPTA BO‘LIMI\n\n" +
      "Bu yerda test uchun chipta sotib olish mumkin.\n\n" +
      "Hozircha chipta tizimi sozlanmoqda."
    );
  });

  // ----------------------------------------------------
  // TESTLAR
  // ----------------------------------------------------

  bot.hears("📝 Testlar", async (ctx) => {

    await ctx.reply(
      "📝 TESTLAR BO‘LIMI\n\n" +
      "Testni boshlash uchun amal qiluvchi chipta kerak."
    );
  });

  // ----------------------------------------------------
  // ADMIN TEST
  // ----------------------------------------------------

  bot.command("admin", async (ctx) => {

    const telegramId =
      String(ctx.from.id);

    if (
      ADMIN_ID &&
      telegramId !== String(ADMIN_ID)
    ) {

      await ctx.reply(
        "❌ Siz administrator emassiz."
      );

      return;
    }

    await ctx.reply(
      "👨‍💼 ADMIN PANEL\n\n" +
      "Bot ishlayapti.\n" +
      "Database ulangan."
    );
  });

  // ----------------------------------------------------
  // ID
  // ----------------------------------------------------

  bot.command("id", async (ctx) => {

    await ctx.reply(
      `🆔 Sizning Telegram ID'ingiz:\n\n${ctx.from.id}`
    );
  });

  // ----------------------------------------------------
  // BOTNI ISHGA TUSHIRISH
  // ----------------------------------------------------

  console.log(
    "🔵 bot.launch() chaqirilmoqda..."
  );

  try {

    await bot.launch({
      dropPendingUpdates: true
    });

    console.log("========================================");
    console.log("✅ TELEGRAM BOT ISHGA TUSHDI!");
    console.log("========================================");

    try {

      const me =
        await bot.telegram.getMe();

      console.log(
        `🤖 Bot: @${me.username}`
      );

      console.log(
        `🆔 Bot ID: ${me.id}`
      );

      console.log(
        "✅ Telegram bilan aloqa muvaffaqiyatli!"
      );

    } catch (error) {

      console.error(
        "❌ Bot ma'lumotlarini olish xatosi:",
        error.message
      );
    }

  } catch (error) {

    console.error("========================================");
    console.error("❌ TELEGRAM BOT ISHGA TUSHMADI!");
    console.error(
      "❌ XATO:",
      error.message
    );
    console.error("========================================");
  }

  // ----------------------------------------------------
  // SHUTDOWN
  // ----------------------------------------------------

  process.once(
    "SIGINT",
    () => bot.stop("SIGINT")
  );

  process.once(
    "SIGTERM",
    () => bot.stop("SIGTERM")
  );
}

// ======================================================
// SERVER.JS TUGADI
// ======================================================

console.log("🟢 server.js oxirigacha bajarildi");