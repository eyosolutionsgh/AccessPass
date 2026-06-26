ALTER TYPE "public"."incident_type" RENAME VALUE 'wrong_premises' TO 'wrong_facility';--> statement-breakpoint
ALTER TABLE "premises" RENAME TO "facility";--> statement-breakpoint
ALTER TABLE "access_zone" RENAME COLUMN "premises_id" TO "facility_id";--> statement-breakpoint
ALTER TABLE "building" RENAME COLUMN "premises_id" TO "facility_id";--> statement-breakpoint
ALTER TABLE "department" RENAME COLUMN "premises_id" TO "facility_id";--> statement-breakpoint
ALTER TABLE "host" RENAME COLUMN "premises_id" TO "facility_id";--> statement-breakpoint
ALTER TABLE "visit" RENAME COLUMN "premises_id" TO "facility_id";--> statement-breakpoint
ALTER TABLE "device_profile" RENAME COLUMN "premises_id" TO "facility_id";--> statement-breakpoint
ALTER TABLE "facility" RENAME CONSTRAINT "premises_organization_id_organization_id_fk" TO "facility_organization_id_organization_id_fk";--> statement-breakpoint
ALTER TABLE "facility" RENAME CONSTRAINT "premises_code_unique" TO "facility_code_unique";--> statement-breakpoint
ALTER TABLE "access_zone" RENAME CONSTRAINT "access_zone_premises_id_premises_id_fk" TO "access_zone_facility_id_facility_id_fk";--> statement-breakpoint
ALTER TABLE "building" RENAME CONSTRAINT "building_premises_id_premises_id_fk" TO "building_facility_id_facility_id_fk";--> statement-breakpoint
ALTER TABLE "department" RENAME CONSTRAINT "department_premises_id_premises_id_fk" TO "department_facility_id_facility_id_fk";--> statement-breakpoint
ALTER TABLE "host" RENAME CONSTRAINT "host_premises_id_premises_id_fk" TO "host_facility_id_facility_id_fk";--> statement-breakpoint
ALTER TABLE "visit" RENAME CONSTRAINT "visit_premises_id_premises_id_fk" TO "visit_facility_id_facility_id_fk";--> statement-breakpoint
ALTER TABLE "device_profile" RENAME CONSTRAINT "device_profile_premises_id_premises_id_fk" TO "device_profile_facility_id_facility_id_fk";--> statement-breakpoint
ALTER TABLE "facility" RENAME CONSTRAINT "premises_pkey" TO "facility_pkey";
