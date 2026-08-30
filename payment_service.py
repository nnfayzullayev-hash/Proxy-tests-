from database import db


async def create_payment(user_id, ticket_id, amount, receipt_file_id):
    return await db.create_payment(user_id, ticket_id, amount, receipt_file_id)


async def approve_payment(payment_id):
    await db.update_payment_status(payment_id, "approved")


async def reject_payment(payment_id):
    await db.update_payment_status(payment_id, "rejected")


async def list_pending():
    return await db.list_pending_payments()
