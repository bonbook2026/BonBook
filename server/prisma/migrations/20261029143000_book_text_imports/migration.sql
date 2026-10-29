CREATE TABLE "book_text_imports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "book_id" INTEGER NOT NULL,
    "source_names" TEXT NOT NULL,
    "page_offset" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "items" TEXT NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" DATETIME,
    CONSTRAINT "book_text_imports_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "library_books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "book_text_imports_book_id_created_at_idx" ON "book_text_imports"("book_id", "created_at");
