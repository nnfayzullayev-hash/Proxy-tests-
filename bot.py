import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

import config
from database import db
from handlers import start, news, tickets, tests, admin


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
    try:
        logging.info("Bot ishga tushdi...")
        await dp.start_polling(bot)
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
