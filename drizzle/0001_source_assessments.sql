CREATE TABLE IF NOT EXISTS `source_assessments` (
  `source_id` text NOT NULL REFERENCES `source_assets`(`id`) ON DELETE cascade,
  `target_id` text NOT NULL REFERENCES `application_targets`(`id`) ON DELETE cascade,
  `verdict` text NOT NULL,
  `quality_score` integer NOT NULL,
  `target_match` integer NOT NULL,
  `evidence_level` text NOT NULL,
  `content_type` text NOT NULL,
  `usable_for` text DEFAULT '[]' NOT NULL,
  `relevant_passages` text DEFAULT '[]' NOT NULL,
  `review_reason` text NOT NULL,
  `model_reviewed` integer DEFAULT 0 NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`source_id`, `target_id`)
);
CREATE INDEX IF NOT EXISTS `source_assessments_target_idx` ON `source_assessments` (`target_id`, `verdict`, `quality_score`);
