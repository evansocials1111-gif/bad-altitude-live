-- Characters reply to the shared live chat, not only to queued questions.
alter table chat_messages add column if not exists replied_at timestamptz;
alter table character_responses add column if not exists chat_message_id uuid references chat_messages(id) on delete set null;
create index if not exists chat_unreplied_idx on chat_messages (created_at) where replied_at is null and hidden = false;
update admin_settings set value = value || '{"chatRepliesEnabled": true, "chatReplyCooldownSeconds": 8}'::jsonb where key = 'show';
