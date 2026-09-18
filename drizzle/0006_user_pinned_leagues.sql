CREATE TABLE IF NOT EXISTS "user_pinned_leagues" (
	"user_id" text NOT NULL,
	"league_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_pinned_leagues_user_id_league_id_pk" PRIMARY KEY("user_id","league_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_pinned_leagues" ADD CONSTRAINT "user_pinned_leagues_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_pinned_leagues" ADD CONSTRAINT "user_pinned_leagues_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_pinned_leagues_user_id_idx" ON "user_pinned_leagues" USING btree ("user_id");
