from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import StatesGroup, State
from aiogram.types import (
    Message, CallbackQuery,
    InlineKeyboardMarkup, InlineKeyboardButton
)

from database import db
import config
from services import test_service, ticket_service, payment_service

router = Router()


class BuyTicket(StatesGroup):
    choosing_test = State()
    entering_name = State()
    waiting_receipt = State()


@router.message(F.text == "🎫 Chipta")
async def choose_test_for_ticket(message: Message, state: FSMContext):
    tests = await test_service.get_active_tests()
    if not tests:
        await message.answer("Hozircha faol testlar yo'q.")
        return
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t["name"], callback_data=f"buy_test:{t['id']}")]
        for t in tests
    ])
    await message.answer("Qaysi testga chipta olmoqchisiz?", reply_markup=kb)
    await state.set_state(BuyTicket.choosing_test)


@router.callback_query(BuyTicket.choosing_test, F.data.startswith("buy_test:"))
async def ticket_test_chosen(callback: CallbackQuery, state: FSMContext):
    test_id = int(callback.data.split(":")[1])
    test = await test_service.get_test(test_id)
    if not test:
        await callback.answer("Test topilmadi.", show_alert=True)
        return
    await state.update_data(test_id=test_id, price=float(test["price"] or 0))
    await callback.message.answer("F.I.SH ni to'liq kiriting (Masalan: Ali Valiyev):")
    await state.set_state(BuyTicket.entering_name)
    await callback.answer()


@router.message(BuyTicket.entering_name)
async def ticket_name_entered(message: Message, state: FSMContext):
    full_name = message.text.strip()
    if len(full_name.split()) < 2:
        await message.answer("Iltimos, F.I.SH ni to'liq kiriting.")
        return
    data = await state.get_data()
    user = await db.get_user_by_telegram_id(message.from_user.id)
    ticket = await ticket_service.create_pending_ticket(user["id"], data["test_id"], full_name)
    await state.update_data(full_name=full_name, ticket_id=ticket["id"])

    text = (
        f"💳 To'lov uchun karta:\n\n"
        f"<code>{config.CARD_NUMBER}</code>\n"
        f"{config.CARD_HOLDER}\n\n"
        f"Summa: {data['price']:,.0f} so'm\n\n"
        f"To'lovni amalga oshirib, chek yoki skrinshot rasmini shu yerga yuboring."
    )
    await message.answer(text)
    await state.set_state(BuyTicket.waiting_receipt)


@router.message(BuyTicket.waiting_receipt, F.photo)
async def receipt_received(message: Message, state: FSMContext, bot):
    data = await state.get_data()
    user = await db.get_user_by_telegram_id(message.from_user.id)
    photo_file_id = message.photo[-1].file_id

    payment = await payment_service.create_payment(
        user["id"], data["ticket_id"], data["price"], photo_file_id
    )

    await message.answer("✅ Chekingiz qabul qilindi. Admin tekshirgach, sizga chipta raqami yuboriladi.")

    test = await test_service.get_test(data["test_id"])
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"pay_ok:{payment['id']}"),
        InlineKeyboardButton(text="❌ Rad etish", callback_data=f"pay_no:{payment['id']}"),
    ]])
    username = message.from_user.username or "-"
    caption = (
        f"💳 Yangi to'lov\n\n"
        f"Foydalanuvchi: {message.from_user.full_name} (@{username})\n"
        f"F.I.SH: {data['full_name']}\n"
        f"Test: {test['name']}\n"
        f"Summa: {data['price']:,.0f} so'm"
    )
    for admin_id in config.ADMIN_IDS:
        await bot.send_photo(admin_id, photo_file_id, caption=caption, reply_markup=kb)

    await state.clear()


@router.message(BuyTicket.waiting_receipt)
async def receipt_wrong_type(message: Message):
    await message.answer("Iltimos, to'lov chekining rasmini yuboring.")
