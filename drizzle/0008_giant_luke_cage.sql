CREATE TABLE "office" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "host" ADD COLUMN "office_id" uuid;--> statement-breakpoint
ALTER TABLE "office" ADD CONSTRAINT "office_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host" ADD CONSTRAINT "host_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE set null ON UPDATE no action;