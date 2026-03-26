from fastapi import Header, Query


ROLE_MAP = {
    "admin": "administrator",
    "editor": "editor",
    "viewer": "viewer",
}


def authenticate(username: str) -> dict:
    normalized = (username or "viewer").strip().lower()
    role = ROLE_MAP.get(normalized, "viewer")
    return {"sub": normalized, "role": role}


async def get_current_user(
    user: str | None = Query(default=None, description="Mock user name"),
    x_demo_user: str | None = Header(default=None, alias="X-Demo-User"),
) -> dict:
    username = user or x_demo_user or "viewer"
    return authenticate(username)
