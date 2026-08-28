from datetime import datetime

from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import StatesGroup, State
from aiogram.types import (
    Message, CallbackQuery,
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton,
    FSInputFile
)

from database import db
import config
from services import ticket_service, test_service, pdf_service

router = Router()


class TakeTest(StatesGroup):
    entering_ticket = State()
    entering_name = State()
    in_progress = State()


EXIT_BUTTON = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="🚪 Testdan chiqish")]], resize_keyboard=True
)


@router.message(F.text == "📝 Testlar")
async def start_take_test(message: Message, state: FSMContext):
    await message.answer("Chipta raqamingizni kiriting (6 xonali):")
    await state.set_state(TakeTest.entering_ticket)


@router.message(TakeTest.entering_ticket)
async def ticket_number_entered(message: Message, state: FSMContext):
    await state.update_data(ticket_number=message.text.strip())
    await message.answer("F.I.SH ni kiriting:")
    await state.set_state(TakeTest.entering_name)


@router.message(TakeTest.entering_name)
async def name_entered_for_test(message: Message, state: FSMContext):
    data = await state.get_data()
    ticket, error = await ticket_service.validate_ticket(data["ticket_number"], message.text.strip())
    if error:
        await message.answer(error)
        await state.clear()
        return

    test = await test_service.get_test(ticket["test_id"])
    ok, err_msg = test_service.is_test_startable(test)
    if not ok:
        await message.answer(f"❌ {err_msg}")
        await state.clear()
        return

    questions = await test_service.get_questions(test["id"])
    if not questions:
        await message.answer("Bu testda hozircha savollar yo'q.")
        await state.clear()
        return

    await db.mark_ticket_used(ticket["id"])

    await state.update_data(
        test_id=test["id"],
        test_name=test["name"],
        ticket_id=ticket["id"],
        ticket_number=ticket["ticket_number"],
        full_name=ticket["full_name"],
        question_ids=[q["id"] for q in questions],
        index=0,
        correct=0,
        wrong=0,
        started_at=datetime.now().isoformat(),
        user_answers=[],
    )
    await message.answer(f"✅ Test boshlandi: {test['name']}\nOmad tilaymiz!", reply_markup=EXIT_BUTTON)
    await state.set_state(TakeTest.in_progress)
    await send_question(message, state)


async def send_question(message: Message, state: FSMContext):
    data = await state.get_data()
    index = data["index"]
    question_ids = data["question_ids"]
    question = await db.pool.fetchrow("SELECT * FROM questions WHERE id=$1", question_ids[index])

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"A) {question['option_a']}", callback_data="ans:A")],
        [InlineKeyboardButton(text=f"B) {question['option_b']}", callback_data="ans:B")],
        [InlineKeyboardButton(text=f"C) {question['option_c']}", callback_data="ans:C")],
        [InlineKeyboardButton(text=f"D) {question['option_d']}", callback_data="ans:D")],
    ])
    text = f"{index + 1}-savol\n\n{question['question']}"
    await message.answer(text, reply_markup=kb)


@router.callback_query(TakeTest.in_progress, F.data.startswith("ans:"))
async def answer_selected(callback: CallbackQuery, state: FSMContext):
    selected = callback.data.split(":")[1]
    data = await state.get_data()
    index = data["index"]
    question_id = data["question_ids"][index]

    question = await db.pool.fetchrow("SELECT * FROM questions WHERE id=$1", question_id)
    is_correct = question["correct_answer"] == selected

    user = await db.get_user_by_telegram_id(callback.from_user.id)
    await db.save_answer(user["id"], data["test_id"], question_id, selected)

    user_answers = data["user_answers"]
    user_answers.append({
        "order": index + 1,
        "selected": selected,
        "correct": question["correct_answer"],
        "is_correct": is_correct,
    })

    correct = data["correct"] + (1 if is_correct else 0)
    wrong = data["wrong"] + (0 if is_correct else 1)
    next_index = index + 1

    await callback.message.edit_reply_markup(reply_markup=None)

    test = await test_service.get_test(data["test_id"])
    started_at = datetime.fromisoformat(data["started_at"])
    time_over = test_service.is_test_time_over(test, started_at)

    if next_index >= len(data["question_ids"]) or time_over:
        await state.update_data(correct=correct, wrong=wrong, user_answers=user_answers, index=next_index)
        await finish_test(callback.message, state, callback.from_user.id)
    else:
        await state.update_data(index=next_index, correct=correct, wrong=wrong, user_answers=user_answers)
        await send_question(callback.message, state)

    await callback.answer()


@router.message(TakeTest.in_progress, F.text == "🚪 Testdan chiqish")
async def exit_test(message: Message, state: FSMContext):
    data = await state.get_data()
    if data.get("user_answers"):
        await finish_test(message, state, message.from_user.id)
    else:
        from handlers.start import main_menu_keyboard
        is_admin = message.from_user.id in config.ADMIN_IDS
        await message.answer("Test bekor qilindi.", reply_markup=main_menu_keyboard(is_admin))
        await state.clear()


async def finish_test(message: Message, state: FSMContext, telegram_id: int):
    data = await state.get_data()
    total = data["correct"] + data["wrong"]
    percentage = (data["correct"] / total * 100) if total else 0

    user = await db.get_user_by_telegram_id(telegram_id)
    await db.save_result(
        user["id"], data["test_id"], data["ticket_id"], data["correct"], data["wrong"], percentage
    )

    text = (
        f"✅ TEST YAKUNLANDI\n\n"
        f"F.I.SH: {data['full_name']}\n"
        f"To'g'ri javoblar: {data['correct']}\n"
        f"Noto'g'ri javoblar: {data['wrong']}\n"
        f"Natija: {percentage:.0f}%"
    )

    pdf_path = pdf_service.generate_result_pdf(
        data["full_name"], data["test_name"], data["user_answers"],
        data["correct"], data["wrong"], percentage, data["ticket_number"]
    )

    from handlers.start import main_menu_keyboard
    is_admin = telegram_id in config.ADMIN_IDS
    await message.answer(text, reply_markup=main_menu_keyboard(is_admin))
    await message.answer_document(FSInputFile(pdf_path), caption="📄 Javoblaringiz PDF shaklida.")
    await state.clear()
