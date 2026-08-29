CREATE TABLE `blind_ranking_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`state_json` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blind_ranking_rooms_updated_at_idx` ON `blind_ranking_rooms` (`updated_at`);