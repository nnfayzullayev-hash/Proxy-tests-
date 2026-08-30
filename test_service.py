from datetime import datetime

from database import db


async def create_test(name, description, start_time, duration):
    return await db.create_test(name, description, start_time, duration)


async def add_question(test_id, question, a, b, c, d, correct, order_index):
    return await db.add_question(test_id, question, a, b, c, d, correct, order_index)


async def get_active_tests():
    return await db.list_tests(status="active")


async def get_test(test_id):
    return await db.get_test(test_id)


async def get_questions(test_id):
    return await db.get_questions(test_id)


def is_test_startable(test):
    if test["status"] != "active":
        return False, "Bu test hali faollashtirilmagan."
    if test["start_time"] and datetime.now() < test["start_time"]:
        return False, f"Test hali boshlanmagan. Boshlanish vaqti: {test['start_time'].strftime('%d.%m.%Y %H:%M')}"
    return True, ""


def is_test_time_over(test, started_at):
    if not test["duration"]:
        return False
    elapsed_minutes = (datetime.now() - started_at).total_seconds() / 60
    return elapsed_minutes >= test["duration"]
