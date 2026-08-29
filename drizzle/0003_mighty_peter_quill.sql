CREATE TABLE `custom_rankings` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`state_json` text NOT NULL,
	`search_text` text NOT NULL,
	`manage_key_hash` text NOT NULL,
	`plays_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_rankings_slug_idx` ON `custom_rankings` (`slug`);--> statement-breakpoint
CREATE INDEX `custom_rankings_created_at_idx` ON `custom_rankings` (`created_at`);