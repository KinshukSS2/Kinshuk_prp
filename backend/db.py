import os
from contextlib import asynccontextmanager

import asyncpg


DB_POOL = None


def get_database_url() -> str:
    return os.getenv(
        "RBAC_DATABASE_URL",
        "postgresql://rbac_app:rbac_app_pass@localhost:55432/rbac_prototype",
    )


async def init_db_pool() -> None:
    global DB_POOL
    if DB_POOL is None:
        DB_POOL = await asyncpg.create_pool(get_database_url(), min_size=1, max_size=10)


async def close_db_pool() -> None:
    global DB_POOL
    if DB_POOL is not None:
        await DB_POOL.close()
        DB_POOL = None


@asynccontextmanager
async def get_conn():
    if DB_POOL is None:
        raise RuntimeError("Database pool is not initialized")
    async with DB_POOL.acquire() as conn:
        yield conn
