ALTER TABLE "notification" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "next_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "delivered_at" timestamp with time zone;