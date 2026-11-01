ALTER TABLE "library_books" ADD COLUMN "smart_audio_review" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "audio_review_runs" (
 "id" TEXT NOT NULL PRIMARY KEY, "book_id" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'QUEUED',
 "created_by_id" INTEGER NOT NULL, "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" DATETIME NOT NULL,
 CONSTRAINT "audio_review_runs_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "library_books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "audio_review_runs_book_id_created_at_idx" ON "audio_review_runs"("book_id","created_at");
CREATE TABLE "audio_review_items" (
 "id" TEXT NOT NULL PRIMARY KEY, "run_id" TEXT NOT NULL, "page_id" INTEGER NOT NULL, "page_number" INTEGER NOT NULL,
 "source_alignment_id" TEXT NOT NULL, "audio_asset_id" TEXT NOT NULL, "content_hash" TEXT NOT NULL,
 "before_cues" TEXT NOT NULL, "before_mode" TEXT NOT NULL, "after_cues" TEXT, "after_mode" TEXT, "alignment_id" TEXT,
 "status" TEXT NOT NULL DEFAULT 'WAITING', "report" TEXT NOT NULL DEFAULT '{}', "message" TEXT NOT NULL DEFAULT '', "updated_at" DATETIME NOT NULL,
 CONSTRAINT "audio_review_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "audio_review_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "audio_review_items_source_alignment_id_key" ON "audio_review_items"("source_alignment_id");
CREATE INDEX "audio_review_items_run_id_status_idx" ON "audio_review_items"("run_id","status");
