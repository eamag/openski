CREATE TABLE `snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`resort` text NOT NULL,
	`markdown` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `snapshot_created_idx` ON `snapshot` (`created_at`);