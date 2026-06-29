CREATE TYPE "public"."visit_origin" AS ENUM('appointment', 'walk_in');--> statement-breakpoint
ALTER TABLE "visit" ALTER COLUMN "host_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "visit" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "visit" ADD COLUMN "origin" "visit_origin" DEFAULT 'appointment' NOT NULL;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE set null ON UPDATE no action;