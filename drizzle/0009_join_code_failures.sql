CREATE TABLE "join_code_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "join_code_failures_user_id_idx" ON "join_code_failures" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "join_code_failures_ip_idx" ON "join_code_failures" USING btree ("ip","created_at");