CREATE TABLE "content_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "expires_at" DATETIME NOT NULL,
  "revoked_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "content_sessions_user_id_expires_at_idx" ON "content_sessions"("user_id", "expires_at");
CREATE TABLE "content_security_events" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER,
  "kind" TEXT NOT NULL,
  "asset_id" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "content_security_events_created_at_idx" ON "content_security_events"("created_at");
