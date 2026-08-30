from datetime import datetime

from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import StatesGroup, State
from aiogram.types import (
    Message, CallbackQuery,
    ReplyKeyboardMarkup, KeyboardButton,
    InlineKeyboardMarkup, InlineKeyboardButton
)

from database import db
import config
from services import ticket_service, payment_service, test_service

router = Router()


def is_admin(user_id: int) -> bool:
    return user_id in config.ADMIN_IDS


def admin_menu_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(keyboard=[
        [KeyboardButton(text="📰 Yangilik qo'shish"), KeyboardButton(text="📝 Test qo'shish")],
        [KeyboardButton(text="📋 Testlarni boshqarish"), KeyboardButton(text="🎫 Chiptalarni boshqarish")],
        [KeyboardButton(text="💳 To'lovlarni tekshirish"), KeyboardButton(text="👥 Foydalanuvchilar")],
        [KeyboardButton(text="📊 Statistika"), KeyboardButton(text="⬅️ Asosiy menyu")],
    ], resize_keyboard=True)


@router.message(F.text == "👨‍💼 Admin panel")
async def open_admin_panel(message: Message):
    if not is_admin(message.from_user.id):
        return
    await message.answer("👨‍💼 ADMIN PANEL", reply_markup=admin_menu_keyboard())


@router.message(F.text == "⬅️ Asosiy menyu")
async def back_to_main(message: Message):
    from handlers.start import main_menu_keyboard
    await message.answer("Asosiy menyu:", reply_markup=main_menu_keyboard(is_admin(message.from_user.id)))


# ---------------- YANGILIK QO'SHISH ----------------

class AddNews(StatesGroup):
    title = State()
    text = State()


@router.message(F.text == "📰 Yangilik qo'shish")
async def add_news_start(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await message.answer("Yangilik sarlavhasini kiriting:")
    await state.set_state(AddNews.title)


@router.message(AddNews.title)
async def add_news_title(message: Message, state: FSMContext):
    await state.update_data(title=message.text)
    await message.answer("Yangilik matnini kiriting:")
    await state.set_state(AddNews.text)


@router.message(AddNews.text)
async def add_news_text(message: Message, state: FSMContext):
    data = await state.get_data()
    await db.add_news(data["title"], message.text)
    await message.answer("✅ Yangilik qo'shildi.", reply_markup=admin_menu_keyboard())
    await state.clear()


# ---------------- TEST QO'SHISH ----------------

class AddTest(StatesGroup):
    name = State()
    description = State()
    start_time = State()
    duration = State()
    price = State()
    question = State()
    option_a = State()
    option_b = State()
    option_c = State()
    option_d = State()
    correct = State()
    more_questions = State()


@router.message(F.text == "📝 Test qo'shish")
async def add_test_start(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await message.answer("Test nomini kiriting:")
    await state.set_state(AddTest.name)


@router.message(AddTest.name)
async def add_test_name(message: Message, state: FSMContext):
    await state.update_data(name=message.text)
    await message.answer("Test haqida qisqacha ma'lumot kiriting:")
    await state.set_state(AddTest.description)


@router.message(AddTest.description)
async def add_test_description(message: Message, state: FSMContext):
    await state.update_data(description=message.text)
    await message.answer("Test sanasi va vaqtini kiriting (masalan: 30.08.2026 15:00):")
    await state.set_state(AddTest.start_time)


@router.message(AddTest.start_time)
async def add_test_start_time(message: Message, state: FSMContext):
    try:
        dt = datetime.strptime(message.text.strip(), "%d.%m.%Y %H:%M")
    except ValueError:
        await message.answer("❌ Noto'g'ri format. Masalan: 30.08.2026 15:00")
        return
    await state.update_data(start_time=dt)
    await message.answer("Test davomiyligini daqiqalarda kiriting (masalan: 60):")
    await state.set_state(AddTest.duration)


@router.message(AddTest.duration)
async def add_test_duration(message: Message, state: FSMContext):
    if not message.text.isdigit():
        await message.answer("❌ Faqat son kiriting.")
        return
    await state.update_data(duration=int(message.text))
    await message.answer("Chipta narxini so'mda kiriting (masalan: 20000):")
    await state.set_state(AddTest.price)


@router.message(AddTest.price)
async def add_test_price(message: Message, state: FSMContext):
    if not message.text.isdigit():
        await message.answer("❌ Faqat son kiriting.")
        return
    data = await state.get_data()
    test = await test_service.create_test(
        data["name"], data["description"], data["start_time"], data["duration"]
    )
    await db.pool.execute("UPDATE tests SET price=$1 WHERE id=$2", int(message.text), test["id"])
    await state.update_data(test_id=test["id"], order_index=1)
    await message.answer(
        f"✅ Test yaratildi: {data['name']}\n\nEndi savollarni qo'shamiz.\n\n1-savol matnini kiriting:"
    )
    await state.set_state(AddTest.question)


@router.message(AddTest.question)
async def add_question_text(message: Message, state: FSMContext):
    await state.update_data(question=message.text)
    await message.answer("A) variantini kiriting:")
    await state.set_state(AddTest.option_a)


@router.message(AddTest.option_a)
async def add_option_a(message: Message, state: FSMContext):
    await state.update_data(option_a=message.text)
    await message.answer("B) variantini kiriting:")
    await state.set_state(AddTest.option_b)


@router.message(AddTest.option_b)
async def add_option_b(message: Message, state: FSMContext):
    await state.update_data(option_b=message.text)
    await message.answer("C) variantini kiriting:")
    await state.set_state(AddTest.option_c)


@router.message(AddTest.option_c)
async def add_option_c(message: Message, state: FSMContext):
    await state.update_data(option_c=message.text)
    await message.answer("D) variantini kiriting:")
    await state.set_state(AddTest.option_d)


@router.message(AddTest.option_d)
async def add_option_d(message: Message, state: FSMContext):
    await state.update_data(option_d=message.text)
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="A", callback_data="correct:A"),
        InlineKeyboardButton(text="B", callback_data="correct:B"),
        InlineKeyboardButton(text="C", callback_data="correct:C"),
        InlineKeyboardButton(text="D", callback_data="correct:D"),
    ]])
    await message.answer("To'g'ri javobni tanlang:", reply_markup=kb)
    await state.set_state(AddTest.correct)


@router.callback_query(AddTest.correct, F.data.startswith("correct:"))
async def add_correct_answer(callback: CallbackQuery, state: FSMContext):
    correct = callback.data.split(":")[1]
    data = await state.get_data()
    await test_service.add_question(
        data["test_id"], data["question"],
        data["option_a"], data["option_b"], data["option_c"], data["option_d"],
        correct, data["order_index"]
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="➕ Yana savol qo'shish", callback_data="more_q:yes"),
        InlineKeyboardButton(text="✅ Tugatish", callback_data="more_q:no"),
    ]])
    await callback.message.answer(f"✅ {data['order_index']}-savol qo'shildi.", reply_markup=kb)
    await state.update_data(order_index=data["order_index"] + 1)
    await state.set_state(AddTest.more_questions)
    await callback.answer()


@router.callback_query(AddTest.more_questions, F.data.startswith("more_q:"))
async def more_questions(callback: CallbackQuery, state: FSMContext):
    choice = callback.data.split(":")[1]
    if choice == "yes":
        await callback.message.answer("Keyingi savol matnini kiriting:")
        await state.set_state(AddTest.question)
    else:
        data = await state.get_data()
        await db.set_test_status(data["test_id"], "active")
        await callback.message.answer(
            "✅ Test faollashtirildi va foydalanuvchilarga ko'rinadi.",
            reply_markup=admin_menu_keyboard()
        )
        await state.clear()
    await callback.answer()


# ---------------- TESTLARNI BOSHQARISH ----------------

@router.message(F.text == "📋 Testlarni boshqarish")
async def manage_tests(message: Message):
    if not is_admin(message.from_user.id):
        return
    tests = await db.list_tests()
    if not tests:
        await message.answer("Testlar mavjud emas.")
        return
    for t in tests:
        start_str = t["start_time"].strftime("%d.%m.%Y %H:%M") if t["start_time"] else "-"
        text = (
            f"📝 {t['name']} (#{t['id']})\n"
            f"Holat: {t['status']}\n"
            f"Boshlanish: {start_str}\n"
            f"Davomiyligi: {t['duration']} daqiqa"
        )
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="✅ Faollashtirish", callback_data=f"test_on:{t['id']}"),
            InlineKeyboardButton(text="⛔️ To'xtatish", callback_data=f"test_off:{t['id']}"),
            InlineKeyboardButton(text="🗑 O'chirish", callback_data=f"test_del:{t['id']}"),
        ]])
        await message.answer(text, reply_markup=kb)


@router.callback_query(F.data.startswith("test_on:"))
async def test_activate(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    test_id = int(callback.data.split(":")[1])
    await db.set_test_status(test_id, "active")
    await callback.answer("Test faollashtirildi.")


@router.callback_query(F.data.startswith("test_off:"))
async def test_deactivate(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    test_id = int(callback.data.split(":")[1])
    await db.set_test_status(test_id, "finished")
    await callback.answer("Test to'xtatildi.")


@router.callback_query(F.data.startswith("test_del:"))
async def test_delete(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    test_id = int(callback.data.split(":")[1])
    await db.delete_test(test_id)
    await callback.answer("Test o'chirildi.")
    await callback.message.delete()


# ---------------- CHIPTALARNI BOSHQARISH ----------------

@router.message(F.text == "🎫 Chiptalarni boshqarish")
async def manage_tickets(message: Message):
    if not is_admin(message.from_user.id):
        return
    tickets = await db.list_tickets(limit=20)
    if not tickets:
        await message.answer("Chiptalar mavjud emas.")
        return
    lines = [f"🎫 {t['ticket_number'] or '-'} | {t['full_name']} | {t['status']}" for t in tickets]
    await message.answer("\n".join(lines))


# ---------------- TO'LOVLARNI TEKSHIRISH ----------------

@router.message(F.text == "💳 To'lovlarni tekshirish")
async def check_payments(message: Message, bot):
    if not is_admin(message.from_user.id):
        return
    payments = await payment_service.list_pending()
    if not payments:
        await message.answer("Tekshiriladigan to'lovlar yo'q.")
        return
    for p in payments:
        ticket = await db.get_ticket(p["ticket_id"])
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"pay_ok:{p['id']}"),
            InlineKeyboardButton(text="❌ Rad etish", callback_data=f"pay_no:{p['id']}"),
        ]])
        caption = f"F.I.SH: {ticket['full_name']}\nSumma: {p['amount']:,.0f} so'm"
        await bot.send_photo(message.chat.id, p["receipt"], caption=caption, reply_markup=kb)


@router.callback_query(F.data.startswith("pay_ok:"))
async def approve_payment_callback(callback: CallbackQuery, bot):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    payment_id = int(callback.data.split(":")[1])
    payment = await db.get_payment(payment_id)
    await payment_service.approve_payment(payment_id)
    ticket = await ticket_service.approve_ticket_and_generate_number(payment["ticket_id"])
    test = await db.get_test(ticket["test_id"])
    user_row = await db.get_user_by_id(ticket["user_id"])

    text = (
        f"🎫 CHIPTA\n\n"
        f"Test: {test['name']}\n"
        f"F.I.SH: {ticket['full_name']}\n"
        f"Chipta: {ticket['ticket_number']}\n"
        f"Amal qilish muddati: {config.TICKET_EXPIRE_HOURS} soat"
    )
    await bot.send_message(user_row["telegram_id"], text)
    await callback.message.edit_caption(caption=(callback.message.caption or "") + "\n\n✅ TASDIQLANDI")
    await callback.answer("Tasdiqlandi.")


@router.callback_query(F.data.startswith("pay_no:"))
async def reject_payment_callback(callback: CallbackQuery, bot):
    if not is_admin(callback.from_user.id):
        await callback.answer()
        return
    payment_id = int(callback.data.split(":")[1])
    payment = await db.get_payment(payment_id)
    await payment_service.reject_payment(payment_id)
    await ticket_service.reject_ticket(payment["ticket_id"])

    ticket = await db.get_ticket(payment["ticket_id"])
    user_row = await db.get_user_by_id(ticket["user_id"])

    await bot.send_message(
        user_row["telegram_id"],
        "❌ To'lovingiz rad etildi. Iltimos, qaytadan urinib ko'ring yoki admin bilan bog'laning."
    )
    await callback.message.edit_caption(caption=(callback.message.caption or "") + "\n\n❌ RAD ETILDI")
    await callback.answer("Rad etildi.")


# ---------------- FOYDALANUVCHILAR ----------------

@router.message(F.text == "👥 Foydalanuvchilar")
async def list_users(message: Message):
    if not is_admin(message.from_user.id):
        return
    count = await db.count_users()
    users = await db.list_users(limit=15)
    lines = [f"👥 Jami foydalanuvchilar: {count}\n"]
    for u in users:
        lines.append(f"- {u['first_name'] or ''} {u['last_name'] or ''} (@{u['username'] or '-'})")
    await message.answer("\n".join(lines))


# ---------------- STATISTIKA ----------------

@router.message(F.text == "📊 Statistika")
async def show_stats(message: Message):
    if not is_admin(message.from_user.id):
        return
    users_count = await db.count_users()
    tests = await db.list_tests()
    tickets = await db.list_tickets(limit=1000)
    revenue = await db.sum_approved_payments()
    approved_tickets = len([t for t in tickets if t["status"] in ("approved", "used")])

    text = (
        f"📊 STATISTIKA\n\n"
        f"👥 Foydalanuvchilar: {users_count}\n"
        f"📝 Testlar soni: {len(tests)}\n"
        f"🎫 Sotilgan chiptalar: {approved_tickets}\n"
        f"💰 Umumiy tushum: {revenue:,.0f} so'm"
    )
    await message.answer(text)
