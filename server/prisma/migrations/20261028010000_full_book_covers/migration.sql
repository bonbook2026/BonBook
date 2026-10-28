ALTER TABLE "library_books" ADD COLUMN "cover_layout" TEXT NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "library_books" ADD COLUMN "cover_front_side" TEXT NOT NULL DEFAULT 'LEFT';
ALTER TABLE "library_books" ADD COLUMN "cover_spine_start" REAL NOT NULL DEFAULT 48;
ALTER TABLE "library_books" ADD COLUMN "cover_spine_end" REAL NOT NULL DEFAULT 52;
