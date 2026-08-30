import random
from datetime import datetime, timedelta

from database import db
import config


async def generate_unique_ticket_number() -> str:
    while True:
        number = str(random.randint(100000, 999999))
        exists = await db.ticket_number_exists(number)
        if not exists:
            return number


async def create_pending_ticket(user_id, test_id, full_name):
    return await db.create_pending_ticket(user_id, test_id, full_name)


async def approve_ticket_and_generate_number(ticket_id):
    number = await generate_unique_ticket_number()
    expires_at = datetime.now() + timedelta(hours=config.TICKET_EXPIRE_HOURS)
    return await db.approve_ticket(ticket_id, number, expires_at)


async def reject_ticket(ticket_id):
    await db.reject_ticket(ticket_id)


async def validate_ticket(ticket_number, full_name):
    """Chiptani va F.I.SH ni tekshiradi. (ticket, error_message) qaytaradi."""
    ticket = await db.get_ticket_by_number(ticket_number)
    if not ticket:
        return None, "❌ Bunday chipta topilmadi."
    if ticket["status"] == "used":
        return None, "❌ Bu chipta allaqachon ishlatilgan."
    if ticket["status"] != "approved":
        return None, "❌ Chipta hali tasdiqlanmagan."
    if ticket["expires_at"] and ticket["expires_at"] < datetime.now():
        return None, "❌ Chiptaning amal qilish muddati tugagan."
    if ticket["full_name"].strip().lower() != full_name.strip().lower():
        return None, "❌ F.I.SH chipta ma'lumotiga mos kelmadi."
    return ticket, None
