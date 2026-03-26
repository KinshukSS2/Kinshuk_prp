# RBAC Prototype (Standalone)

This prototype is isolated from the main istSOS services and demonstrates:

`Login -> Role -> SET LOCAL ROLE -> RLS -> Filtered Data -> UI adapts`

## Structure

- `backend/` FastAPI + asyncpg
- `database/` schema + RLS policies
- `frontend/` minimal role-aware UI
- `docker-compose.yml` isolated PostgreSQL service

## 1) Start isolated database

```bash
cd /home/deadpool/ist/istSOS4/rbac-prototype
docker compose up -d
```

## 2) Apply SQL (schema then policies)

```bash
psql "postgresql://postgres:postgres@localhost:55432/rbac_prototype" -f database/schema.sql
psql "postgresql://postgres:postgres@localhost:55432/rbac_prototype" -f database/policies.sql
```

## 3) Run backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export RBAC_DATABASE_URL="postgresql://rbac_app:rbac_app_pass@localhost:55432/rbac_prototype"
uvicorn main:app --reload --port 8001
```

## 4) Run frontend

Open a new terminal:

```bash
cd /home/deadpool/ist/istSOS4/rbac-prototype/frontend
python -m http.server 5174
```

Open: `http://localhost:5174`

## Day mapping

- Day 1: `database/schema.sql`, `database/policies.sql`
- Day 2: `backend/main.py`, `backend/auth.py`, `backend/permissions.py`, `backend/db.py`
- Day 3: `frontend/index.html`, `frontend/app.js`
- Day 4: `GET /permissions/matrix`
- Day 5: `AuditLog` + write/read endpoints

## Quick API checks

```bash
curl "http://localhost:8001/permissions?user=viewer"
curl "http://localhost:8001/permissions?user=editor"
curl "http://localhost:8001/permissions?user=admin"

curl "http://localhost:8001/things?user=viewer"
curl "http://localhost:8001/things?user=editor"
curl "http://localhost:8001/things?user=admin"

curl "http://localhost:8001/permissions/matrix"
curl "http://localhost:8001/audit"
```

## Expected behavior

- `viewer`: can only read public rows
- `editor`: can read public + own rows, create/update own, cannot delete
- `administrator`: full CRUD and audit read

## Troubleshooting

If the page loads but role buttons appear to do nothing:

1. Check backend is running:

```bash
curl http://localhost:8001/health
```

Expected: `{"status":"ok"}`

2. Verify frontend can reach backend from browser:
- Open the page and click a role button.
- If there is a problem, an error message now appears directly on the page.

3. Confirm DB schema and policies were applied in order:

```bash
psql "postgresql://postgres:postgres@localhost:55432/rbac_prototype" -f database/schema.sql
psql "postgresql://postgres:postgres@localhost:55432/rbac_prototype" -f database/policies.sql
```

4. Restart backend after code changes:

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8001
```

5. Hard refresh frontend (`Ctrl+Shift+R`) to reload updated JS/CSS.

Common causes:
- Backend not running on `http://localhost:8001`
- Database container not healthy
- SQL files not applied (or applied in wrong order)
- Stale browser assets after frontend changes
