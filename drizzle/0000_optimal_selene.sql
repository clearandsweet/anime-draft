CREATE TABLE `lobbies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`state_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`host_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`players_count` integer DEFAULT 0 NOT NULL,
	`last_pick_at` text,
	`manage_key_hash` text,
	`draft_type` text DEFAULT 'anime' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lobbies_updated_at_idx` ON `lobbies` (`updated_at`);--> statement-breakpoint
CREATE INDEX `lobbies_status_type_idx` ON `lobbies` (`status`,`draft_type`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`lobby_id` integer NOT NULL,
	`ip_hash` text NOT NULL,
	`first` text,
	`second` text,
	`third` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lobby_id`) REFERENCES `lobbies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `votes_lobby_ip_idx` ON `votes` (`lobby_id`,`ip_hash`);--> statement-breakpoint
CREATE INDEX `votes_lobby_created_idx` ON `votes` (`lobby_id`,`created_at`);