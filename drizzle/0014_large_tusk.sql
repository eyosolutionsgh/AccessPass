CREATE TYPE "public"."point_kind" AS ENUM('reception', 'security', 'checkpoint', 'exit', 'other');--> statement-breakpoint
CREATE TABLE "device_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"point_id" uuid,
	"user_id" text,
	"signed_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signed_out_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "point" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid,
	"name" text NOT NULL,
	"kind" "point_kind" DEFAULT 'checkpoint' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"point_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "point_assignment_point_user_uq" UNIQUE("point_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "checkpoint_event" ADD COLUMN "point_id" uuid;--> statement-breakpoint
ALTER TABLE "device_profile" ADD COLUMN "point_id" uuid;--> statement-breakpoint
ALTER TABLE "device_session" ADD CONSTRAINT "device_session_point_id_point_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."point"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_session" ADD CONSTRAINT "device_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point" ADD CONSTRAINT "point_facility_id_facility_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_assignment" ADD CONSTRAINT "point_assignment_point_id_point_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."point"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_assignment" ADD CONSTRAINT "point_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_session_device_idx" ON "device_session" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_session_open_idx" ON "device_session" USING btree ("signed_out_at");--> statement-breakpoint
ALTER TABLE "checkpoint_event" ADD CONSTRAINT "checkpoint_event_point_id_point_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."point"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_profile" ADD CONSTRAINT "device_profile_point_id_point_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."point"("id") ON DELETE set null ON UPDATE no action;