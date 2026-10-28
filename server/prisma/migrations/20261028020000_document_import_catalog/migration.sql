-- CreateTable
CREATE TABLE "book_categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "parent_id" INTEGER,
    CONSTRAINT "book_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "book_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "book_imports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "book_id" INTEGER NOT NULL,
    "source_asset_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sources" TEXT NOT NULL DEFAULT '[]',
    "format" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "total_pages" INTEGER NOT NULL DEFAULT 0,
    "completed_pages" INTEGER NOT NULL DEFAULT 0,
    "warnings" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "book_imports_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "library_books" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "book_imports_source_asset_id_fkey" FOREIGN KEY ("source_asset_id") REFERENCES "media_assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "imported_pages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "import_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "heading" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "source_asset_id" TEXT,
    "source_page_number" INTEGER,
    CONSTRAINT "imported_pages_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "book_imports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_library_books" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'عمومی',
    "category_id" INTEGER,
    "tags" TEXT NOT NULL DEFAULT '',
    "catalog_text" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'fa-IR',
    "cover_tone" TEXT NOT NULL DEFAULT 'sand',
    "cover_asset_id" TEXT,
    "cover_layout" TEXT NOT NULL DEFAULT 'SINGLE',
    "cover_front_side" TEXT NOT NULL DEFAULT 'LEFT',
    "cover_spine_start" REAL NOT NULL DEFAULT 48,
    "cover_spine_end" REAL NOT NULL DEFAULT 52,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "deleted_at" DATETIME,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "library_books_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "book_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "library_books_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "media_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_library_books" ("author", "category", "cover_asset_id", "cover_front_side", "cover_layout", "cover_spine_end", "cover_spine_start", "cover_tone", "created_at", "created_by_id", "description", "id", "is_sample", "language", "status", "title", "updated_at") SELECT "author", "category", "cover_asset_id", "cover_front_side", "cover_layout", "cover_spine_end", "cover_spine_start", "cover_tone", "created_at", "created_by_id", "description", "id", "is_sample", "language", "status", "title", "updated_at" FROM "library_books";
DROP TABLE "library_books";
ALTER TABLE "new_library_books" RENAME TO "library_books";
CREATE INDEX "library_books_status_category_id_idx" ON "library_books"("status", "category_id");
CREATE TABLE "new_library_pages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "book_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "heading" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '',
    "search_text" TEXT NOT NULL DEFAULT '',
    "audio_asset_id" TEXT,
    "source_asset_id" TEXT,
    "source_page_number" INTEGER,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "library_pages_audio_asset_id_fkey" FOREIGN KEY ("audio_asset_id") REFERENCES "media_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "library_pages_source_asset_id_fkey" FOREIGN KEY ("source_asset_id") REFERENCES "media_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "library_pages_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "library_books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_library_pages" ("audio_asset_id", "book_id", "content", "heading", "id", "keywords", "number", "search_text", "updated_at") SELECT "audio_asset_id", "book_id", "content", "heading", "id", "keywords", "number", "search_text", "updated_at" FROM "library_pages";
DROP TABLE "library_pages";
ALTER TABLE "new_library_pages" RENAME TO "library_pages";
CREATE UNIQUE INDEX "library_pages_book_id_number_key" ON "library_pages"("book_id", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "book_categories_key_key" ON "book_categories"("key");

-- CreateIndex
CREATE INDEX "book_imports_status_created_at_idx" ON "book_imports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "imported_pages_import_id_number_key" ON "imported_pages"("import_id", "number");

-- Keep existing books searchable and place their existing labels in root categories.
INSERT OR IGNORE INTO "book_categories" ("name", "key") SELECT DISTINCT "category", '0:' || lower(replace(replace(replace(trim("category"),char(8204),' '),'ي','ی'),'ك','ک')) FROM "library_books" WHERE trim("category") <> '';
UPDATE "library_books" SET "category_id" = (SELECT "id" FROM "book_categories" WHERE "key" = '0:' || lower(replace(replace(replace(trim("library_books"."category"),char(8204),' '),'ي','ی'),'ك','ک'))), "catalog_text" = '';
