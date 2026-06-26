ALTER TABLE "visit" ADD COLUMN "office_id" uuid;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_host_window_idx" ON "visit" USING btree ("host_id","expected_arrival");