-- Remove stored chat text while retaining plans, profiles and operation receipts.
-- Recover legacy proposal IDs before discarding the chat receipts they used.
WITH histories AS (
  SELECT id AS workspace_id, state->'messages' AS messages FROM "PersonalWorkspace"
  UNION ALL
  SELECT "workspaceId", "before"->'messages' FROM "PersonalOperation"
), receipts AS (
  SELECT DISTINCT workspace_id, message
  FROM histories,
       LATERAL jsonb_each(COALESCE(messages, '{}'::jsonb)) AS programs,
       LATERAL jsonb_array_elements(programs.value) AS message
  WHERE message->>'role' = 'assistant' AND message->>'status' = 'success'
)
UPDATE "PersonalOperation" AS operation
SET result = operation.result || jsonb_build_object('proposalRequestId', receipts.message->>'id')
FROM receipts
WHERE operation."workspaceId" = receipts.workspace_id AND operation.kind = 'apply'
  AND operation.result->>'status' = 'success'
  AND operation.result->'revision' = receipts.message->'revision'
  AND operation.result->'edits' = receipts.message->'edits'
  AND NOT operation.result ? 'proposalRequestId';

UPDATE "PersonalWorkspace"
SET state = jsonb_set(state, '{messages}', '{}'::jsonb),
    version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE state ? 'messages' AND state->'messages' <> '{}'::jsonb;

UPDATE "PersonalOperation"
SET "before" = jsonb_set("before", '{messages}', '{}'::jsonb)
WHERE "before" ? 'messages' AND "before"->'messages' <> '{}'::jsonb;
