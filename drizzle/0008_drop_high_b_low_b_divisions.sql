-- Remove legacy high_b / low_b catalog rows (all sports).
-- League/team records may still store these slugs as text; they are no longer
-- offered in filters or the editable catalog.
DELETE FROM "divisions"
WHERE "slug" IN ('high_b', 'low_b');
