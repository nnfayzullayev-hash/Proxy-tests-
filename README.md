# Proxy Tests Bot

## Kerakli narsalar
- GitHub repository
- Render kabi Node.js hosting
- PostgreSQL (masalan Neon/Supabase)
- Telegram BotFather token
- Admin Telegram ID

## Muhim
GitHub Pages faqat frontend uchun. Botning o‘zi serverda ishlashi kerak.

## Deploy
1. Repositoryga barcha fayllarni yuklang.
2. Hostingda Node service yarating.
3. Build: `npm install`
4. Start: `npm start`
5. Environment variablesni `.env.example` asosida kiriting.
6. `PUBLIC_URL`ni hosting bergan HTTPS manzilga qo‘ying.
7. BotFather orqali botni yarating va tokenni faqat hostingdagi secret/environment variablega kiriting.

## To‘lov
Hozirgi versiyada chek qabul qilinadi va admin paneldan tasdiqlanadi. Bank hisobini avtomatik tekshirish uchun tegishli bank/to‘lov tizimi API integratsiyasi kerak.
