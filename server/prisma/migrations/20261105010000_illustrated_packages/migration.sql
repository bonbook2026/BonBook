CREATE TABLE "illustrated_packages" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "book_id" INTEGER NOT NULL,
 "filename" TEXT NOT NULL,
 "size" INTEGER NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'UPLOADING',
 "manifest" TEXT NOT NULL DEFAULT '{}',
 "created_by_id" INTEGER NOT NULL,
 "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" DATETIME NOT NULL,
 "applied_at" DATETIME,
 "applied_start" INTEGER,
 CONSTRAINT "illustrated_packages_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "library_books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "illustrated_packages_book_id_created_at_idx" ON "illustrated_packages"("book_id","created_at");
