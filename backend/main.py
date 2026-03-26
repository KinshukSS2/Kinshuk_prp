from datetime import datetime

import asyncpg
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from auth import get_current_user
from db import close_db_pool, get_conn, init_db_pool
from permissions import PERMISSIONS, RoleValidationError, set_local_role


app = FastAPI(title="RBAC Prototype", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ThingCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    visibility: str = Field(pattern="^(public|private)$")


class ThingUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    visibility: str | None = Field(default=None, pattern="^(public|private)$")


@app.on_event("startup")
async def startup_event() -> None:
    await init_db_pool()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await close_db_pool()


async def write_audit(actor: str, event: str) -> None:
    async with get_conn() as conn:
        await conn.execute(
            'INSERT INTO "AuditLog" (actor, event, "timestamp") VALUES ($1, $2, $3)',
            actor,
            event,
            datetime.utcnow(),
        )


async def try_write_audit(actor: str, event: str) -> None:
    try:
        await write_audit(actor, event)
    except Exception:
        return


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/permissions")
async def permissions(user=Depends(get_current_user)) -> dict:
    role = user["role"]
    await try_write_audit(user["sub"], f"login role={role}")
    return {"role": role, "permissions": PERMISSIONS[role]}


@app.get("/permissions/matrix")
async def matrix() -> dict:
    return {
        "administrator": ["SELECT", "INSERT", "UPDATE", "DELETE"],
        "editor": ["SELECT", "INSERT", "UPDATE"],
        "viewer": ["SELECT"],
    }


@app.get("/things")
async def get_things(user=Depends(get_current_user)) -> list[dict]:
    role = user["role"]
    try:
        async with get_conn() as conn:
            async with conn.transaction():
                await set_local_role(conn, role)
                rows = await conn.fetch(
                    'SELECT id, name, owner, visibility FROM "Thing" ORDER BY id'
                )
        return [dict(row) for row in rows]
    except RoleValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/things")
async def create_thing(payload: ThingCreate, user=Depends(get_current_user)) -> dict:
    role = user["role"]
    try:
        async with get_conn() as conn:
            async with conn.transaction():
                await set_local_role(conn, role)
                row = await conn.fetchrow(
                    'INSERT INTO "Thing" (name, owner, visibility) VALUES ($1, $2, $3) RETURNING id, name, owner, visibility',
                    payload.name,
                    user["sub"],
                    payload.visibility,
                )
        await try_write_audit(user["sub"], f"create thing id={row['id']}")
        return dict(row)
    except asyncpg.exceptions.InsufficientPrivilegeError as exc:
        await try_write_audit(user["sub"], "denied create thing")
        raise HTTPException(status_code=403, detail="Action denied by role policy") from exc
    except RoleValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/things/{thing_id}")
async def update_thing(thing_id: int, payload: ThingUpdate, user=Depends(get_current_user)) -> dict:
    role = user["role"]
    if payload.name is None and payload.visibility is None:
        raise HTTPException(status_code=400, detail="Nothing to update")

    columns = []
    values = []
    idx = 1
    if payload.name is not None:
        columns.append(f"name = ${idx}")
        values.append(payload.name)
        idx += 1
    if payload.visibility is not None:
        columns.append(f"visibility = ${idx}")
        values.append(payload.visibility)
        idx += 1

    values.append(thing_id)
    update_sql = (
        f'UPDATE "Thing" SET {", ".join(columns)} WHERE id = ${idx} '
        'RETURNING id, name, owner, visibility'
    )

    try:
        async with get_conn() as conn:
            async with conn.transaction():
                await set_local_role(conn, role)
                row = await conn.fetchrow(update_sql, *values)
        if row is None:
            raise HTTPException(status_code=404, detail="Thing not found or not allowed")
        await try_write_audit(user["sub"], f"update thing id={thing_id}")
        return dict(row)
    except asyncpg.exceptions.InsufficientPrivilegeError as exc:
        await try_write_audit(user["sub"], f"denied update thing id={thing_id}")
        raise HTTPException(status_code=403, detail="Action denied by role policy") from exc
    except RoleValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/things/{thing_id}")
async def delete_thing(thing_id: int, user=Depends(get_current_user)) -> dict:
    role = user["role"]
    try:
        async with get_conn() as conn:
            async with conn.transaction():
                await set_local_role(conn, role)
                status = await conn.execute('DELETE FROM "Thing" WHERE id = $1', thing_id)
        deleted = int(status.split(" ")[-1])
        if deleted == 0:
            raise HTTPException(status_code=404, detail="Thing not found or not allowed")
        await try_write_audit(user["sub"], f"delete thing id={thing_id}")
        return {"deleted": deleted}
    except asyncpg.exceptions.InsufficientPrivilegeError as exc:
        await try_write_audit(user["sub"], f"denied delete thing id={thing_id}")
        raise HTTPException(status_code=403, detail="Action denied by role policy") from exc
    except RoleValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/audit")
async def get_audit(limit: int = 25, user=Depends(get_current_user)) -> list[dict]:
    role = user["role"]
    safe_limit = max(1, min(limit, 200))
    try:
        async with get_conn() as conn:
            async with conn.transaction():
                await set_local_role(conn, role)
                rows = await conn.fetch(
                    'SELECT id, actor, event, "timestamp" FROM "AuditLog" ORDER BY id DESC LIMIT $1',
                    safe_limit,
                )
        return [dict(row) for row in rows]
    except asyncpg.exceptions.InsufficientPrivilegeError as exc:
        await try_write_audit(user["sub"], "denied read audit")
        raise HTTPException(status_code=403, detail="Action denied by role policy") from exc
    except RoleValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
