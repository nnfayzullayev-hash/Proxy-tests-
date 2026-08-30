from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton

from database import db
import config

router = Router()


def main_menu_keyboard(is_admin: bool) -> ReplyKeyboardMarkup:
    buttons = [
        [KeyboardButton(text="📰 Yangiliklar")],
        [KeyboardButton(text="🎫 Chipta")],
        [KeyboardButton(text="📝 Testlar")],
    ]
    if is_admin:
        buttons.append([KeyboardButton(text="👨‍💼 Admin panel")])
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)


@router.message(CommandStart())
async def cmd_start(message: Message):
    user = message.from_user
    await db.get_or_create_user(user.id, user.first_name, user.last_name, user.username)
    is_admin = user.id in config.ADMIN_IDS
    await message.answer(
        f"Assalomu alaykum, {user.first_name}! 👋\n\nQuyidagi menyudan foydalaning:",
        reply_markup=main_menu_keyboard(is_admin),
    )
