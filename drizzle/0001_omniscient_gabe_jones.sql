ALTER TABLE "leagues" ADD COLUMN "team_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "team_fee_paid" boolean DEFAULT false NOT NULL;