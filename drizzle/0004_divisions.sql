CREATE TABLE IF NOT EXISTS "divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "divisions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
INSERT INTO "divisions" ("slug", "name", "sort_order")
VALUES
	('low_b', 'Low B', 0),
	('high_b', 'High B', 1),
	('a', 'A', 2)
ON CONFLICT ("slug") DO NOTHING;
