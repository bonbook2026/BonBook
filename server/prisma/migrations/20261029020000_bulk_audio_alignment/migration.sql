ALTER TABLE "library_pages" ADD COLUMN "audio_cue_mode" TEXT NOT NULL DEFAULT 'NONE';
UPDATE "library_pages" SET "audio_cue_mode"='MANUAL' WHERE "audio_cues"!='[]';
CREATE TABLE "audio_batches" (
 "id" TEXT NOT NULL PRIMARY KEY, "book_id" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'UPLOADING',
 "auto_align" BOOLEAN NOT NULL DEFAULT true, "replace_existing" BOOLEAN NOT NULL DEFAULT false,
 "created_by_id" INTEGER NOT NULL, "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("book_id") REFERENCES "library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "audio_batches_book_id_created_at_idx" ON "audio_batches"("book_id","created_at");
CREATE TABLE "audio_batch_items" (
 "id" TEXT NOT NULL PRIMARY KEY, "batch_id" TEXT NOT NULL, "page_number" INTEGER NOT NULL,
 "filename" TEXT NOT NULL, "size" INTEGER NOT NULL, "expected_asset_id" TEXT, "asset_id" TEXT,
 "status" TEXT NOT NULL DEFAULT 'WAITING', "error" TEXT,
 FOREIGN KEY ("batch_id") REFERENCES "audio_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "audio_batch_items_batch_id_page_number_key" ON "audio_batch_items"("batch_id","page_number");
CREATE TABLE "audio_alignments" (
 "id" TEXT NOT NULL PRIMARY KEY, "page_id" INTEGER NOT NULL, "audio_asset_id" TEXT NOT NULL,
 "content_hash" TEXT NOT NULL, "previous_cues" TEXT NOT NULL DEFAULT '[]', "status" TEXT NOT NULL DEFAULT 'QUEUED',
 "progress" REAL NOT NULL DEFAULT 0, "attempts" INTEGER NOT NULL DEFAULT 0,
 "coverage" REAL NOT NULL DEFAULT 0, "line_coverage" REAL NOT NULL DEFAULT 0, "duration" REAL NOT NULL DEFAULT 0,
 "words" TEXT NOT NULL DEFAULT '[]', "cues" TEXT NOT NULL DEFAULT '[]', "candidates" TEXT NOT NULL DEFAULT '[]',
 "warning" TEXT NOT NULL DEFAULT '', "error" TEXT, "model" TEXT NOT NULL DEFAULT 'faster-whisper-small',
 "created_by_id" INTEGER NOT NULL, "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" DATETIME NOT NULL,
 FOREIGN KEY ("page_id") REFERENCES "library_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("audio_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "audio_alignments_status_created_at_idx" ON "audio_alignments"("status","created_at");
CREATE INDEX "audio_alignments_page_id_created_at_idx" ON "audio_alignments"("page_id","created_at");
