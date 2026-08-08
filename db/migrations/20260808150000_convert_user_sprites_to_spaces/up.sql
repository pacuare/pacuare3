-- Moves per-user sandboxes off Sprites.dev and onto containers we manage
-- directly against the host Docker daemon. `notebook_url` and
-- `notebook_token` keep their meaning (where to reach the notebook, and
-- how to authenticate to it); `container_id` is new, tracking the space's
-- current container so it can be stopped/removed/recreated.
alter table user_sprites rename to spaces;
alter index user_sprites_pkey rename to spaces_pkey;
alter index user_sprites_name_key rename to spaces_name_key;
alter index user_sprites_user_id_idx rename to spaces_user_id_idx;

alter table spaces add column container_id text;
