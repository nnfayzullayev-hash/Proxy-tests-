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
// EXPRESS SERVER
// ======================================================

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("✅ Proxy Tests Bot ishlayapti!");
});

app.get("/health", (req, res) => {
  res.json({
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
    // USERS JADVALI
    // ==================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY
      )
    `);

    // Eski users jadvaliga kerakli ustunlarni qo'shamiz
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
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    // Telegram ID uchun index
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      users_telegram_id_unique
      ON users(telegram_id)
    `);

    console.log("✅ Users jadvali tekshirildi");

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

    console.log("✅ DATABASE TO'LIQ TAYYOR");

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
// TELEGRAM BOT
// ======================================================

let bot = null;

function createBot() {

  if (!BOT_TOKEN) {
    console.error(
      "❌ BOT_TOKEN yo'q!"
    );

    return null;
  }

  console.log(
    "🔵 Telegram bot yaratilmoqda..."
  );

  const telegramBot = new Telegraf(BOT_TOKEN);

  // ====================================================
  // START
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

      // ================================================
      // USERNI DATABASEGA SAQLASH
      // ================================================

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
            username || null
          ]
        );

        console.log(
          "✅ Foydalanuvchi databasega saqlandi"
        );
      }

      // ================================================
      // MENYU
      // ================================================

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

      console.error(error);

      try {
        await ctx.reply(
          "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
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
        `🎫 CHIPTA BO'LIMI

Bu yerda test uchun chipta olish mumkin.

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

        const result = await pool.query(`
          SELECT full_name
          FROM users
          WHERE full_name IS NOT NULL
          ORDER BY id ASC
          LIMIT 10
        `);

        if (result.rows.length === 0) {

          await ctx.reply(
            `🏆 LIGA

Hozircha reytingda foydalanuvchilar yo'q.`
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
          "❌ Liga xatosi:",
          error.message
        );

        await ctx.reply(
          "❌ Liga ma'lumotlarini olishda xatolik."
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
        `👨‍💼 ADMIN PANEL

✅ Bot ishlayapti
✅ Database ulangan

🆔 Admin ID:
${ADMIN_ID || "mavjud emas"}`
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
        `🆔 Sizning Telegram ID'ingiz:

${ctx.from.id}`
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
        "Update:",
        ctx?.updateType
      );

    }
  );

  return telegramBot;
}

// ======================================================
// BOTNI ISHGA TUSHIRISH
// ======================================================

function startBot() {

  console.log(
    "🔵 Telegram bot ishga tushirilmoqda..."
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
        "✅ TELEGRAM BILAN ALOQA MUVAFFAQIYATLI!"
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
      "❌ TELEGRAM BOT ISHGA TUSHDI!"
    );

    console.error(
      "❌ XATO:",
      error.message
    );

    console.error(
      "========================================"
    );

  });
}

// ======================================================
// SERVERNI ISHGA TUSHIRISH
// ======================================================

async function startServer() {

  console.log(
    "🚀 Server ishga tushmoqda..."
  );

  await initDatabase();

  app.listen(
    PORT,
    "0.0.0.0",
    () => {

      console.log(
        `✅ Server running on ${PORT}`
      );

    }
  );

  startBot();

  console.log(
    "🟢 server.js oxirigacha bajarildi"
  );
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

startServer().catch((error) => {

  console.error(
    "❌ SERVERNI ISHGA TUSHIRISHDA XATO:",
    error
  );

});