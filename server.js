import "dotenv/config";

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import pg from "pg";

import {
  Telegraf,
  Markup
} from "telegraf";


// ======================================================
// PATH
// ======================================================

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);


// ======================================================
// POSTGRES
// ======================================================

const { Pool } = pg;


// ======================================================
// ENV
// ======================================================

const PORT =
  Number(process.env.PORT) || 10000;

const BOT_TOKEN =
  process.env.BOT_TOKEN?.trim();

const ADMIN_ID =
  process.env.ADMIN_ID?.trim();

const DATABASE_URL =
  process.env.DATABASE_URL?.trim();

const PAYMENT_CARD =
  process.env.PAYMENT_CARD?.trim() ||
  "Karta raqami sozlanmagan";


// ======================================================
// EXPRESS
// ======================================================

const app = express();

app.use(
  express.json({
    limit: "10mb"
  })
);


// ======================================================
// STATIC MINI APP
// ======================================================

const publicPath =
  path.join(__dirname, "public");

app.use(
  express.static(publicPath)
);


// ======================================================
// ROOT
// ======================================================

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      publicPath,
      "index.html"
    )
  );

});


// ======================================================
// HEALTH
// ======================================================

app.get("/health", (req, res) => {

  res.json({

    success: true,

    server: "online",

    telegram:
      BOT_TOKEN
        ? "configured"
        : "missing",

    database:
      pool
        ? "connected"
        : "not_connected"

  });

});


// ======================================================
// VARIABLES
// ======================================================

let bot = null;

let pool = null;


// ======================================================
// LOG
// ======================================================

console.log("");
console.log("================================");
console.log("🚀 PROXY TESTS BOT");
console.log("================================");

console.log(
  BOT_TOKEN
    ? "✅ BOT_TOKEN topildi"
    : "❌ BOT_TOKEN topilmadi"
);

console.log(
  ADMIN_ID
    ? "✅ ADMIN_ID topildi"
    : "⚠️ ADMIN_ID topilmadi"
);

console.log(
  DATABASE_URL
    ? "✅ DATABASE_URL topildi"
    : "❌ DATABASE_URL topilmadi"
);

console.log(
  `🌐 PORT: ${PORT}`
);

console.log("================================");


// ======================================================
// DATABASE
// ======================================================

async function initDatabase() {

  if (!DATABASE_URL) {

    console.error(
      "❌ DATABASE_URL mavjud emas!"
    );

    return false;

  }


  pool = new Pool({

    connectionString:
      DATABASE_URL,

    ssl: {
      rejectUnauthorized: false
    },

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000

  });


  pool.on(
    "error",
    (error) => {

      console.error(
        "❌ PostgreSQL:",
        error.message
      );

    }
  );


  try {

    console.log(
      "⏳ PostgreSQL ulanmoqda..."
    );


    await pool.query(
      "SELECT NOW()"
    );


    console.log(
      "✅ PostgreSQL ulandi"
    );


    // ==================================================
    // USERS
    // ==================================================

    await pool.query(`

      CREATE TABLE IF NOT EXISTS users (

        id SERIAL PRIMARY KEY,

        telegram_id BIGINT,

        full_name TEXT,

        username TEXT,

        created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

      )

    `);


    await pool.query(`

      ALTER TABLE users

      ADD COLUMN IF NOT EXISTS
      telegram_id BIGINT

    `);


    await pool.query(`

      ALTER TABLE users

      ADD COLUMN IF NOT EXISTS
      full_name TEXT

    `);


    await pool.query(`

      ALTER TABLE users

      ADD COLUMN IF NOT EXISTS
      username TEXT

    `);


    await pool.query(`

      ALTER TABLE users

      ADD COLUMN IF NOT EXISTS
      created_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP

    `);


    // Telegram ID uchun index

    await pool.query(`

      CREATE INDEX IF NOT EXISTS
      users_telegram_id_idx

      ON users(telegram_id)

    `);


    console.log(
      "✅ users tayyor"
    );


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


    console.log(
      "✅ tests tayyor"
    );


    // ==================================================
    // TICKETS
    // ==================================================

    await pool.query(`

      CREATE TABLE IF NOT EXISTS tickets (

        id SERIAL PRIMARY KEY,

        ticket_number VARCHAR(6)
        UNIQUE,

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


    // Eski database bo'lsa ham
    // ustunlarni qo'shib beradi

    await pool.query(`

      ALTER TABLE tickets

      ADD COLUMN IF NOT EXISTS
      ticket_number VARCHAR(6)

    `);


    await pool.query(`

      ALTER TABLE tickets

      ADD COLUMN IF NOT EXISTS
      telegram_id BIGINT

    `);


    await pool.query(`

      ALTER TABLE tickets

      ADD COLUMN IF NOT EXISTS
      full_name TEXT

    `);


    await pool.query(`

      ALTER TABLE tickets

      ADD COLUMN IF NOT EXISTS
      test_name TEXT

    `);


    await pool.query(`

      ALTER TABLE tickets

      ADD COLUMN IF NOT EXISTS
      test_id INTEGER

    `);


    await pool.query(`

      ALTER TABLE tickets

      ADD COLUMN IF NOT EXISTS
      receipt_file_id TEXT

    `);


    await pool.query(`

      ALTER TABLE tickets

      ADD COLUMN IF NOT EXISTS
      payment_status VARCHAR(20)
      DEFAULT 'pending'

    `);


    await pool.query(`

      ALTER TABLE tickets

      ADD COLUMN IF NOT EXISTS
      approved_by BIGINT

    `);


    await pool.query(`

      ALTER TABLE tickets

      ADD COLUMN IF NOT EXISTS
      approved_at TIMESTAMP

    `);


    await pool.query(`

      ALTER TABLE tickets

      ADD COLUMN IF NOT EXISTS
      expires_at TIMESTAMP

    `);


    await pool.query(`

      ALTER TABLE tickets

      ADD COLUMN IF NOT EXISTS
      created_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP

    `);


    await pool.query(`

      CREATE INDEX IF NOT EXISTS
      tickets_telegram_id_idx

      ON tickets(telegram_id)

    `);


    console.log(
      "✅ tickets tayyor"
    );


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


    // Eski news jadvali uchun

    await pool.query(`

      ALTER TABLE news

      ADD COLUMN IF NOT EXISTS
      title TEXT

    `);


    await pool.query(`

      ALTER TABLE news

      ADD COLUMN IF NOT EXISTS
      content TEXT

    `);


    await pool.query(`

      ALTER TABLE news

      ADD COLUMN IF NOT EXISTS
      test_date TEXT

    `);


    await pool.query(`

      ALTER TABLE news

      ADD COLUMN IF NOT EXISTS
      created_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP

    `);


    console.log(
      "✅ news tayyor"
    );


    console.log("");
    console.log(
      "✅ DATABASE TO'LIQ TAYYOR"
    );
    console.log("");


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

    throw new Error(
      "Database ulanmagan"
    );

  }


  const existing =
    await pool.query(
      `
      SELECT id

      FROM users

      WHERE telegram_id = $1

      LIMIT 1
      `,
      [telegramId]
    );


  if (
    existing.rows.length > 0
  ) {

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


    return;

  }


  const result =
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

      RETURNING id
      `,
      [
        telegramId,
        fullName,
        username || null
      ]
    );


  console.log(
    `✅ User saqlandi: ${result.rows[0].id}`
  );

}


// ======================================================
// TICKET NUMBER
// ======================================================

async function generateTicketNumber() {

  if (!pool) {

    throw new Error(
      "Database ulanmagan"
    );

  }


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


    if (
      result.rows.length === 0
    ) {

      return number;

    }

  }

}


// ======================================================
// CREATE BOT
// ======================================================

function createBot() {

  if (!BOT_TOKEN) {

    console.error(
      "❌ BOT_TOKEN mavjud emas!"
    );

    return null;

  }


  console.log(
    "🤖 Bot yaratilmoqda..."
  );


  const telegramBot =
    new Telegraf(
      BOT_TOKEN
    );


  // ====================================================
  // START
  // ====================================================

  telegramBot.start(
    async (ctx) => {

      try {

        const telegramId =
          ctx.from.id;


        const firstName =
          ctx.from.first_name ||
          "";


        const lastName =
          ctx.from.last_name ||
          "";


        const username =
          ctx.from.username ||
          "";


        const fullName =
          `${firstName} ${lastName}`.trim();


        console.log(
          `📩 /start: ${telegramId} ${fullName}`
        );


        if (pool) {

          await saveUser(
            telegramId,
            fullName,
            username
          );

        }


        await ctx.reply(

          `Assalomu alaykum, ${
            fullName ||
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
          "❌ START XATOSI:",
          error.message
        );


        await ctx.reply(
          "❌ Xatolik yuz berdi. Qaytadan /start bosing."
        );

      }

    }
  );


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

            ORDER BY
              created_at DESC

            LIMIT 10
          `);


        if (
          result.rows.length === 0
        ) {

          await ctx.reply(
            "📰 Hozircha yangiliklar mavjud emas."
          );

          return;

        }


        let text =
          "📰 YANGILIKLAR\n\n";


        for (
          const news
          of result.rows
        ) {

          text +=

            `📌 ${
              news.title ||
              "Yangilik"
            }\n` +

            `${
              news.content ||
              ""
            }\n` +

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
  // TESTLAR
  // ====================================================

  telegramBot.hears(
    "📝 Testlar",

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
              id,
              name,
              start_time

            FROM tests

            ORDER BY id ASC
          `);


        if (
          result.rows.length === 0
        ) {

          await ctx.reply(
            "📝 Hozircha testlar mavjud emas."
          );

          return;

        }


        let text =
          "📝 TESTLAR\n\n";


        for (
          const test
          of result.rows
        ) {

          text +=

            `🆔 ${test.id}\n` +

            `📚 ${test.name}\n` +

            `${
              test.start_time
                ? `⏰ ${test.start_time}\n`
                : ""
            }\n`;

        }


        await ctx.reply(text);


      } catch (error) {

        console.error(
          "❌ TESTLAR XATOSI:",
          error.message
        );


        await ctx.reply(
          "❌ Testlarni olishda xatolik."
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

        if (!pool) {

          await ctx.reply(
            "❌ Database ulanmagan."
          );

          return;

        }


        const result =
          await pool.query(`
            SELECT
              id,
              name

            FROM tests

            ORDER BY id ASC
          `);


        if (
          result.rows.length === 0
        ) {

          await ctx.reply(
            "🎫 Hozircha testlar mavjud emas."
          );

          return;

        }


        const buttons =
          result.rows.map(
            (test) => [

              Markup.button.callback(
                `📝 ${test.name}`,
                `buy_ticket:${test.id}`
              )

            ]
          );


        await ctx.reply(

          `🎫 CHIPTA OLISH

Qaysi test uchun chipta olmoqchisiz?`,

          Markup.inlineKeyboard(
            buttons
          )

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

        if (!pool) {

          await ctx.answerCbQuery(
            "Database ulanmagan."
          );

          return;

        }


        const testId =
          Number(
            ctx.match[1]
          );


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


        if (
          result.rows.length === 0
        ) {

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


        if (
          pending.rows.length > 0
        ) {

          await ctx.answerCbQuery(
            "Chek allaqachon yuborilgan."
          );


          await ctx.reply(
            `⏳ Siz "${test.name}" uchun chek yuborgansiz.

Admin tasdiqlashini kuting.`
          );

          return;

        }


        const fullName =
          `${ctx.from.first_name || ""} ${
            ctx.from.last_name || ""
          }`.trim();


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
              fullName,
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


  console.log(
    "✅ createBot() 1-qism tayyor"
  );


  // ====================================================
  // CHEK QABUL QILISH
  // ====================================================

  telegramBot.on(
    "photo",
    async (ctx, next) => {

      try {

        if (!pool) {

          await ctx.reply(
            "❌ Database ulanmagan."
          );

          return;

        }


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

          // Bu oddiy rasm bo'lishi mumkin
          return next();

        }


        const ticket =
          result.rows[0];


        const photos =
          ctx.message.photo;


        if (
          !photos ||
          photos.length === 0
        ) {

          await ctx.reply(
            "❌ Chek rasmi topilmadi."
          );

          return;

        }


        const largestPhoto =
          photos[
            photos.length - 1
          ];


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

          `✅ Chek qabul qilindi!

📝 Test: ${
  ticket.test_name ||
  "Test"
}

⏳ Admin tekshiradi.

Tasdiqlangandan keyin
6 xonali chipta beriladi.`

        );


        // =================================================
        // ADMINGA YUBORISH
        // =================================================

        if (ADMIN_ID) {

          await telegramBot.telegram.sendPhoto(

            ADMIN_ID,

            fileId,

            {

              caption:

`💳 YANGI TO'LOV

🆔 Buyurtma ID: ${ticket.id}

📝 Test:
${ticket.test_name || "Test"}

👤 Telegram ID:
${ctx.from.id}

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
                      text:
                        "✅ TASDIQLASH",

                      callback_data:
                        `approve_ticket:${ticket.id}`
                    }

                  ],

                  [

                    {
                      text:
                        "❌ RAD ETISH",

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

        // ----------------------------------------------
        // ADMIN TEKSHIRISH
        // ----------------------------------------------

        if (
          !ADMIN_ID ||
          String(ctx.from.id) !==
          String(ADMIN_ID)
        ) {

          await ctx.answerCbQuery(
            "❌ Siz admin emassiz."
          );

          return;

        }


        if (!pool) {

          await ctx.answerCbQuery(
            "Database ulanmagan."
          );

          return;

        }


        const ticketId =
          Number(
            ctx.match[1]
          );


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


        if (
          result.rows.length === 0
        ) {

          await ctx.answerCbQuery(
            "Ticket topilmadi."
          );

          return;

        }


        const ticket =
          result.rows[0];


        // ----------------------------------------------
        // OLDIN TASDIQLANGANMI?
        // ----------------------------------------------

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


        // ----------------------------------------------
        // CHIPTA RAQAMI
        // ----------------------------------------------

        const ticketNumber =
          await generateTicketNumber();


        // ----------------------------------------------
        // 24 SOAT
        // ----------------------------------------------

        const expiresAt =
          new Date(
            Date.now() +
            24 * 60 * 60 * 1000
          );


        // ----------------------------------------------
        // DATABASE UPDATE
        // ----------------------------------------------

        await pool.query(
          `
          UPDATE tickets

          SET
            ticket_number = $1,

            payment_status = 'approved',

            approved_by = $2,

            approved_at =
              CURRENT_TIMESTAMP,

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


        // ----------------------------------------------
        // FOYDALANUVCHIGA CHIPTA
        // ----------------------------------------------

        await telegramBot.telegram.sendMessage(

          ticket.telegram_id,

`🎉 TO'LOV TASDIQLANDI!

🎫 Sizning chiptangiz:

🔢 ${ticketNumber}

📝 Test:
${ticket.test_name || "Test"}

⏰ Amal qilish muddati:
24 soat

📝 Testlar bo'limiga kirib,
ushbu chipta raqamini kiriting.`

        );


        await ctx.answerCbQuery(
          "✅ To'lov tasdiqlandi!"
        );


        // ----------------------------------------------
        // ADMIN XABARINI YANGILASH
        // ----------------------------------------------

        try {

          await ctx.editMessageCaption(

`✅ TO'LOV TASDIQLANDI

🆔 Buyurtma ID:
${ticketId}

📝 Test:
${ticket.test_name || "Test"}

🔢 Chipta:
${ticketNumber}

👤 Telegram ID:
${ticket.telegram_id}`

          );

        } catch {

          // Xabar captionini o'zgartirish
          // majburiy emas

        }


      } catch (error) {

        console.error(
          "❌ TASDIQLASH XATOSI:",
          error.message
        );


        try {

          await ctx.answerCbQuery(
            "❌ Tasdiqlashda xatolik."
          );

        } catch {}

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

        // ----------------------------------------------
        // ADMIN TEKSHIRISH
        // ----------------------------------------------

        if (
          !ADMIN_ID ||
          String(ctx.from.id) !==
          String(ADMIN_ID)
        ) {

          await ctx.answerCbQuery(
            "❌ Siz admin emassiz."
          );

          return;

        }


        if (!pool) {

          await ctx.answerCbQuery(
            "Database ulanmagan."
          );

          return;

        }


        const ticketId =
          Number(
            ctx.match[1]
          );


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


        if (
          result.rows.length === 0
        ) {

          await ctx.answerCbQuery(
            "Ticket topilmadi."
          );

          return;

        }


        const ticket =
          result.rows[0];


        // ----------------------------------------------
        // OLDIN TASDIQLANGAN
        // ----------------------------------------------

        if (
          ticket.payment_status ===
          "approved"
        ) {

          await ctx.answerCbQuery(
            "Bu ticket allaqachon tasdiqlangan."
          );

          return;

        }


        // ----------------------------------------------
        // RAD ETISH
        // ----------------------------------------------

        await pool.query(
          `
          UPDATE tickets

          SET
            payment_status = 'rejected',

            approved_by = $1,

            approved_at =
              CURRENT_TIMESTAMP

          WHERE id = $2
          `,
          [
            ctx.from.id,
            ticketId
          ]
        );


        // ----------------------------------------------
        // FOYDALANUVCHIGA XABAR
        // ----------------------------------------------

        await telegramBot.telegram.sendMessage(

          ticket.telegram_id,

`❌ TO'LOV RAD ETILDI

📝 Test:
${ticket.test_name || "Test"}

🆔 Buyurtma:
${ticketId}

Iltimos, to'lov chekini tekshirib,
qaytadan chipta olishga urinib ko'ring.`

        );


        await ctx.answerCbQuery(
          "❌ To'lov rad etildi."
        );


        // ----------------------------------------------
        // ADMIN XABARINI O'ZGARTIRISH
        // ----------------------------------------------

        try {

          await ctx.editMessageCaption(

`❌ TO'LOV RAD ETILDI

🆔 Buyurtma ID:
${ticketId}

📝 Test:
${ticket.test_name || "Test"}

👤 Telegram ID:
${ticket.telegram_id}`

          );

        } catch {}


      } catch (error) {

        console.error(
          "❌ RAD ETISH XATOSI:",
          error.message
        );


        try {

          await ctx.answerCbQuery(
            "❌ Rad etishda xatolik."
          );

        } catch {}

      }

    }
  );


  // ====================================================
  // BOT ERROR HANDLER
  // ====================================================

  telegramBot.catch(
    (error, ctx) => {

      console.error(
        "❌ TELEGRAM BOT XATOSI:",
        error.message
      );

    }
  );


  console.log(
    "✅ createBot() tayyor"
  );


  return telegramBot;

}


// ======================================================
// MINI APP API — NEWS
// ======================================================

app.get(
  "/api/news",
  async (req, res) => {

    try {

      if (!pool) {

        return res.status(503).json({

          success: false,

          message:
            "Database ulanmagan"

        });

      }


      const result =
        await pool.query(`

          SELECT
            id,
            title,
            content,
            test_date,
            created_at

          FROM news

          ORDER BY
            created_at DESC

          LIMIT 50

        `);


      res.json({

        success: true,

        news: result.rows

      });


    } catch (error) {

      console.error(
        "API NEWS:",
        error.message
      );


      res.status(500).json({

        success: false,

        message:
          "Yangiliklarni olishda xatolik"

      });

    }

  }
);


// ======================================================
// MINI APP API — TESTS
// ======================================================

app.get(
  "/api/tests",
  async (req, res) => {

    try {

      if (!pool) {

        return res.status(503).json({

          success: false,

          message:
            "Database ulanmagan"

        });

      }


      const result =
        await pool.query(`

          SELECT
            id,
            name,
            start_time,
            created_at

          FROM tests

          ORDER BY id ASC

        `);


      res.json({

        success: true,

        tests: result.rows

      });


    } catch (error) {

      console.error(
        "API TESTS:",
        error.message
      );


      res.status(500).json({

        success: false,

        message:
          "Testlarni olishda xatolik"

      });

    }

  }
);


// ======================================================
// MINI APP API — USER
// ======================================================

app.get(
  "/api/user/:telegramId",
  async (req, res) => {

    try {

      if (!pool) {

        return res.status(503).json({

          success: false,

          message:
            "Database ulanmagan"

        });

      }


      const telegramId =
        req.params.telegramId;


      const result =
        await pool.query(
          `
          SELECT
            id,
            telegram_id,
            full_name,
            username,
            created_at

          FROM users

          WHERE telegram_id = $1

          LIMIT 1
          `,
          [telegramId]
        );


      if (
        result.rows.length === 0
      ) {

        return res.json({

          success: false,

          message:
            "User topilmadi"

        });

      }


      res.json({

        success: true,

        user:
          result.rows[0]

      });


    } catch (error) {

      console.error(
        "API USER:",
        error.message
      );


      res.status(500).json({

        success: false,

        message:
          "User olishda xatolik"

      });

    }

  }
);


// ======================================================
// MINI APP API — TICKETS
// ======================================================

app.get(
  "/api/tickets/:telegramId",
  async (req, res) => {

    try {

      if (!pool) {

        return res.status(503).json({

          success: false,

          message:
            "Database ulanmagan"

        });

      }


      const telegramId =
        req.params.telegramId;


      const result =
        await pool.query(
          `
          SELECT
            id,
            ticket_number,
            test_name,
            test_id,
            payment_status,
            expires_at,
            created_at

          FROM tickets

          WHERE telegram_id = $1

          ORDER BY
            created_at DESC

          LIMIT 50
          `,
          [telegramId]
        );


      res.json({

        success: true,

        tickets:
          result.rows

      });


    } catch (error) {

      console.error(
        "API TICKETS:",
        error.message
      );


      res.status(500).json({

        success: false,

        message:
          "Chiptalarni olishda xatolik"

      });

    }

  }
);


// ======================================================
// SERVER START
// ======================================================

async function startServer() {

  console.log("");
  console.log(
    "🚀 Server ishga tushmoqda..."
  );


  // ----------------------------------------------
  // DATABASE
  // ----------------------------------------------

  await initDatabase();


  // ----------------------------------------------
  // BOT
  // ----------------------------------------------

  if (BOT_TOKEN) {

    try {

      bot =
        createBot();


      if (!bot) {

        console.error(
          "❌ Bot yaratilmadi!"
        );

      } else {

        console.log(
          "🤖 Telegram bot tayyor"
        );


        // ------------------------------------------
        // WEBHOOKNI O'CHIRISH
        // POLLING ISHLATAMIZ
        // ------------------------------------------

        await bot.telegram.deleteWebhook({
          drop_pending_updates: false
        });


        // ------------------------------------------
        // POLLING
        // ------------------------------------------

        await bot.launch({

          dropPendingUpdates:
            false

        });


        console.log(
          "✅ Telegram bot POLLING orqali ishlayapti"
        );

      }


    } catch (error) {

      console.error(
        "❌ BOT ISHGA TUSHISH XATOSI:",
        error
      );

    }

  } else {

    console.error(
      "❌ BOT_TOKEN yo'q. Telegram bot ishga tushmaydi."
    );

  }


  // ----------------------------------------------
  // EXPRESS SERVER
  // ----------------------------------------------

  app.listen(
    PORT,
    "0.0.0.0",
    () => {

      console.log("");
      console.log(
        "================================"
      );

      console.log(
        `🌐 SERVER ${PORT}-PORTDA ISHLAYAPTI`
      );

      console.log(
        "================================"
      );

    }
  );

}


// ======================================================
// START
// ======================================================

startServer()
  .catch(
    (error) => {

      console.error(
        "❌ SERVER XATOSI:",
        error
      );

      process.exit(1);

    }
  );


// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

process.once(
  "SIGINT",
  () => {

    if (bot) {

      bot.stop(
        "SIGINT"
      );

    }

    if (pool) {

      pool.end()
        .catch(() => {});

    }

  }
);


process.once(
  "SIGTERM",
  () => {

    if (bot) {

      bot.stop(
        "SIGTERM"
      );

    }

    if (pool) {

      pool.end()
        .catch(() => {});

    }

  }
);