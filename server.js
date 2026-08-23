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

// ======================================================
// TEKSHIRISH
// ======================================================

console.log("========================================");
console.log("🚀 PROXY TESTS BOT");
console.log("========================================");

console.log(
  BOT_TOKEN
    ? "✅ BOT_TOKEN topildi"
    : "❌ BOT_TOKEN topilmadi!"
);

console.log(
  ADMIN_ID
    ? "✅ ADMIN_ID topildi"
    : "⚠️ ADMIN_ID topilmadi"
);

console.log(
  DATABASE_URL
    ? "✅ DATABASE_URL topildi"
    : "❌ DATABASE_URL topilmadi!"
);

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN yo'q!");
  process.exit(1);
}

// ======================================================
// EXPRESS
// ======================================================

const app = express();

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
}

// ======================================================
// DATABASENI TAYYORLASH
// ======================================================

async function initDatabase() {

  if (!pool) {
    console.log(
      "⚠️ DATABASE_URL mavjud emas."
    );

    return;
  }

  try {

    console.log(
      "⏳ PostgreSQL ulanmoqda..."
    );

    await pool.query("SELECT NOW()");

    console.log(
      "✅ PostgreSQL ulandi"
    );

    // USERS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        full_name TEXT,
        username TEXT,
        created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log(
      "✅ users jadvali tayyor"
    );

  } catch (error) {

    console.error(
      "❌ DATABASE XATOSI:",
      error.message
    );

    throw error;
  }
}

// ======================================================
// USER SAQLASH
// ======================================================

async function saveUser(ctx) {

  if (!pool) {
    console.log(
      "⚠️ Database yo'q, user saqlanmadi."
    );

    return;
  }

  const telegramId =
    ctx.from.id;

  const firstName =
    ctx.from.first_name || "";

  const lastName =
    ctx.from.last_name || "";

  const username =
    ctx.from.username || null;

  const fullName =
    `${firstName} ${lastName}`.trim();

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

    console.log(
      `👤 User saqlandi: ${telegramId} | ${fullName}`
    );

  } catch (error) {

    console.error(
      "❌ USER SAQLASH XATOSI:",
      error.message
    );
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

    const name =
      ctx.from.first_name ||
      "foydalanuvchi";

    await ctx.reply(
      `Assalomu alaykum, ${name}! 👋

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

    await ctx.reply(
      "❌ Xatolik yuz berdi."
    );
  }
});

// ======================================================
// YANGILIKLAR
// ======================================================

bot.hears(
  "📰 Yangiliklar",
  async (ctx) => {

    await ctx.reply(
      `📰 YANGILIKLAR

Hozircha yangiliklar mavjud emas.

🔜 Bu bo'lim keyingi bosqichda ulanadi.`
    );
  }
);

// ======================================================
// CHIPTA
// ======================================================

bot.hears(
  "🎫 Chipta",
  async (ctx) => {

    await ctx.reply(
      `🎫 CHIPTA

Chipta olish tizimi tez orada ishga tushadi.`
    );
  }
);

// ======================================================
// TESTLAR
// ======================================================

bot.hears(
  "📝 Testlar",
  async (ctx) => {

    await ctx.reply(
      `📝 TESTLAR

Test tizimi tez orada ishga tushadi.

🎫 Avval chipta olishingiz kerak bo'ladi.`
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
          `🏆 LIGA

Hozircha foydalanuvchilar yo'q.`
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

// ======================================================
// USER ID
// ======================================================

bot.command(
  "id",
  async (ctx) => {

    await ctx.reply(
      `🆔 Sizning Telegram ID'ingiz:

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
        "❌ Siz administrator emassiz."
      );

      return;
    }

    await ctx.reply(
      `👨‍💼 ADMIN PANEL

✅ Bot ishlayapti
${pool ? "✅ Database ulangan" : "⚠️ Database ulanmagan"}

Keyingi bosqichlarda admin funksiyalari qo'shiladi.`
    );
  }
);

// ======================================================
// BOT XATOLARI
// ======================================================

bot.catch(
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

// ======================================================
// SERVERNI ISHGA TUSHIRISH
// ======================================================

async function start() {

  try {

    console.log(
      "🚀 Server ishga tushmoqda..."
    );

    // DATABASE
    await initDatabase();

    // EXPRESS SERVER
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

          // POLLING
          await bot.launch();

          console.log(
            "🟢 Telegram bot ishga tushdi!"
          );

        } catch (error) {

          console.error(
            "❌ BOT ISHGA TUSHISH XATOSI:",
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
    console.log("🛑 SIGINT");
    bot.stop("SIGINT");
  }
);

process.once(
  "SIGTERM",
  () => {
    console.log("🛑 SIGTERM");
    bot.stop("SIGTERM");
  }
);

// ======================================================
// START
// ======================================================

start();