import "dotenv/config";
import express from "express";
import { Telegraf, Markup } from "telegraf";
import pg from "pg";

const { Pool } = pg;

// ===============================
// SOZLAMALAR
// ===============================

const PORT = process.env.PORT || 10000;

const BOT_TOKEN =
  process.env.BOT_TOKEN?.trim();

const ADMIN_ID =
  process.env.ADMIN_ID?.trim();

const DATABASE_URL =
  process.env.DATABASE_URL?.trim();

const PAYMENT_CARD =
  process.env.PAYMENT_CARD?.trim() ||
  "Karta raqami sozlanmagan";

// ===============================
// TEKSHIRUV
// ===============================

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

// ===============================
// EXPRESS
// ===============================

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send(
    "✅ Proxy Tests Bot ishlayapti!"
  );
});

app.get("/health", (req, res) => {
  res.json({
    server: "online",
    telegram: BOT_TOKEN
      ? "configured"
      : "missing",
    database: DATABASE_URL
      ? "configured"
      : "missing"
  });
});

// ===============================
// DATABASE
// ===============================

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

// ===============================
// BOT
// ===============================

if (!BOT_TOKEN) {
  console.error(
    "❌ BOT_TOKEN mavjud emas!"
  );

  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ===============================
// TEST HOLATI
// ===============================

const activeTests = new Map();

console.log(
  "✅ server.js yuklandi"
);
// ===============================
// DATABASE NI TAYYORLASH
// ===============================

async function initDatabase() {
  if (!pool) {
    console.log("⚠️ DATABASE_URL mavjud emas");
    return;
  }

  try {
    console.log("⏳ Database ulanmoqda...");

    await pool.query("SELECT NOW()");

    console.log("✅ PostgreSQL ulandi");

    // ============================
    // USERS
    // ============================

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

    // ============================
    // NEWS
    // ============================

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

    // ============================
    // TESTS
    // ============================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tests (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TIMESTAMP,
        created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ============================
    // TICKETS
    // ============================

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

    // ============================
    // QUESTIONS
    // ============================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,

        test_id INTEGER NOT NULL,

        question TEXT NOT NULL,

        option_a TEXT NOT NULL,

        option_b TEXT NOT NULL,

        option_c TEXT NOT NULL,

        option_d TEXT NOT NULL,

        correct_answer VARCHAR(1) NOT NULL,

        created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ============================
    // TEST NATIJALARI
    // ============================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_results (
        id SERIAL PRIMARY KEY,

        telegram_id BIGINT NOT NULL,

        ticket_id INTEGER,

        test_id INTEGER NOT NULL,

        score INTEGER
        DEFAULT 0,

        total_questions INTEGER
        DEFAULT 0,

        started_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

        finished_at TIMESTAMP
      )
    `);

    console.log("================================");
    console.log("✅ BARCHA JADVALLAR TAYYOR");
    console.log("================================");

  } catch (error) {

    console.error(
      "❌ DATABASE XATOSI:",
      error.message
    );
  }
}
// ===============================
// FOYDALANUVCHINI DATABASE'GA SAQLASH
// ===============================

async function saveUser(ctx) {

  if (!pool) {
    console.log("⚠️ Database ulanmagan");
    return;
  }

  const telegramId = ctx.from.id;

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
      `✅ User saqlandi: ${telegramId} | ${fullName}`
    );

  } catch (error) {

    console.error(
      "❌ USER SAQLASH XATOSI:",
      error.message
    );
  }
}


// ===============================
// /START
// ===============================

bot.start(async (ctx) => {

  try {

    console.log(
      `📩 /start: ${ctx.from.id}`
    );

    // Foydalanuvchini saqlash
    await saveUser(ctx);

    const name =
      ctx.from.first_name ||
      "foydalanuvchi";

    await ctx.reply(

      `Assalomu alaykum, ${name}! 👋

📝 *Proxy Tests* botiga xush kelibsiz!

Kerakli bo'limni tanlang:`,

      {
        parse_mode: "Markdown",

        ...Markup.keyboard([
          [
            "📰 Yangiliklar",
            "🎫 Chipta"
          ],
          [
            "📝 Testlar",
            "🏆 Liga"
          ]
        ]).resize()
      }
    );

  } catch (error) {

    console.error(
      "❌ START XATOSI:",
      error.message
    );

    await ctx.reply(
      "❌ Xatolik yuz berdi. Iltimos, qaytadan /start bosing."
    );
  }
});
// ===============================
// YANGILIKLARNI KO'RISH
// ===============================

bot.hears("📰 Yangiliklar", async (ctx) => {

  if (!pool) {
    await ctx.reply(
      "❌ Database ulanmagan."
    );
    return;
  }

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

    if (result.rows.length === 0) {

      await ctx.reply(
        `📰 YANGILIKLAR

Hozircha yangiliklar mavjud emas.`
      );

      return;
    }

    let text =
      "📰 YANGILIKLAR\n\n";

    for (const news of result.rows) {

      text +=
        `📌 ${news.title || "Yangilik"}\n\n`;

      text +=
        `${news.content || ""}\n\n`;

      if (news.test_date) {

        text +=
          `📅 Test sanasi: ${news.test_date}\n\n`;
      }

      text +=
        "━━━━━━━━━━━━━━\n\n";
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
});


// ===============================
// ADMIN — YANGILIK QO'SHISH
// ===============================

bot.command("addnews", async (ctx) => {

  // Admin tekshirish

  if (
    ADMIN_ID &&
    String(ctx.from.id) !==
    String(ADMIN_ID)
  ) {

    await ctx.reply(
      "❌ Siz admin emassiz."
    );

    return;
  }

  const text =
    ctx.message.text
      .replace("/addnews", "")
      .trim();

  /*
    FORMAT:

    /addnews Sarlavha | Matn | Sana
  */

  const parts =
    text
      .split("|")
      .map(x => x.trim());

  if (parts.length < 2) {

    await ctx.reply(
      `❌ Format noto'g'ri.

To'g'ri format:

/addnews Sarlavha | Yangilik matni | Sana

Masalan:

/addnews Yangi test | 10-sentabr kuni test bo'ladi | 10.09.2026`
    );

    return;
  }

  const title =
    parts[0];

  const content =
    parts[1];

  const testDate =
    parts[2] || null;

  try {

    await pool.query(
      `
      INSERT INTO news
      (
        title,
        content,
        test_date
      )
      VALUES
      ($1, $2, $3)
      `,
      [
        title,
        content,
        testDate
      ]
    );

    await ctx.reply(
      `✅ YANGILIK SAQLANDI!

📌 Sarlavha:
${title}

📝 Matn:
${content}

${
  testDate
    ? `📅 Sana: ${testDate}`
    : ""
}`
    );

  } catch (error) {

    console.error(
      "❌ YANGILIK SAQLASH XATOSI:",
      error.message
    );

    await ctx.reply(
      `❌ Yangilikni saqlashda xatolik.

Xato:
${error.message}`
    );
  }
});


// ===============================
// ADMIN — YANGILIKLARNI O'CHIRISH
// ===============================

bot.command("deletenews", async (ctx) => {

  if (
    ADMIN_ID &&
    String(ctx.from.id) !==
    String(ADMIN_ID)
  ) {

    await ctx.reply(
      "❌ Siz admin emassiz."
    );

    return;
  }

  const id =
    ctx.message.text
      .replace("/deletenews", "")
      .trim();

  if (!id) {

    await ctx.reply(
      "❌ Yangilik ID sini yozing.\n\nMasalan:\n/deletenews 5"
    );

    return;
  }

  try {

    const result =
      await pool.query(
        `
        DELETE FROM news
        WHERE id = $1
        RETURNING id, title
        `,
        [id]
      );

    if (result.rows.length === 0) {

      await ctx.reply(
        "❌ Bunday yangilik topilmadi."
      );

      return;
    }

    await ctx.reply(
      `🗑 Yangilik o'chirildi!

🆔 ID: ${result.rows[0].id}
📌 ${result.rows[0].title}`
    );

  } catch (error) {

    console.error(
      "❌ NEWS DELETE XATOSI:",
      error.message
    );

    await ctx.reply(
      "❌ Yangilikni o'chirishda xatolik."
    );
  }
});


// ===============================
// ADMIN — YANGILIKLAR RO'YXATI
// ===============================

bot.command("newslist", async (ctx) => {

  if (
    ADMIN_ID &&
    String(ctx.from.id) !==
    String(ADMIN_ID)
  ) {

    await ctx.reply(
      "❌ Siz admin emassiz."
    );

    return;
  }

  try {

    const result =
      await pool.query(`
        SELECT
          id,
          title,
          test_date
        FROM news
        ORDER BY created_at DESC
      `);

    if (result.rows.length === 0) {

      await ctx.reply(
        "📰 Yangiliklar mavjud emas."
      );

      return;
    }

    let text =
      "📰 YANGILIKLAR RO'YXATI\n\n";

    for (const news of result.rows) {

      text +=
        `🆔 ${news.id}\n`;

      text +=
        `📌 ${news.title}\n`;

      if (news.test_date) {

        text +=
          `📅 ${news.test_date}\n`;
      }

      text +=
        "\n";
    }

    await ctx.reply(text);

  } catch (error) {

    console.error(
      "❌ NEWS LIST XATOSI:",
      error.message
    );

    await ctx.reply(
      "❌ Yangiliklarni olishda xatolik."
    );
  }
});
// ===============================
// 🎫 CHIPTA — TESTLAR RO'YXATI
// ===============================

bot.hears("🎫 Chipta", async (ctx) => {

  if (!pool) {
    await ctx.reply("❌ Database ulanmagan.");
    return;
  }

  try {

    const result = await pool.query(`
      SELECT
        id,
        name,
        start_time
      FROM tests
      ORDER BY id ASC
    `);

    if (result.rows.length === 0) {

      await ctx.reply(
        `🎫 CHIPTA

Hozircha testlar mavjud emas.`
      );

      return;
    }

    const buttons = result.rows.map((test) => {

      return [
        Markup.button.callback(
          `📝 ${test.name}`,
          `ticket_test:${test.id}`
        )
      ];

    });

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
});


// ===============================
// 🎫 TEST TANLASH
// ===============================

bot.action(
  /^ticket_test:(\d+)$/,
  async (ctx) => {

    if (!pool) {
      await ctx.answerCbQuery(
        "Database ulanmagan."
      );
      return;
    }

    try {

      const testId =
        Number(ctx.match[1]);

      const result = await pool.query(
        `
        SELECT
          id,
          name,
          start_time
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

      await ctx.answerCbQuery();

      // Eski pending ticketni tekshirish

      const pending =
        await pool.query(
          `
          SELECT
            id
          FROM tickets
          WHERE telegram_id = $1
          AND test_id = $2
          AND payment_status = 'pending'
          AND receipt_file_id IS NULL
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [
            ctx.from.id,
            testId
          ]
        );

      if (pending.rows.length > 0) {

        await ctx.reply(
          `⏳ Siz "${test.name}" uchun chipta buyurtmasini allaqachon boshlagansiz.

🆔 Buyurtma ID:
${pending.rows[0].id}

💳 To'lovni amalga oshirib, chek rasmini yuboring.`
        );

        return;
      }

      // Ticket yaratish

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

      await ctx.reply(
        `🎫 CHIPTA BUYURTMASI

📝 Test:
${test.name}

🆔 Buyurtma ID:
${ticketId}

💳 To'lov uchun karta:

${PAYMENT_CARD}

💰 To'lovni amalga oshiring.

📸 Keyin to'lov chekini
shu chatga RASM ko'rinishida yuboring.

⚠️ Chek aniq va o'qiladigan bo'lsin.`
      );

    } catch (error) {

      console.error(
        "❌ TEST TANLASH XATOSI:",
        error.message
      );

      await ctx.answerCbQuery(
        "Xatolik yuz berdi."
      );

      await ctx.reply(
        "❌ Chipta buyurtmasini yaratishda xatolik."
      );
    }
  }
);


// ===============================
// 📸 CHEK QABUL QILISH
// ===============================

bot.on("photo", async (ctx) => {

  if (!pool) {
    await ctx.reply(
      "❌ Database ulanmagan."
    );
    return;
  }

  try {

    const result =
      await pool.query(
        `
        SELECT
          id,
          telegram_id,
          full_name,
          test_name,
          test_id
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

      await ctx.reply(
        `❌ Sizda chek kutayotgan chipta buyurtmasi yo'q.

Avval 🎫 Chipta bo'limidan test tanlang.`
      );

      return;
    }

    const ticket =
      result.rows[0];

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
      `✅ CHEK QABUL QILINDI!

📝 Test:
${ticket.test_name}

🆔 Buyurtma:
${ticket.id}

⏳ Admin to'lovni tekshiradi.

Tasdiqlangandan so'ng
6 xonali chipta raqami yuboriladi.`
    );


    // =========================
    // ADMINGA YUBORISH
    // =========================

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

👤 F.I.SH:
${ticket.full_name || "Noma'lum"}

👤 Telegram ID:
${ticket.telegram_id}

👇 To'lovni tekshiring.`,

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
});


// ===============================
// 🔢 6 XONALI CHIPTA GENERATORI
// ===============================

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

    if (result.rows.length === 0) {

      return number;
    }
  }
}


// ===============================
// ✅ ADMIN — TASDIQLASH
// ===============================

bot.action(
  /^approve_ticket:(\d+)$/,
  async (ctx) => {

    if (!pool) {

      await ctx.answerCbQuery(
        "Database ulanmagan."
      );

      return;
    }

    // Admin tekshirish

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

    try {

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
          "Bu to'lov allaqachon tasdiqlangan."
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

      if (
        !ticket.receipt_file_id
      ) {

        await ctx.answerCbQuery(
          "Chek mavjud emas."
        );

        return;
      }

      // =========================
      // CHIPTA RAQAMI
      // =========================

      const ticketNumber =
        await generateTicketNumber();

      // 24 soat

      const expiresAt =
        new Date(
          Date.now() +
          24 * 60 * 60 * 1000
        );

      // =========================
      // DATABASE UPDATE
      // =========================

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

      // =========================
      // FOYDALANUVCHIGA CHIPTA
      // =========================

      await bot.telegram.sendMessage(
        ticket.telegram_id,

`🎉 TO'LOV TASDIQLANDI!

🎫 SIZNING CHIPTANGIZ:

🔢 ${ticketNumber}

📝 Test:
${ticket.test_name}

⏰ Amal qilish muddati:
24 soat

📅 Tugash vaqti:
${expiresAt.toLocaleString("uz-UZ")}

📝 Testlar bo'limiga kirib,
chipta raqamingizni kiriting.

Omad! 🍀`
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


// ===============================
// ❌ ADMIN — RAD ETISH
// ===============================

bot.action(
  /^reject_ticket:(\d+)$/,
  async (ctx) => {

    if (!pool) {

      await ctx.answerCbQuery(
        "Database ulanmagan."
      );

      return;
    }

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

    try {

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
          "Buyurtma topilmadi."
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

`❌ TO'LOV RAD ETILDI

🆔 Buyurtma:
${ticketId}

📝 Test:
${ticket.test_name}

Iltimos, to'lov ma'lumotlarini tekshirib,
qaytadan chipta olishga urinib ko'ring.`
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
// ===============================
// 📝 TESTLAR BO'LIMI
// ===============================

const testSessions = new Map();


// ===============================
// 📝 TESTLAR TUGMASI
// ===============================

bot.hears("📝 Testlar", async (ctx) => {

  await ctx.reply(
`📝 TESTLAR

🎫 Testni boshlash uchun sizga berilgan
6 xonali chipta raqamini yuboring.

Masalan:

123456`
  );

});


// ===============================
// 🔢 CHIPTA RAQAMINI QABUL QILISH
// ===============================

bot.on("text", async (ctx, next) => {

  const text =
    ctx.message.text.trim();

  // Menyu tugmalari bo'lsa o'tkazib yuboramiz

  if (
    text === "📰 Yangiliklar" ||
    text === "🎫 Chipta" ||
    text === "📝 Testlar" ||
    text === "🏆 Liga"
  ) {

    return next();
  }

  // Faqat 6 xonali raqamni tekshiramiz

  if (!/^\d{6}$/.test(text)) {

    return next();
  }

  if (!pool) {

    await ctx.reply(
      "❌ Database ulanmagan."
    );

    return;
  }

  try {

    // =========================
    // CHIPTANI TOPISH
    // =========================

    const result =
      await pool.query(
        `
        SELECT
          *
        FROM tickets
        WHERE ticket_number = $1
        AND telegram_id = $2
        AND payment_status = 'approved'
        LIMIT 1
        `,
        [
          text,
          ctx.from.id
        ]
      );

    if (result.rows.length === 0) {

      await ctx.reply(
`❌ CHIPTA TOPILMADI.

Tekshiring:

• Chipta raqami to'g'rimi?
• Ushbu chipta sizga tegishlimi?
• To'lov tasdiqlanganmi?`
      );

      return;
    }

    const ticket =
      result.rows[0];

    // =========================
    // MUDDATNI TEKSHIRISH
    // =========================

    if (
      ticket.expires_at &&
      new Date(ticket.expires_at) <
      new Date()
    ) {

      await ctx.reply(
`⛔ CHIPTA MUDDATI TUGAGAN.

🎫 Chipta:
${ticket.ticket_number}

📝 Test:
${ticket.test_name}

Yangi chipta olishingiz kerak.`
      );

      return;
    }


    // =========================
    // SAVOLLARNI OLISH
    // =========================

    const questions =
      await pool.query(
        `
        SELECT
          id,
          question,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer
        FROM questions
        WHERE test_id = $1
        ORDER BY id ASC
        `,
        [ticket.test_id]
      );

    if (questions.rows.length === 0) {

      await ctx.reply(
`❌ Ushbu test uchun savollar hali qo'shilmagan.

📝 Test:
${ticket.test_name}`
      );

      return;
    }


    // =========================
    // TEST SESSION
    // =========================

    testSessions.set(
      ctx.from.id,
      {
        ticketId: ticket.id,

        testId: ticket.test_id,

        testName: ticket.test_name,

        questions:
          questions.rows,

        currentQuestion: 0,

        score: 0,

        answers: [],

        startedAt: new Date()
      }
    );


    await ctx.reply(
`✅ CHIPTA TASDIQLANDI!

🎫 ${ticket.ticket_number}

📝 Test:
${ticket.test_name}

📊 Savollar:
${questions.rows.length} ta

⏳ Test boshlanmoqda...`
    );


    // Birinchi savol

    await sendQuestion(ctx);

  } catch (error) {

    console.error(
      "❌ CHIPTA TEKSHIRISH XATOSI:",
      error.message
    );

    await ctx.reply(
      "❌ Testni boshlashda xatolik."
    );
  }

});


// ===============================
// ❓ SAVOL YUBORISH
// ===============================

async function sendQuestion(ctx) {

  const session =
    testSessions.get(ctx.from.id);

  if (!session) {
    return;
  }

  const index =
    session.currentQuestion;

  const questions =
    session.questions;

  // =========================
  // TEST TUGAGAN
  // =========================

  if (
    index >= questions.length
  ) {

    await finishTest(ctx);

    return;
  }

  const question =
    questions[index];


  // =========================
  // SAVOL MATNI
  // =========================

  const questionText =

`📝 SAVOL ${index + 1}/${questions.length}

${question.question}

A) ${question.option_a}

B) ${question.option_b}

C) ${question.option_c}

D) ${question.option_d}`;


  // =========================
  // JAVOB TUGMALARI
  // =========================

  await ctx.reply(

    questionText,

    Markup.inlineKeyboard([

      [
        Markup.button.callback(
          "🅰️ A",
          `answer:A`
        ),

        Markup.button.callback(
          "🅱️ B",
          `answer:B`
        )
      ],

      [
        Markup.button.callback(
          "©️ C",
          `answer:C`
        ),

        Markup.button.callback(
          "🅳 D",
          `answer:D`
        )
      ]

    ])

  );

}


// ===============================
// 🅰️🅱️🅲️🅳 JAVOBNI QABUL QILISH
// ===============================

bot.action(
  /^answer:(A|B|C|D)$/,
  async (ctx) => {

    try {

      const userId =
        ctx.from.id;

      const session =
        testSessions.get(userId);

      if (!session) {

        await ctx.answerCbQuery(
          "❌ Faol test mavjud emas."
        );

        return;
      }

      const index =
        session.currentQuestion;

      const question =
        session.questions[index];

      if (!question) {

        await ctx.answerCbQuery();
        return;
      }

      const answer =
        ctx.match[1];

      // =========================
      // JAVOBNI SAQLASH
      // =========================

      const correct =
        answer ===
        question.correct_answer
          .toUpperCase();


      if (correct) {

        session.score++;

      }


      session.answers.push({

        questionId:
          question.id,

        answer,

        correct

      });


      await ctx.answerCbQuery(

        correct
          ? "✅ To'g'ri!"
          : "❌ Noto'g'ri!"

      );


      // =========================
      // KEYINGI SAVOL
      // =========================

      session.currentQuestion++;

      await sendQuestion(ctx);

    } catch (error) {

      console.error(
        "❌ JAVOB XATOSI:",
        error.message
      );

      await ctx.answerCbQuery(
        "❌ Xatolik."
      );
    }

  }
);


// ===============================
// 🏁 TESTNI YAKUNLASH
// ===============================

async function finishTest(ctx) {

  const userId =
    ctx.from.id;

  const session =
    testSessions.get(userId);

  if (!session) {
    return;
  }

  try {

    const total =
      session.questions.length;

    const score =
      session.score;

    const percentage =
      Math.round(
        (score / total) * 100
      );


    // =========================
    // DATABASE
    // =========================

    if (pool) {

      await pool.query(
        `
        INSERT INTO test_results
        (
          telegram_id,
          ticket_id,
          test_id,
          score,
          total_questions,
          started_at,
          finished_at
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          CURRENT_TIMESTAMP
        )
        `,
        [
          userId,

          session.ticketId,

          session.testId,

          score,

          total,

          session.startedAt
        ]
      );

    }


    // =========================
    // NATIJA
    // =========================

    await ctx.reply(

`🏁 TEST YAKUNLANDI!

📝 Test:
${session.testName}

📊 Natija:

✅ To'g'ri:
${score}

❌ Noto'g'ri:
${total - score}

📚 Jami:
${total}

📈 Foiz:
${percentage}%

🎉 Test topshirganingiz uchun rahmat!`

    );


    // Sessionni o'chirish

    testSessions.delete(userId);

  } catch (error) {

    console.error(
      "❌ TEST YAKUNLASH XATOSI:",
      error.message
    );

    await ctx.reply(
      "❌ Natijani saqlashda xatolik."
    );

    testSessions.delete(userId);
  }

}


// ===============================
// 🛑 TESTNI BEKOR QILISH
// ===============================

bot.command("stoptest", async (ctx) => {

  const userId =
    ctx.from.id;

  if (
    testSessions.has(userId)
  ) {

    testSessions.delete(userId);

    await ctx.reply(
`🛑 TEST TO'XTATILDI.

Test qayta boshlash uchun
🎫 chipta raqamingizni yuboring.`
    );

  } else {

    await ctx.reply(
      "❌ Sizda faol test yo'q."
    );

  }

});
// ===============================
// 🚀 BOT VA SERVERNI ISHGA TUSHIRISH
// ===============================

async function startServer() {

  try {

    // Database
    await initDatabase();

    // Telegram bot
    await bot.launch();

    console.log("================================");
    console.log("🤖 TELEGRAM BOT ISHLADI");
    console.log("================================");

    // Express server
    app.listen(PORT, () => {

      console.log("================================");
      console.log(`🌐 SERVER PORT: ${PORT}`);
      console.log("✅ SERVER ISHLADI");
      console.log("================================");

    });

  } catch (error) {

    console.error(
      "❌ APPLICATION START XATOSI:",
      error
    );

    process.exit(1);
  }
}


// ===============================
// START
// ===============================

startServer();


// ===============================
// BOT TO'XTAGANDA
// ===============================

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);