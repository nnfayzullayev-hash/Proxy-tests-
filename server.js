import "dotenv/config";
import express from "express";
import { Telegraf, Markup } from "telegraf";
import pg from "pg";

const { Pool } = pg;

const app = express();

app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

const BOT_TOKEN =
  process.env.BOT_TOKEN?.trim();

const ADMIN_ID =
  process.env.ADMIN_ID?.trim();

const DATABASE_URL =
  process.env.DATABASE_URL?.trim();

const WEBHOOK_URL =
  process.env.WEBHOOK_URL?.trim() ||
  "https://proxy-tests.onrender.com";

const PAYMENT_CARD =
  process.env.PAYMENT_CARD?.trim() ||
  "Karta sozlanmagan";

const WEBHOOK_PATH =
  "/telegram/webhook";

let bot = null;
let pool = null;

// ==========================================
// LOG
// ==========================================

console.log("================================");
console.log("🚀 PROXY TESTS BOT");
console.log("================================");

console.log(
  BOT_TOKEN
    ? "✅ BOT_TOKEN topildi"
    : "❌ BOT_TOKEN yo'q"
);

console.log(
  DATABASE_URL
    ? "✅ DATABASE_URL topildi"
    : "❌ DATABASE_URL yo'q"
);

console.log(
  ADMIN_ID
    ? "✅ ADMIN_ID topildi"
    : "⚠️ ADMIN_ID yo'q"
);

console.log(
  "🌐 WEBHOOK:",
  WEBHOOK_URL
);

// ==========================================
// EXPRESS
// ==========================================

app.get("/", (req, res) => {
  res.send(
    "✅ Proxy Tests Bot server ishlayapti!"
  );
});

app.get("/health", (req, res) => {
  res.json({
    server: "online",
    bot: BOT_TOKEN
      ? "configured"
      : "missing",
    database: DATABASE_URL
      ? "configured"
      : "missing",
    miniapp: WEBHOOK_URL
  });
});

// ==========================================
// DATABASE
// ==========================================

async function initDatabase() {

  if (!DATABASE_URL) {
    throw new Error(
      "DATABASE_URL mavjud emas"
    );
  }

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

  console.log(
    "⏳ Database ulanmoqda..."
  );

  await pool.query(
    "SELECT NOW()"
  );

  console.log(
    "✅ Database ulandi"
  );

  // ========================================
  // USERS
  // ========================================

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
    CREATE UNIQUE INDEX IF NOT EXISTS
    users_telegram_id_unique
    ON users (telegram_id)
  `);

  console.log(
    "✅ Users jadvali tayyor"
  );

  // ========================================
  // TESTS
  // ========================================

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

  // ========================================
  // NEWS
  // ========================================

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

  // ========================================
  // TICKETS
  // ========================================

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

  console.log(
    "================================"
  );

  console.log(
    "✅ DATABASE TAYYOR"
  );

  console.log(
    "================================"
  );
}

// ==========================================
// USER SAQLASH
// ==========================================

async function saveUser(
  telegramId,
  fullName,
  username
) {

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
      full_name =
        EXCLUDED.full_name,

      username =
        EXCLUDED.username
    `,
    [
      telegramId,
      fullName,
      username || null
    ]
  );
}

// ==========================================
// BOTNI YARATISH
// ==========================================

function createBot() {

  if (!BOT_TOKEN) {
    throw new Error(
      "BOT_TOKEN mavjud emas"
    );
  }

  bot = new Telegraf(
    BOT_TOKEN
  );

  console.log(
    "🤖 Telegram bot yaratildi"
  );
}

// ==========================================
// WEBHOOK
// ==========================================

app.post(
  WEBHOOK_PATH,
  async (req, res) => {

    try {

      await bot.handleUpdate(
        req.body
      );

      res.sendStatus(200);

    } catch (error) {

      console.error(
        "❌ WEBHOOK XATOSI:",
        error.message
      );

      res.sendStatus(500);
    }
  }
);

// ==========================================
// START SERVER
// ==========================================

async function start() {

  try {

    await initDatabase();

    createBot();

    app.listen(
      PORT,
      "0.0.0.0",
      async () => {

        console.log(
          `🚀 Server ${PORT} portda ishlayapti`
        );

        console.log(
          `🌐 Mini App: ${WEBHOOK_URL}`
        );

        try {

          await bot.telegram.setWebhook(
            `${WEBHOOK_URL}${WEBHOOK_PATH}`
          );

          console.log(
            "✅ Telegram webhook o'rnatildi"
          );

        } catch (error) {

          console.error(
            "❌ Webhook xatosi:",
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

function createBot() {

  if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN mavjud emas");
  }

  bot = new Telegraf(BOT_TOKEN);

// ==========================================
// /START
// ==========================================

bot.start(async (ctx) => {

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
          "👤 Profil"
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


// ==========================================
// YANGILIKLAR
// ==========================================

bot.hears(
  "📰 Yangiliklar",
  async (ctx) => {

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
          `📌 ${news.title || "Yangilik"}\n`;

        text +=
          `${news.content || ""}\n`;

        if (news.test_date) {

          text +=
            `📅 ${news.test_date}\n`;
        }

        text += "\n";
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


// ==========================================
// TESTLAR
// ==========================================

bot.hears(
  "📝 Testlar",
  async (ctx) => {

    try {

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
          `🔹 ${test.name}\n`;

        if (test.start_time) {

          text +=
            `⏰ ${test.start_time}\n`;
        }

        text += "\n";
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


// ==========================================
// PROFIL
// ==========================================

bot.hears(
  "👤 Profil",
  async (ctx) => {

    try {

      const result =
        await pool.query(
          `
          SELECT
            telegram_id,
            full_name,
            username,
            created_at
          FROM users
          WHERE telegram_id = $1
          LIMIT 1
          `,
          [ctx.from.id]
        );

      if (
        result.rows.length === 0
      ) {

        await ctx.reply(
          "❌ Profil topilmadi."
        );

        return;
      }

      const user =
        result.rows[0];

      await ctx.reply(
        `👤 PROFIL

🆔 Telegram ID:
${user.telegram_id}

👨‍💻 F.I.SH:
${user.full_name || "—"}

🔹 Username:
${
  user.username
    ? "@" + user.username
    : "Mavjud emas"
}

📅 Ro'yxatdan o'tgan:
${user.created_at}`
      );

    } catch (error) {

      console.error(
        "❌ PROFIL XATOSI:",
        error.message
      );

      await ctx.reply(
        "❌ Profilni olishda xatolik."
      );
    }
  }
);


// ==========================================
// NOMA'LUM XABAR
// ==========================================

bot.on(
  "text",
  async (ctx) => {

    const text =
      ctx.message.text;

    if (
      text === "📰 Yangiliklar" ||
      text === "🎫 Chipta" ||
      text === "📝 Testlar" ||
      text === "👤 Profil"
    ) {
      return;
    }

    await ctx.reply(
      "👇 Menyudan kerakli bo'limni tanlang."
    );
  }
);


console.log(
  "🤖 Bot komandalar va menyu tayyor"
);
// ==========================================
// 🎫 CHIPTA
// ==========================================

bot.hears(
  "🎫 Chipta",
  async (ctx) => {

    try {

      const result = await pool.query(`
        SELECT
          id,
          name
        FROM tests
        ORDER BY id ASC
      `);

      if (result.rows.length === 0) {

        await ctx.reply(
          "🎫 Hozircha testlar mavjud emas."
        );

        return;
      }

      const buttons =
        result.rows.map((test) => [

          Markup.button.callback(
            `📝 ${test.name}`,
            `ticket:${test.id}`
          )

        ]);

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


// ==========================================
// TESTNI TANLASH
// ==========================================

bot.action(
  /^ticket:(\d+)$/,
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
          "❌ Test topilmadi."
        );

        return;
      }

      const test =
        result.rows[0];

      // Oldingi pending buyurtmani tekshirish
      const pending =
        await pool.query(
          `
          SELECT id
          FROM tickets
          WHERE telegram_id = $1
          AND test_id = $2
          AND payment_status = 'pending'
          AND receipt_file_id IS NULL
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
          "Sizda kutayotgan buyurtma bor."
        );

        await ctx.reply(
          `⏳ Siz "${test.name}" uchun
allaqachon buyurtma yaratgansiz.

💳 To'lovni amalga oshiring va
chek rasmini yuboring.`
        );

        return;
      }

      // Yangi ticket
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
        `🎫 CHIPTA BUYURTMASI

📝 Test:
${test.name}

🆔 Buyurtma ID:
${ticketId}

💳 To'lov uchun karta:

${PAYMENT_CARD}

💰 To'lovni amalga oshirgandan
so'ng, chek rasmini shu chatga yuboring.

⚠️ Chek aniq va to'liq ko'rinsin.

⏳ Chek yuborilgach admin tekshiradi.`
      );

    } catch (error) {

      console.error(
        "❌ TEST TANLASH XATOSI:",
        error.message
      );

      await ctx.answerCbQuery(
        "❌ Xatolik yuz berdi."
      );
    }
  }
);


// ==========================================
// 📸 CHEK QABUL QILISH
// ==========================================

bot.on(
  "photo",
  async (ctx) => {

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

      if (
        result.rows.length === 0
      ) {

        await ctx.reply(
          `❗ Sizda chek kutayotgan
chipta buyurtmasi yo'q.`
        );

        return;
      }

      const ticket =
        result.rows[0];

      const photos =
        ctx.message.photo;

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
        `✅ CHEK QABUL QILINDI

🆔 Buyurtma:
${ticket.id}

📝 Test:
${ticket.test_name}

⏳ Admin chekni tekshiradi.

Tasdiqlangandan keyin
6 xonali chipta beriladi.`
      );


      // ======================================
      // ADMINGA YUBORISH
      // ======================================

      if (ADMIN_ID) {

        await bot.telegram.sendPhoto(
          ADMIN_ID,

          fileId,

          {
            caption:
              `💳 YANGI TO'LOV

🆔 Buyurtma ID:
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
).trim()}

👇 Chekni tekshiring.`,

            reply_markup: {

              inline_keyboard: [

                [
                  {
                    text:
                      "✅ TASDIQLASH",

                    callback_data:
                      `approve:${ticket.id}`
                  }
                ],

                [
                  {
                    text:
                      "❌ RAD ETISH",

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
        "❌ CHEK XATOSI:",
        error.message
      );

      await ctx.reply(
        "❌ Chekni qabul qilishda xatolik."
      );
    }
  }
);


// ==========================================
// ✅ ADMIN TASDIQLASH
// ==========================================

bot.action(
  /^approve:(\d+)$/,
  async (ctx) => {

    try {

      // Adminni tekshirish
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

      if (
        result.rows.length === 0
      ) {

        await ctx.answerCbQuery(
          "❌ Buyurtma topilmadi."
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
          "Bu buyurtma allaqachon tasdiqlangan."
        );

        return;
      }

      if (
        ticket.payment_status ===
        "rejected"
      ) {

        await ctx.answerCbQuery(
          "Bu buyurtma rad etilgan."
        );

        return;
      }


      // ====================================
      // 6 XONALI CHIPTA
      // ====================================

      let ticketNumber;

      while (true) {

        ticketNumber =
          Math.floor(
            100000 +
            Math.random() * 900000
          ).toString();

        const check =
          await pool.query(
            `
            SELECT id
            FROM tickets
            WHERE ticket_number = $1
            LIMIT 1
            `,
            [ticketNumber]
          );

        if (
          check.rows.length === 0
        ) {

          break;
        }
      }


      // ====================================
      // 24 SOATLIK MUDDAT
      // ====================================

      const expiresAt =
        new Date(
          Date.now() +
          24 * 60 * 60 * 1000
        );


      // ====================================
      // DATABASE UPDATE
      // ====================================

      await pool.query(
        `
        UPDATE tickets

        SET
          ticket_number = $1,

          payment_status =
            'approved',

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


      // ====================================
      // FOYDALANUVCHIGA CHIPTA
      // ====================================

      await bot.telegram.sendMessage(
        ticket.telegram_id,

        `🎉 TO'LOV TASDIQLANDI!

🎫 SIZNING CHİPTANGIZ:

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


      // Admin xabarini o'zgartirish
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

      } catch {
        // Xabar o'zgarmasa ham bot ishlashda davom etadi
      }

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


// ==========================================
// ❌ ADMIN RAD ETISH
// ==========================================

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
          "❌ Siz admin emassiz."
        );

        return;
      }

      const ticketId =
        Number(ctx.match[1]);

      const result =
        await pool.query(
          `
          SELECT
            telegram_id,
            test_name
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
          "❌ Buyurtma topilmadi."
        );

        return;
      }

      const ticket =
        result.rows[0];

      await pool.query(
        `
        UPDATE tickets
        SET payment_status = 'rejected'
        WHERE id = $1
        `,
        [ticketId]
      );


      // Foydalanuvchiga xabar
      await bot.telegram.sendMessage(
        ticket.telegram_id,

        `❌ TO'LOV RAD ETILDI

📝 Test:
${ticket.test_name}

⚠️ Chekni qayta tekshiring
va kerak bo'lsa yangi to'lov
chekini yuboring.`
      );


      await ctx.answerCbQuery(
        "❌ Buyurtma rad etildi."
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
        "❌ RAD ETISH XATOSI:",
        error.message
      );

      await ctx.answerCbQuery(
        "❌ Xatolik yuz berdi."
      );
    }
  }
);
bot.action(
  /^reject:(\d+)$/,
  async (ctx) => {

    // ...

  }
);

}
// ==========================================
// MINI APP API
// ==========================================

// Testlar
app.get("/api/tests", async (req, res) => {

  try {

    const result = await pool.query(`
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
      "❌ API TESTS XATOSI:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Testlarni olishda xatolik"
    });
  }
});


// ==========================================
// MINI APP — YANGILIKLAR
// ==========================================

app.get("/api/news", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        id,
        title,
        content,
        test_date,
        created_at
      FROM news
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      news: result.rows
    });

  } catch (error) {

    console.error(
      "❌ API NEWS XATOSI:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Yangiliklarni olishda xatolik"
    });
  }
});


// ==========================================
// MINI APP — USER PROFIL
// ==========================================

app.get("/api/user/:telegramId", async (req, res) => {

  try {

    const telegramId =
      req.params.telegramId;

    const result =
      await pool.query(
        `
        SELECT
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

      return res.status(404).json({
        success: false,
        message: "Foydalanuvchi topilmadi"
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {

    console.error(
      "❌ API USER XATOSI:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Profilni olishda xatolik"
    });
  }
});


// ==========================================
// MINI APP — TICKETLAR
// ==========================================

app.get(
  "/api/tickets/:telegramId",
  async (req, res) => {

    try {

      const telegramId =
        req.params.telegramId;

      const result =
        await pool.query(
          `
          SELECT
            id,
            ticket_number,
            test_name,
            payment_status,
            expires_at,
            created_at
          FROM tickets
          WHERE telegram_id = $1
          ORDER BY created_at DESC
          LIMIT 20
          `,
          [telegramId]
        );

      res.json({
        success: true,
        tickets: result.rows
      });

    } catch (error) {

      console.error(
        "❌ API TICKETS XATOSI:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Chiptalarni olishda xatolik"
      });
    }
  }
);


// ==========================================
// MINI APP — TEST TEKSHIRISH
// ==========================================

app.get(
  "/api/ticket/:ticketNumber",
  async (req, res) => {

    try {

      const ticketNumber =
        req.params.ticketNumber;

      const result =
        await pool.query(
          `
          SELECT
            ticket_number,
            full_name,
            test_name,
            payment_status,
            expires_at,
            created_at
          FROM tickets
          WHERE ticket_number = $1
          LIMIT 1
          `,
          [ticketNumber]
        );

      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message: "Chipta topilmadi"
        });
      }

      const ticket =
        result.rows[0];

      let valid = false;

      if (
        ticket.payment_status ===
        "approved"
      ) {

        if (
          !ticket.expires_at ||
          new Date(ticket.expires_at) >
          new Date()
        ) {

          valid = true;
        }
      }

      res.json({
        success: true,
        valid,
        ticket
      });

    } catch (error) {

      console.error(
        "❌ API TICKET XATOSI:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Chiptani tekshirishda xatolik"
      });
    }
  }
);


// ==========================================
// BOTNI YARATISH
// ==========================================

createBot();


// ==========================================
// SERVERNI ISHGA TUSHIRISH
// ==========================================

async function startServer() {

  try {

    // Database
    await initDatabase();

    // Server
    app.listen(
      PORT,
      "0.0.0.0",
      async () => {

        console.log(
          "================================"
        );

        console.log(
          `🚀 SERVER ${PORT} PORTDA ISHLAYAPTI`
        );

        console.log(
          `🌐 SITE: ${WEBHOOK_URL}`
        );

        console.log(
          `📱 MINI APP: ${WEBHOOK_URL}`
        );

        console.log(
          "================================"
        );


        // ==================================
        // TELEGRAM WEBHOOK
        // ==================================

        try {

          await bot.telegram.setWebhook(
            `${WEBHOOK_URL}${WEBHOOK_PATH}`
          );

          console.log(
            "✅ TELEGRAM WEBHOOK O'RNATILDI"
          );

          console.log(
            `${WEBHOOK_URL}${WEBHOOK_PATH}`
          );

        } catch (error) {

          console.error(
            "❌ WEBHOOK XATOSI:",
            error.message
          );
        }


        // ==================================
        // TELEGRAM MINI APP MENU BUTTON
        // ==================================

        try {

          await bot.telegram.setChatMenuButton({
            menu_button: {

              type: "web_app",

              text: "Mini App",

              web_app: {
                url: WEBHOOK_URL
              }

            }
          });

          console.log(
            "✅ TELEGRAM MINI APP TUGMASI O'RNATILDI"
          );

        } catch (error) {

          console.error(
            "❌ MINI APP TUGMASI XATOSI:",
            error.message
          );
        }

      }
    );

  } catch (error) {

    console.error(
      "❌ SERVER ISHGA TUSHISHIDA XATO:",
      error.message
    );

    process.exit(1);
  }
}


// ==========================================
// START
// ==========================================

startServer();