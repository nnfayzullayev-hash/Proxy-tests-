import asyncpg

import config


class Database:
    def __init__(self):
        self.pool: asyncpg.Pool | None = None

    async def connect(self):
        self.pool = await asyncpg.create_pool(
            host=config.DB_HOST,
            port=config.DB_PORT,
            database=config.DB_NAME,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            min_size=1,
            max_size=10,
        )
        await self.init_models()

    async def close(self):
        if self.pool:
            await self.pool.close()

    async def init_models(self):
        async with self.pool.acquire() as conn:
            await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                telegram_id BIGINT UNIQUE NOT NULL,
                first_name TEXT,
                last_name TEXT,
                username TEXT,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS news (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS tests (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                price NUMERIC DEFAULT 0,
                start_time TIMESTAMP,
                duration INTEGER,
                status TEXT DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
                question TEXT NOT NULL,
                option_a TEXT NOT NULL,
                option_b TEXT NOT NULL,
                option_c TEXT NOT NULL,
                option_d TEXT NOT NULL,
                correct_answer CHAR(1) NOT NULL,
                order_index INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                ticket_number VARCHAR(6) UNIQUE,
                user_id INTEGER REFERENCES users(id),
                test_id INTEGER REFERENCES tests(id),
                full_name TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                ticket_id INTEGER REFERENCES tickets(id),
                amount NUMERIC,
                receipt TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS answers (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                test_id INTEGER REFERENCES tests(id),
                question_id INTEGER REFERENCES questions(id),
                selected_answer CHAR(1),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS results (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                test_id INTEGER REFERENCES tests(id),
                ticket_id INTEGER REFERENCES tickets(id),
                correct_answers INTEGER,
                wrong_answers INTEGER,
                percentage NUMERIC,
                created_at TIMESTAMP DEFAULT NOW()
            );
            """)

    # ---------- USERS ----------
    async def get_or_create_user(self, telegram_id, first_name, last_name, username):
        async with self.pool.acquire() as conn:
            user = await conn.fetchrow("SELECT * FROM users WHERE telegram_id=$1", telegram_id)
            if user:
                return user
            return await conn.fetchrow(
                """INSERT INTO users (telegram_id, first_name, last_name, username)
                   VALUES ($1,$2,$3,$4) RETURNING *""",
                telegram_id, first_name, last_name, username
            )

    async def get_user_by_telegram_id(self, telegram_id):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow("SELECT * FROM users WHERE telegram_id=$1", telegram_id)

    async def get_user_by_id(self, user_id):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow("SELECT * FROM users WHERE id=$1", user_id)

    async def count_users(self):
        async with self.pool.acquire() as conn:
            return await conn.fetchval("SELECT COUNT(*) FROM users")

    async def list_users(self, limit=20):
        async with self.pool.acquire() as conn:
            return await conn.fetch("SELECT * FROM users ORDER BY created_at DESC LIMIT $1", limit)

    # ---------- NEWS ----------
    async def add_news(self, title, text):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(
                "INSERT INTO news (title, text) VALUES ($1,$2) RETURNING *", title, text
            )

    async def get_news_list(self, limit=10):
        async with self.pool.acquire() as conn:
            return await conn.fetch("SELECT * FROM news ORDER BY created_at DESC LIMIT $1", limit)

    # ---------- TESTS ----------
    async def create_test(self, name, description, start_time, duration):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(
                """INSERT INTO tests (name, description, start_time, duration, status)
                   VALUES ($1,$2,$3,$4,'draft') RETURNING *""",
                name, description, start_time, duration
            )

    async def set_test_status(self, test_id, status):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE tests SET status=$1 WHERE id=$2", status, test_id)

    async def get_test(self, test_id):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow("SELECT * FROM tests WHERE id=$1", test_id)

    async def list_tests(self, status=None):
        async with self.pool.acquire() as conn:
            if status:
                return await conn.fetch("SELECT * FROM tests WHERE status=$1 ORDER BY id DESC", status)
            return await conn.fetch("SELECT * FROM tests ORDER BY id DESC")

    async def delete_test(self, test_id):
        async with self.pool.acquire() as conn:
            await conn.execute("DELETE FROM tests WHERE id=$1", test_id)

    # ---------- QUESTIONS ----------
    async def add_question(self, test_id, question, a, b, c, d, correct, order_index):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(
                """INSERT INTO questions (test_id, question, option_a, option_b, option_c, option_d, correct_answer, order_index)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *""",
                test_id, question, a, b, c, d, correct, order_index
            )

    async def get_questions(self, test_id):
        async with self.pool.acquire() as conn:
            return await conn.fetch(
                "SELECT * FROM questions WHERE test_id=$1 ORDER BY order_index ASC", test_id
            )

    async def count_questions(self, test_id):
        async with self.pool.acquire() as conn:
            return await conn.fetchval("SELECT COUNT(*) FROM questions WHERE test_id=$1", test_id)

    # ---------- TICKETS ----------
    async def create_pending_ticket(self, user_id, test_id, full_name):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(
                """INSERT INTO tickets (user_id, test_id, full_name, status)
                   VALUES ($1,$2,$3,'pending') RETURNING *""",
                user_id, test_id, full_name
            )

    async def approve_ticket(self, ticket_id, ticket_number, expires_at):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(
                """UPDATE tickets SET status='approved', ticket_number=$2, expires_at=$3
                   WHERE id=$1 RETURNING *""",
                ticket_id, ticket_number, expires_at
            )

    async def reject_ticket(self, ticket_id):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE tickets SET status='rejected' WHERE id=$1", ticket_id)

    async def get_ticket(self, ticket_id):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow("SELECT * FROM tickets WHERE id=$1", ticket_id)

    async def get_ticket_by_number(self, ticket_number):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow("SELECT * FROM tickets WHERE ticket_number=$1", ticket_number)

    async def mark_ticket_used(self, ticket_id):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE tickets SET status='used' WHERE id=$1", ticket_id)

    async def ticket_number_exists(self, ticket_number):
        async with self.pool.acquire() as conn:
            return await conn.fetchval("SELECT 1 FROM tickets WHERE ticket_number=$1", ticket_number)

    async def list_tickets(self, limit=30):
        async with self.pool.acquire() as conn:
            return await conn.fetch("SELECT * FROM tickets ORDER BY created_at DESC LIMIT $1", limit)

    # ---------- PAYMENTS ----------
    async def create_payment(self, user_id, ticket_id, amount, receipt):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(
                """INSERT INTO payments (user_id, ticket_id, amount, receipt, status)
                   VALUES ($1,$2,$3,$4,'pending') RETURNING *""",
                user_id, ticket_id, amount, receipt
            )

    async def get_payment(self, payment_id):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow("SELECT * FROM payments WHERE id=$1", payment_id)

    async def update_payment_status(self, payment_id, status):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE payments SET status=$1 WHERE id=$2", status, payment_id)

    async def list_pending_payments(self):
        async with self.pool.acquire() as conn:
            return await conn.fetch("SELECT * FROM payments WHERE status='pending' ORDER BY created_at ASC")

    async def sum_approved_payments(self):
        async with self.pool.acquire() as conn:
            return await conn.fetchval("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='approved'")

    # ---------- ANSWERS ----------
    async def save_answer(self, user_id, test_id, question_id, selected_answer):
        async with self.pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO answers (user_id, test_id, question_id, selected_answer)
                   VALUES ($1,$2,$3,$4)""",
                user_id, test_id, question_id, selected_answer
            )

    # ---------- RESULTS ----------
    async def save_result(self, user_id, test_id, ticket_id, correct, wrong, percentage):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(
                """INSERT INTO results (user_id, test_id, ticket_id, correct_answers, wrong_answers, percentage)
                   VALUES ($1,$2,$3,$4,$5,$6) RETURNING *""",
                user_id, test_id, ticket_id, correct, wrong, percentage
            )

    async def list_results(self, test_id=None, limit=30):
        async with self.pool.acquire() as conn:
            if test_id:
                return await conn.fetch(
                    "SELECT * FROM results WHERE test_id=$1 ORDER BY created_at DESC LIMIT $2",
                    test_id, limit
                )
            return await conn.fetch("SELECT * FROM results ORDER BY created_at DESC LIMIT $1", limit)


db = Database()
