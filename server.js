import "dotenv/config";
import express from "express";
import { Telegraf, Markup } from "telegraf";
import pg from "pg";

const { Pool } = pg;

// ======================================================
// SOZLAMALAR
// ======================================================

const PORT = Number(process.env.PORT) || 10000;

const BOT_TOKEN =
  process.env.BOT_TOKEN?.trim();

const ADMIN_ID =
  process.env.ADMIN_ID?.trim();

const DATABASE_URL =
  process.env.DATABASE_URL?.trim();

const WEBHOOK_URL =
  (
    process.env.WEBHOOK_URL ||
    "https://proxy-tests.onrender.com"
  ).trim();

const WEBHOOK_PATH =
  "/telegram/webhook";

const PAYMENT_CARD =
  (
    process.env.PAYMENT_CARD ||
    "Karta raqami sozlanmagan"
  ).trim();


// ======================================================
// EXPRESS
// ======================================================

const app = express();

app.use(express.json());


// ======================================================
// ASOSIY ROUTE
// ======================================================

app.get("/", (req, res) => {

  res.status(200).send(
    "✅ Proxy Tests Bot ishlayapti!"
  );

});


// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/health", (req, res) => {

  res.status(200).json({

    server: "online",

    telegram:
      BOT_TOKEN
        ? "configured"
        : "missing",

    database:
      DATABASE_URL
        ? "configured"
        : "missing",

    webhook:
      `${WEBHOOK_URL}${WEBHOOK_PATH}`

  });

});


// ======================================================
// DATABASE
// ======================================================

let pool = null;


// ======================================================
// DATABASE ULASH
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
    }

  });


  pool.on(
    "error",
    (error) => {

      console.error(
        "❌ PostgreSQL xatosi:",
        error.message
      );

    }
  );


  try {

    console.log(
      "⏳ Database ulanmoqda..."
    );


    await pool.query(
      "SELECT NOW()"
    );


    console.log(
      "✅ Database ulandi"
    );


    // ==================================================
    // USERS
    // ==================================================

    await pool.query(`

      CREATE TABLE IF NOT EXISTS users (

        id SERIAL PRIMARY KEY,

        telegram_id BIGINT UNIQUE,

        full_name TEXT,

        username TEXT,

        created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

      )

    `);


    console.log(
      "✅ Users jadvali tayyor"
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
      "✅ Tests jadvali tayyor"
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


    console.log(
      "✅ Tickets jadvali tayyor"
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


    console.log(
      "✅ News jadvali tayyor"
    );


    console.log(
      "========================================"
    );

    console.log(
      "✅ DATABASE TAYYOR"
    );

    console.log(
      "========================================"
    );


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
      username || null
    ]

  );


  console.log(
    `✅ User saqlandi: ${telegramId}`
  );

}


// ======================================================
// 6 XONALI CHIPTA YARATISH
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


    if (
      result.rows.length === 0
    ) {

      return number;

    }

  }

}


// ======================================================
// BOT
// ======================================================

let bot = null;


// ======================================================
// BOT YARATISH
// ======================================================

function createBot() {

  if (!BOT_TOKEN) {

    throw new Error(
      "BOT_TOKEN mavjud emas"
    );

  }


  const telegramBot =
    new Telegraf(BOT_TOKEN);


  // ====================================================
  // START
  // ====================================================

  telegramBot.start(
    async (ctx) => {

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
          `${firstName} ${lastName}`
          .trim();


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
          const news of result.rows
        ) {

          text +=

            `📌 ${
              news.title ||
              "Yangilik"
            }\n` +

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
          "❌ YANGILIKLAR:",
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


        if (
          result.rows.length === 0
        ) {

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
          "❌ Chipta bo'limida xatolik."
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


        const inserted =
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

              test.id

            ]

          );


        const ticketId =
          inserted.rows[0].id;


        await ctx.answerCbQuery();


        await ctx.reply(

          `🎫 CHIPTA OLISH

📝 Test:
${test.name}

💳 To'lov uchun karta:

${PAYMENT_CARD}

💰 To'lovni amalga oshiring.

Keyin to'lov chekini shu chatga
rasm ko'rinishida yuboring.

🆔 Buyurtma ID:
${ticketId}`

        );


      } catch (error) {

        console.error(
          "❌ TEST TANLASH:",
          error.message
        );

        await ctx.answerCbQuery(
          "Xatolik yuz berdi."
        );

      }

    }
  );


  // ====================================================
  // BOT ERROR
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
  // ====================================================
  // CHEK QABUL QILISH
  // ====================================================

  telegramBot.on(
    "photo",
    async (ctx, next) => {

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

        const ticket = result.rows[0];

        const photos = ctx.message.photo;

        const photo =
          photos[photos.length - 1];

        await pool.query(
          `
          UPDATE tickets
          SET receipt_file_id = $1
          WHERE id = $2
          `,
          [
            photo.file_id,
            ticket.id
          ]
        );

        await ctx.reply(
          `✅ Chek qabul qilindi!

📝 Test:
${ticket.test_name}

⏳ Admin tekshiruvini kuting.

Tasdiqlangandan keyin sizga 6 xonali chipta yuboriladi.`
        );

        // ADMIN
        if (ADMIN_ID) {

          await telegramBot.telegram.sendPhoto(
            ADMIN_ID,
            photo.file_id,
            {
              caption:
                `💳 YANGI TO'LOV

🆔 Buyurtma ID:
${ticket.id}

📝 Test:
${ticket.test_name}

👤 Telegram ID:
${ctx.from.id}

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
  // ADMIN — TASDIQLASH
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
            "❌ Siz admin emassiz."
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


        // FOYDALANUVCHIGA
        await telegramBot.telegram.sendMessage(

          ticket.telegram_id,

          `🎉 TO'LOV TASDIQLANDI!

🎫 Sizning chiptangiz:

🔢 ${ticketNumber}

📝 Test:
${ticket.test_name}

⏰ Amal qilish muddati:
24 soat

📝 Endi "Testlar" bo'limiga
kirishingiz mumkin.`

        );


        await ctx.answerCbQuery(
          "✅ To'lov tasdiqlandi!"
        );


        try {

          await ctx.editMessageCaption(

            `✅ TO'LOV TASDIQLANDI

🆔 Buyurtma:
${ticketId}

📝 Test:
${ticket.test_name}

🎫 Chipta:
${ticketNumber}

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
          "❌ Tasdiqlashda xatolik."
        );

      }

    }
  );


  // ====================================================
  // ADMIN — RAD ETISH
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
            "❌ Siz admin emassiz."
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


        await telegramBot.telegram.sendMessage(

          ticket.telegram_id,

          `❌ TO'LOV RAD ETILDI.

📝 Test:
${ticket.test_name}

Chekni tekshirib, qaytadan chipta olishga urinib ko'ring.`

        );


        await ctx.answerCbQuery(
          "❌ To'lov rad etildi."
        );


        try {

          await ctx.editMessageCaption(

            `❌ TO'LOV RAD ETILDI

🆔 Buyurtma:
${ticketId}

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
          "❌ Rad etishda xatolik."
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

Testga kirish uchun 6 xonali
chipta raqamingizni yuboring.

Masalan:

123456`

      );

    }
  );


  // ====================================================
  // CHIPTANI TEKSHIRISH
  // ====================================================

  telegramBot.on(
    "text",

    async (ctx, next) => {

      const text =
        ctx.message.text.trim();


      // MENYU SO'ZLARI
      if (

        text.startsWith("/") ||

        text === "🎫 Chipta" ||

        text === "📝 Testlar" ||

        text === "📰 Yangiliklar" ||

        text === "🏆 Liga"

      ) {

        return next();

      }


      // FAQAT 6 XONALI CHIPTA
      if (
        !/^\d{6}$/.test(text)
      ) {

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
              telegram_id,
              expires_at
            FROM tickets
            WHERE ticket_number = $1
              AND payment_status = 'approved'
            LIMIT 1
            `,

            [text]

          );


        if (
          result.rows.length === 0
        ) {

          await ctx.reply(
            "❌ Chipta topilmadi yoki hali tasdiqlanmagan."
          );

          return;

        }


        const ticket =
          result.rows[0];


        // CHIPTA EGASI
        if (
          String(ticket.telegram_id) !==
          String(ctx.from.id)
        ) {

          await ctx.reply(
            "❌ Bu chipta boshqa foydalanuvchiga tegishli."
          );

          return;

        }


        // MUDDAT
        if (

          ticket.expires_at &&

          new Date(ticket.expires_at)
            < new Date()

        ) {

          await ctx.reply(

            `❌ Chiptaning muddati tugagan.

🎫 ${ticket.ticket_number}`

          );

          return;

        }


        await ctx.reply(

          `✅ CHIPTA TASDIQLANDI!

🎫 Chipta:
${ticket.ticket_number}

📝 Test:
${ticket.test_name}

⏰ Amal qilish muddati:
24 soat

⚠️ Test tizimini keyingi bosqichda qo'shamiz.`

        );


      } catch (error) {

        console.error(
          "❌ CHIPTA TEKSHIRISH:",
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
            SELECT
              full_name
            FROM users
            WHERE full_name IS NOT NULL
            ORDER BY id ASC
            LIMIT 10
          `);


        if (
          result.rows.length === 0
        ) {

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
  // TELEGRAM ID
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
✅ Webhook rejimi
✅ Chipta tizimi faol`

      );

    }
  );


  // ====================================================
  // BOT ERROR
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
    "✅ WEBHOOK O'RNATILDI!"
  );

}


// ======================================================
// START SERVER
// ======================================================

async function startServer() {

  try {

    console.log(
      "========================================"
    );

    console.log(
      "🚀 SERVER ISHGA TUSHMOQDA..."
    );

    console.log(
      "========================================"
    );


    // DATABASE
    const databaseReady =
      await initDatabase();


    if (!databaseReady) {

      throw new Error(
        "Database ulanmagan"
      );

    }


    // BOT
    bot =
      createBot();


    console.log(
      "✅ Bot yaratildi"
    );


    // WEBHOOK ROUTE
    app.post(
      WEBHOOK_PATH,
      async (req, res) => {

        try {

          await bot.handleUpdate(
            req.body,
            res
          );

        } catch (error) {

          console.error(
            "❌ WEBHOOK XATOSI:",
            error.message
          );

          if (!res.headersSent) {
            res.sendStatus(500);
          }

        }

      }
    );


    // PORT
    app.listen(

      PORT,

      "0.0.0.0",

      async () => {

        console.log(
          "========================================"
        );

        console.log(
          `✅ Server running on ${PORT}`
        );

        console.log(
          "🌐 Host: 0.0.0.0"
        );

        console.log(
          "========================================"
        );


        try {

          const me =
            await bot.telegram.getMe();


          console.log(
            `🤖 Bot: @${me.username}`
          );


          await setupWebhook();


        } catch (error) {

          console.error(
            "❌ WEBHOOK O'RNATISH XATOSI:",
            error.message
          );

        }

      }

    );


  } catch (error) {

    console.error(
      "========================================"
    );

    console.error(
      "❌ SERVER XATOSI:"
    );

    console.error(
      error.message
    );

    console.error(
      "========================================"
    );

    process.exit(1);

  }

}


// ======================================================
// SHUTDOWN
// ======================================================

async function shutdown(
  signal
) {

  console.log(
    `🛑 ${signal} qabul qilindi`
  );


  try {

    if (bot) {

      await bot.telegram.deleteWebhook();

    }

  } catch {}


  try {

    if (pool) {

      await pool.end();

    }

  } catch {}


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