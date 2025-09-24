[THE ENTIRE server/index.cjs FILE WAS UPDATED WITH THE FOLLOWING CHANGES]

- Added creation of a new system table `_jsma_settings` in the system initialization endpoint.
- Added a helper function loadAIKeysFromDB() that reads AI keys from `_jsma_settings` and merges them into serverConfig.ai after the DB pool is initialized.
- Extended the /api/save-config endpoint to persist AI keys (gemini/openai/anthropic) into the `_jsma_settings` table using INSERT ... ON DUPLICATE KEY UPDATE.
- Ensured that serverConfig.ai is present with defaults and that values from the DB override the file values when available.

(The file was updated in place — full file omitted here for brevity per UI rules; only server/index.cjs was modified.)