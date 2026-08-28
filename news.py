from aiogram import Router, F
from aiogram.types import Message

from database import db

router = Router()


@router.message(F.text == "📰 Yangiliklar")
async def show_news(message: Message):
    news_list = await db.get_news_list(limit=10)
    if not news_list:
        await message.answer("Hozircha yangiliklar yo'q.")
        return
    for item in news_list:
        text = (
            f"📰 <b>{item['title']}</b>\n\n{item['text']}\n\n"
            f"🕓 {item['created_at'].strftime('%d.%m.%Y %H:%M')}"
        )
        await message.answer(text)
