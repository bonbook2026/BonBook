CREATE TABLE "illustrated_scenes" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "page_id" INTEGER NOT NULL,
 "position" INTEGER NOT NULL,
 "start" INTEGER NOT NULL,
 "end" INTEGER NOT NULL,
 "title" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "shot" TEXT NOT NULL,
 "motion" TEXT NOT NULL,
 "effect" TEXT NOT NULL,
 "actor_motion" TEXT NOT NULL DEFAULT 'breathe',
 "content_hash" TEXT NOT NULL,
 "image_asset_id" TEXT,
 "foreground_asset_id" TEXT,
 CONSTRAINT "illustrated_scenes_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "library_pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "illustrated_scenes_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "media_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT "illustrated_scenes_foreground_asset_id_fkey" FOREIGN KEY ("foreground_asset_id") REFERENCES "media_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "illustrated_scenes_page_id_position_key" ON "illustrated_scenes"("page_id", "position");
CREATE INDEX "illustrated_scenes_image_asset_id_idx" ON "illustrated_scenes"("image_asset_id");
CREATE INDEX "illustrated_scenes_foreground_asset_id_idx" ON "illustrated_scenes"("foreground_asset_id");
