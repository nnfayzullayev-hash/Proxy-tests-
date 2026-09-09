import asyncio
import logging
import os

from aiohttp import web
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

import config
from database import db
from handlers import start, news, tickets, tests, admin


async def handle_ping(request):
    """Render va tashqi 'pinger' xizmatlari uchun oddiy javob.
    Bu route bot uxlab qolmasligi (keep-alive) uchun kerak."""
    return web.Response(text="Bot ishlab turibdi ✅")


async def start_web_server():
    """Render bepul Web Service tarifida ochiq port kutadi.
    Shu kichik server bo'lmasa, xizmat umuman ishga tushmaydi
    va tashqi pinger ham ping qiladigan manzilga ega bo'lmaydi."""
    app = web.Application()
    app.router.add_get("/", handle_ping)
    runner = web.AppRunner(app)
    await runner.setup()
    port = int(os.environ.get("PORT", 10000))
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logging.info(f"Keep-alive veb-server {port}-portda ishga tushdi.")


async def main():
    logging.basicConfig(level=logging.INFO)

    await db.connect()

    bot = Bot(token=config.BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher(storage=MemoryStorage())

    # Admin routerini birinchi qo'shamiz, chunki uning matn tugmalari
    # foydalanuvchi menyusidan farqli va tekshirilishi kerak.
    dp.include_router(admin.router)
    dp.include_router(tickets.router)
    dp.include_router(tests.router)
    dp.include_router(news.router)
    dp.include_router(start.router)

    await bot.delete_webhook(drop_pending_updates=True)
    await start_web_server()

    try:
        logging.info("Bot ishga tushdi...")
        await dp.start_polling(bot)
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
