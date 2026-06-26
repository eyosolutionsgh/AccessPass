CREATE TYPE "public"."tag_kind" AS ENUM('number', 'nfc');--> statement-breakpoint
CREATE TABLE "visit_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"tag_id" text NOT NULL,
	"kind" "tag_kind" DEFAULT 'number' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_device_id" text,
	"returned_at" timestamp with time zone,
	"returned_device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visit_tag" ADD CONSTRAINT "visit_tag_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_tag_visit_idx" ON "visit_tag" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "visit_tag_tag_idx" ON "visit_tag" USING btree ("tag_id");