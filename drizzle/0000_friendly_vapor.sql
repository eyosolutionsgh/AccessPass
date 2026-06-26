CREATE TYPE "public"."access_permission_status" AS ENUM('pending', 'active', 'disabled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."audit_result" AS ENUM('success', 'failure', 'denied');--> statement-breakpoint
CREATE TYPE "public"."check_event_method" AS ENUM('qr', 'code', 'reception', 'security', 'host', 'kiosk', 'bulk');--> statement-breakpoint
CREATE TYPE "public"."credential_status" AS ENUM('issued', 'active', 'disabled', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('nda', 'privacy_notice', 'site_rules', 'safety_induction', 'permit', 'insurance', 'work_authorization', 'id_document', 'photo', 'other');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('open', 'in_review', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('watchlist_match', 'denied_entry', 'duplicate_attempt', 'expired_code', 'invalid_code', 'wrong_premises', 'overstay', 'policy_breach', 'other');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('active', 'expired', 'revoked', 'used', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'push', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."prereg_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."visit_status" AS ENUM('draft', 'pending_approval', 'approved', 'invitation_sent', 'pre_registered', 'checked_in', 'checked_out', 'cancelled', 'expired', 'denied', 'no_show');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_zone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"premises_id" uuid NOT NULL,
	"building_id" uuid,
	"name" text NOT NULL,
	"escort_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "building" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"premises_id" uuid NOT NULL,
	"name" text NOT NULL,
	"floors" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"premises_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "premises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "premises_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "host" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"user_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"department_id" uuid,
	"premises_id" uuid,
	"external_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"organization" text,
	"email" text,
	"phone" text,
	"id_reference_enc" text,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"required_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"requires_escort" boolean DEFAULT false NOT NULL,
	"requires_induction" boolean DEFAULT false NOT NULL,
	"badge_template" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"match_type" text NOT NULL,
	"match_value_hash" text NOT NULL,
	"reason" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pre_registration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"status" "prereg_status" DEFAULT 'not_started' NOT NULL,
	"submitted_at" timestamp with time zone,
	"required_fields_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"policy_ack_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"consent_given" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" uuid NOT NULL,
	"host_id" uuid NOT NULL,
	"premises_id" uuid NOT NULL,
	"category_id" uuid,
	"purpose" text,
	"status" "visit_status" DEFAULT 'draft' NOT NULL,
	"expected_arrival" timestamp with time zone,
	"expected_departure" timestamp with time zone,
	"duration_minutes" integer,
	"requested_zone_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"escort_required" text,
	"created_by" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"denial_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"qr_token_hash" text NOT NULL,
	"status" "invitation_status" DEFAULT 'active' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"allowed_from" timestamp with time zone,
	"allowed_until" timestamp with time zone,
	"resend_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"escort_required" boolean DEFAULT false NOT NULL,
	"status" "access_permission_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_in_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"time_in" timestamp with time zone DEFAULT now() NOT NULL,
	"time_out" timestamp with time zone,
	"check_in_method" "check_event_method" NOT NULL,
	"check_out_method" "check_event_method",
	"check_in_location" text,
	"check_out_location" text,
	"device_id" text,
	"processed_by" text,
	"self_service" boolean DEFAULT false NOT NULL,
	"identity_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"badge_number" text NOT NULL,
	"qr_badge_token_hash" text,
	"access_card_id" text,
	"status" "credential_status" DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"object_type" text,
	"object_id" text,
	"result" "audit_result" DEFAULT 'success' NOT NULL,
	"source_ip" text,
	"device_id" text,
	"metadata" jsonb,
	"prev_hash" text,
	"hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid,
	"visitor_id" uuid,
	"type" "document_type" NOT NULL,
	"version" text,
	"signed_at" timestamp with time zone,
	"storage_reference" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid,
	"type" "incident_type" NOT NULL,
	"severity" "incident_severity" DEFAULT 'low' NOT NULL,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"description" text,
	"metadata" jsonb,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid,
	"recipient" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"template" text,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_zone" ADD CONSTRAINT "access_zone_premises_id_premises_id_fk" FOREIGN KEY ("premises_id") REFERENCES "public"."premises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_zone" ADD CONSTRAINT "access_zone_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building" ADD CONSTRAINT "building_premises_id_premises_id_fk" FOREIGN KEY ("premises_id") REFERENCES "public"."premises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department" ADD CONSTRAINT "department_premises_id_premises_id_fk" FOREIGN KEY ("premises_id") REFERENCES "public"."premises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premises" ADD CONSTRAINT "premises_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host" ADD CONSTRAINT "host_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host" ADD CONSTRAINT "host_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host" ADD CONSTRAINT "host_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host" ADD CONSTRAINT "host_premises_id_premises_id_fk" FOREIGN KEY ("premises_id") REFERENCES "public"."premises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_category" ADD CONSTRAINT "visitor_category_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_entry" ADD CONSTRAINT "watchlist_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_entry" ADD CONSTRAINT "watchlist_entry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_registration" ADD CONSTRAINT "pre_registration_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_visitor_id_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_host_id_host_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."host"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_premises_id_premises_id_fk" FOREIGN KEY ("premises_id") REFERENCES "public"."premises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_category_id_visitor_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."visitor_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_invitation" ADD CONSTRAINT "visit_invitation_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_permission" ADD CONSTRAINT "access_permission_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_permission" ADD CONSTRAINT "access_permission_zone_id_access_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."access_zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_processed_by_user_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential" ADD CONSTRAINT "credential_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_record" ADD CONSTRAINT "document_record_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_record" ADD CONSTRAINT "document_record_visitor_id_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE cascade ON UPDATE no action;