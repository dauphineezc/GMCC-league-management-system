-- Sport-scoped division catalogs (basketball ≠ volleyball).
ALTER TABLE "divisions" ADD COLUMN IF NOT EXISTS "sport" text;
--> statement-breakpoint
UPDATE "divisions" SET "sport" = 'basketball' WHERE "sport" IS NULL;
--> statement-breakpoint
INSERT INTO "divisions" ("slug", "name", "sort_order", "sport")
SELECT d."slug", d."name", d."sort_order", 'volleyball'
FROM "divisions" d
WHERE d."sport" = 'basketball'
  AND NOT EXISTS (
    SELECT 1 FROM "divisions" x
    WHERE x."slug" = d."slug" AND x."sport" = 'volleyball'
  );
--> statement-breakpoint
ALTER TABLE "divisions" ALTER COLUMN "sport" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "divisions" DROP CONSTRAINT IF EXISTS "divisions_slug_unique";
--> statement-breakpoint
ALTER TABLE "divisions" DROP CONSTRAINT IF EXISTS "divisions_sport_slug_uq";
--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_sport_slug_uq" UNIQUE ("sport", "slug");
