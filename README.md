# Test Telegram Bot

## O'rnatish

```bash
python3.13 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Sozlash

`.env.example` faylidan nusxa oling va `.env` deb nomlang, so'ng o'z ma'lumotlaringizni kiriting:

```bash
cp .env.example .env
```

- `BOT_TOKEN` — BotFather'dan olingan token
- `ADMIN_IDS` — admin(lar)ning Telegram ID raqamlari, vergul bilan ajratilgan
- `DB_*` — PostgreSQL ulanish ma'lumotlari
- `CARD_NUMBER`, `CARD_HOLDER` — to'lov uchun ko'rsatiladigan karta ma'lumoti

PostgreSQL bazasini oldindan yaratib qo'ying:

```sql
CREATE DATABASE testbot;
```

Jadvallar bot birinchi marta ishga tushganda avtomatik yaratiladi.

## Ishga tushirish

```bash
python bot.py
```

## Render'da deploy qilish

1. Loyihani GitHub'ga yuklang.
2. Render'da **Background Worker** yarating (Web Service emas — bot polling rejimida ishlaydi).
3. Build command: `pip install -r requirements.txt`
4. Start command: `python bot.py`
5. Environment Variables bo'limiga `.env` dagi barcha o'zgaruvchilarni kiriting.
6. Render'da PostgreSQL bazasi yarating va uning ulanish ma'lumotlarini shu yerga qo'shing.

## Loyiha tuzilishi

```
telegram-bot/
├── bot.py              — botni ishga tushirish
├── config.py           — sozlamalar (.env)
├── database.py         — PostgreSQL bilan ishlash (asyncpg)
├── handlers/           — foydalanuvchi va admin buyruqlari
│   ├── start.py
│   ├── news.py
│   ├── tickets.py
│   ├── tests.py
│   └── admin.py
└── services/           — biznes-logika
    ├── ticket_service.py
    ├── test_service.py
    ├── payment_service.py
    └── pdf_service.py
```
