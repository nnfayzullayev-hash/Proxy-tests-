import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")

ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()]

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "testbot")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

CARD_NUMBER = os.getenv("CARD_NUMBER", "8600 0000 0000 0000")
CARD_HOLDER = os.getenv("CARD_HOLDER", "F.I.SH")

TICKET_EXPIRE_HOURS = int(os.getenv("TICKET_EXPIRE_HOURS", "24"))
