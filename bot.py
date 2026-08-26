import asyncio
import os

from dotenv import load_dotenv
from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton


load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")

if not BOT_TOKEN:
    raise ValueError("❌ BOT_TOKEN topilmadi!")


bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


# =========================
# ASOSIY MENYU
# =========================

def main_menu():
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="📰 Yangiliklar")
            ],
            [
                KeyboardButton(text="🎫 Chipta"),
                KeyboardButton(text="📝 Testlar")
            ],
            [
                KeyboardButton(text="ℹ️ Ma'lumot")
            ]
        ],
        resize_keyboard=True
    )


# =========================
# /start
# =========================

@dp.message(CommandStart())
async def start_handler(message: Message):

    name = message.from_user.first_name

    await message.answer(
        f"👋 Salom, {name}!\n\n"
        "🤖 Botimizga xush kelibsiz!\n\n"
        "Kerakli bo‘limni tanlang:",
        reply_markup=main_menu()
    )


# =========================
# YANGILIKLAR
# =========================

@dp.message(lambda message: message.text == "📰 Yangiliklar")
async def news_handler(message: Message):

    await message.answer(
        "📰 YANGILIKLAR\n\n"
        "Hozircha yangiliklar mavjud emas."
    )


# =========================
# CHIPTA
# =========================

@dp.message(lambda message: message.text == "🎫 Chipta")
async def ticket_handler(message: Message):

    await message.answer(
        "🎫 CHIPTA BO‘LIMI\n\n"
        "Bu yerda test uchun chipta olish mumkin."
    )


# =========================
# TESTLAR
# =========================

@dp.message(lambda message: message.text == "📝 Testlar")
async def test_handler(message: Message):

    await message.answer(
        "📝 TESTLAR BO‘LIMI\n\n"
        "Testni boshlash uchun chipta kerak."
    )


# =========================
# MA'LUMOT
# =========================

@dp.message(lambda message: message.text == "ℹ️ Ma'lumot")
async def info_handler(message: Message):

    await message.answer(
        "ℹ️ BOT HAQIDA\n\n"
        "📰 Yangiliklar\n"
        "🎫 Chipta olish\n"
        "📝 Test ishlash\n"
        "📄 Natijalarni olish"
    )


# =========================
# BOTNI ISHGA TUSHIRISH
# =========================

async def main():

    print("🤖 Bot ishga tushmoqda...")

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())