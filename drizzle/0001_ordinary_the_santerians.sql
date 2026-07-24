CREATE TABLE `broadcasts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lobby_id` integer NOT NULL,
	`competition` text NOT NULL,
	`draft_type` text NOT NULL,
	`result_text` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lobby_id`) REFERENCES `lobbies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `broadcasts_lobby_competition_idx` ON `broadcasts` (`lobby_id`,`competition`);--> statement-breakpoint
CREATE INDEX `broadcasts_lobby_created_idx` ON `broadcasts` (`lobby_id`,`created_at`);