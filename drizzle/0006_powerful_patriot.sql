CREATE TYPE "public"."checkpoint_event_kind" AS ENUM('check_in', 'check_out', 'passage');--> statement-breakpoint
CREATE TABLE "checkpoint_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"device_id" text,
	"kind" "checkpoint_event_kind" NOT NULL,
	"method" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"label" text,
	"premises_id" uuid,
	"profile" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_profile_deviceId_unique" UNIQUE("device_id")
);
--> statement-breakpoint
ALTER TABLE "checkpoint_event" ADD CONSTRAINT "checkpoint_event_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_profile" ADD CONSTRAINT "device_profile_premises_id_premises_id_fk" FOREIGN KEY ("premises_id") REFERENCES "public"."premises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkpoint_event_visit_idx" ON "checkpoint_event" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "checkpoint_event_device_idx" ON "checkpoint_event" USING btree ("device_id");