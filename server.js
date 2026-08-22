import "dotenv/config";
import express from "express";
import { Telegraf, Markup } from "telegraf";
import pg from "pg";

const { Pool } = pg;

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const DATABASE_URL = process.env.DATABASE_URL;

const app = express();

app.get("/", (req, res) => {
  res.send("✅ Proxy Tests Bot ishlayapti!");
});

app.get("/health", (req, res) => {
  res.json({
    server: "online",
    bot: !!BOT_TOKEN,
    database: !!DATABASE_URL
  });
});

let pool = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  console.log("📩 /start:", ctx.from.id);

  await ctx.reply(
    `Assalomu alaykum, ${
      ctx.from.first_name || "foydalanuvchi"
    }! 👋

📝 Proxy Tests botiga xush kelibsiz!`,
    Markup.keyboard([
      ["📰 Yangiliklar", "🎫 Chipta"],
      ["📝 Testlar", "🏆 Liga"]
    ]).resize()
  );
});

bot.catch((err) => {
  console.error("❌ BOT XATOSI:", err);
});

async function start() {
  try {
    console.log("🚀 Server ishga tushmoqda...");

    if (pool) {
      await pool.query("SELECT NOW()");
      console.log("✅ PostgreSQL ulandi");
    } else {
      console.log("⚠️ DATABASE_URL yo'q");
    }

    app.listen(PORT, "0.0.0.0", async () => {
      console.log(`✅ Server running on ${PORT}`);

      await bot.launch();

      console.log("🤖 Telegram bot ishga tushdi!");
    });

  } catch (error) {
    console.error("❌ START XATOSI:", error);
    process.exit(1);
  }
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

start();