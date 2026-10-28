ALTER TABLE "library_pages" ADD COLUMN "image_asset_id" TEXT REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "library_pages" ADD COLUMN "visual_mode" TEXT NOT NULL DEFAULT 'AUTO';
