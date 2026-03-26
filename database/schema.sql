DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'viewer') THEN
        CREATE ROLE viewer;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'editor') THEN
        CREATE ROLE editor;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'administrator') THEN
        CREATE ROLE administrator;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rbac_app') THEN
        CREATE ROLE rbac_app LOGIN PASSWORD 'rbac_app_pass';
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "Thing" (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private'))
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    id SERIAL PRIMARY KEY,
    actor TEXT NOT NULL,
    event TEXT NOT NULL,
    "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE "Thing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO viewer, editor, administrator;
GRANT SELECT ON "Thing" TO viewer;
GRANT SELECT, INSERT, UPDATE ON "Thing" TO editor;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Thing" TO administrator;

GRANT INSERT ON "AuditLog" TO viewer, editor, administrator;
GRANT SELECT ON "AuditLog" TO administrator;
GRANT USAGE, SELECT ON SEQUENCE "Thing_id_seq" TO editor, administrator;
GRANT USAGE, SELECT ON SEQUENCE "AuditLog_id_seq" TO viewer, editor, administrator;

GRANT viewer TO rbac_app;
GRANT editor TO rbac_app;
GRANT administrator TO rbac_app;

TRUNCATE TABLE "Thing" RESTART IDENTITY;
TRUNCATE TABLE "AuditLog" RESTART IDENTITY;

INSERT INTO "Thing" (name, owner, visibility)
VALUES
    ('Public temperature feed', 'admin', 'public'),
    ('Admin incident notes', 'admin', 'private'),
    ('Editor calibration record', 'editor', 'private'),
    ('Public weather alerts', 'viewer', 'public');
