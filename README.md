# RBAC Prototype (Standalone Submission)

Hi! This is a small, standalone RBAC prototype I built to demonstrate end-to-end role-based behavior with PostgreSQL RLS and a role-aware admin dashboard UI.

The core idea is simple:

`Login -> Role -> SET LOCAL ROLE -> RLS -> Filtered Data -> UI adapts`

## What this prototype shows

- Role-based access enforced in the database using PostgreSQL RLS
- Frontend UI that changes immediately based on role
- Admin-only audit log visibility
- A clear Permission Matrix panel for quick reference

## Project layout

- [backend](backend): FastAPI + asyncpg
- [database](database): schema, roles, grants, and RLS policies
- [frontend](frontend): dashboard UI (Things, Audit Logs, Permission Matrix)
- [docker-compose.yml](docker-compose.yml): isolated PostgreSQL service

## Quick setup

Start from this folder:

```bash
cd /home/deadpool/ist/rbac-prototype-submission
```

### 1) Start PostgreSQL

```bash
docker compose up -d
```

### 2) Apply DB schema and policies

```bash
psql "postgresql://postgres:postgres@localhost:55432/rbac_prototype" -f database/schema.sql
psql "postgresql://postgres:postgres@localhost:55432/rbac_prototype" -f database/policies.sql
```

### 3) Start backend

```bash
cd backend
source /home/deadpool/ist/istSOS4/.venv/bin/activate
pip install -r requirements.txt
export RBAC_DATABASE_URL="postgresql://rbac_app:rbac_app_pass@localhost:55432/rbac_prototype"
uvicorn main:app --reload --port 8001
```

### 4) Start frontend

Open a new terminal:

```bash
cd /home/deadpool/ist/rbac-prototype-submission/frontend
python -m http.server 5174
```

Then open: `http://localhost:5174`

## 5-minute reviewer flow

If you’re reviewing quickly, here’s the easiest path:

1. Login as **Viewer**
   - Sees only public rows
   - No create/update/delete actions
   - Audit Logs tab is hidden

2. Login as **Editor**
   - Can create
   - Can update only own rows
   - Cannot delete
   - Audit Logs tab is hidden

3. Login as **Admin**
   - Full CRUD on Things
   - Audit Logs tab is visible and loads data

4. Open **Permission Matrix**
   - Shows the role-to-action mapping clearly

## API endpoints used by UI

- `GET /health`
- `GET /permissions?user=<admin|editor|viewer>`
- `GET /permissions/matrix`
- `GET /things?user=<...>`
- `POST /things?user=<...>`
- `PATCH /things/{id}?user=<...>`
- `DELETE /things/{id}?user=<...>`
- `GET /audit?user=<...>&limit=<1..200>`

## RBAC behavior summary

- **viewer**: read public Things only
- **editor**: read public + own, create/update own, no delete
- **administrator**: full CRUD + audit read

Audit access is enforced on the backend (`403` for non-admin), and the Audit tab is hidden in the UI for non-admin users.

## Quick validation commands

```bash
curl "http://localhost:8001/health"
curl "http://localhost:8001/permissions?user=admin"
curl "http://localhost:8001/things?user=viewer"
curl "http://localhost:8001/audit?user=admin&limit=5"
curl -i "http://localhost:8001/audit?user=viewer&limit=5"
```

Expected: the last command should return `403`.

## Troubleshooting

- If the UI appears unresponsive, first check backend:

```bash
curl http://localhost:8001/health
```

- If frontend changes don’t appear, do a hard refresh (`Ctrl+Shift+R`).
- If data looks inconsistent, re-run schema then policies in that order.
- If port `8001` is occupied, stop the running process and restart uvicorn.
