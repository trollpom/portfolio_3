CREATE TABLE `rsvps` (
	`id` text PRIMARY KEY NOT NULL,
	`access_token_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`attendance` text NOT NULL,
	`guests` integer NOT NULL,
	`companion_names` text NOT NULL,
	`menu` text NOT NULL,
	`drinks` text NOT NULL,
	`notes` text NOT NULL,
	`consent_at` text NOT NULL,
	`created_at` text NOT NULL
);
