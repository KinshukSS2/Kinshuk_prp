import re


PERMISSIONS = {
    "administrator": ["create", "read", "update", "delete"],
    "editor": ["create", "read", "update"],
    "viewer": ["read"],
}

_ALLOWED_ROLES = set(PERMISSIONS.keys())
_IDENTIFIER_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')


class RoleValidationError(ValueError):
    pass


def _quote_identifier(identifier: str) -> str:
    if not _IDENTIFIER_RE.fullmatch(identifier):
        raise RoleValidationError("Invalid role identifier")
    return '"' + identifier.replace('"', '""') + '"'


def validate_role(role: str) -> str:
    normalized = (role or "").strip()
    if normalized not in _ALLOWED_ROLES:
        raise RoleValidationError("Unsupported role")
    return normalized


async def set_local_role(conn, role: str) -> str:
    safe_role = validate_role(role)
    quoted = _quote_identifier(safe_role)
    await conn.execute(f"SET LOCAL ROLE {quoted}")
    return safe_role
