DROP POLICY IF EXISTS viewer_select ON "Thing";
DROP POLICY IF EXISTS editor_select ON "Thing";
DROP POLICY IF EXISTS editor_insert ON "Thing";
DROP POLICY IF EXISTS editor_update ON "Thing";
DROP POLICY IF EXISTS editor_delete ON "Thing";
DROP POLICY IF EXISTS admin_all ON "Thing";
DROP POLICY IF EXISTS audit_insert ON "AuditLog";
DROP POLICY IF EXISTS audit_admin_read ON "AuditLog";

CREATE POLICY viewer_select ON "Thing"
FOR SELECT TO viewer
USING (visibility = 'public');

CREATE POLICY editor_select ON "Thing"
FOR SELECT TO editor
USING (owner = current_user OR visibility = 'public');

CREATE POLICY editor_insert ON "Thing"
FOR INSERT TO editor
WITH CHECK (owner = current_user);

CREATE POLICY editor_update ON "Thing"
FOR UPDATE TO editor
USING (owner = current_user)
WITH CHECK (owner = current_user);

CREATE POLICY admin_all ON "Thing"
FOR ALL TO administrator
USING (true)
WITH CHECK (true);

CREATE POLICY audit_insert ON "AuditLog"
FOR INSERT TO viewer, editor, administrator
WITH CHECK (true);

CREATE POLICY audit_admin_read ON "AuditLog"
FOR SELECT TO administrator
USING (true);
