alter table spaces drop column container_id;

alter index spaces_pkey rename to user_sprites_pkey;
alter index spaces_name_key rename to user_sprites_name_key;
alter index spaces_user_id_idx rename to user_sprites_user_id_idx;
alter table spaces rename to user_sprites;
