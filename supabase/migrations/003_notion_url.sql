-- Capture Notion's canonical page URL so deep links resolve to the
-- correct workspace/teamspace. The bare-id form (notion.so/<id>) does
-- not reliably work for teamspace pages.
alter table tasks
  add column if not exists notion_url text;
