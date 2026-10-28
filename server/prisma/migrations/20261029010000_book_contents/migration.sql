CREATE TABLE "book_contents" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "book_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "page_number" INTEGER NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 0,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "book_contents_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "library_books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "book_contents_book_id_position_idx" ON "book_contents"("book_id", "position");
