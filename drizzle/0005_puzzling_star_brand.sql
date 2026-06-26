CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "incident" ADD COLUMN "embedding" vector(1024);--> statement-breakpoint
CREATE INDEX "incident_embedding_idx" ON "incident" USING hnsw ("embedding" vector_cosine_ops);