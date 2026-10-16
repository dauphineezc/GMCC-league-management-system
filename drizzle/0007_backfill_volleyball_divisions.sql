-- 0005 was meant to replace slug-only uniqueness with (sport, slug).
-- If that step did not apply, volleyball cannot reuse basketball slugs.
ALTER TABLE "divisions" DROP CONSTRAINT IF EXISTS "divisions_slug_unique";
--> statement-breakpoint
ALTER TABLE "divisions" DROP CONSTRAINT IF EXISTS "divisions_sport_slug_uq";
--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_sport_slug_uq" UNIQUE ("sport", "slug");
--> statement-breakpoint
-- Copy any basketball divisions that volleyball is missing.
INSERT INTO "divisions" ("slug", "name", "sort_order", "sport")
SELECT d."slug", d."name", d."sort_order", 'volleyball'
FROM "divisions" d
WHERE d."sport" = 'basketball'
  AND NOT EXISTS (
    SELECT 1 FROM "divisions" x
    WHERE x."slug" = d."slug" AND x."sport" = 'volleyball'
  );
