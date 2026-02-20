    -- 0. CLEANUP: Delete existing duplicates physically so the index can be created.
    -- We keep the OLDEST record (ordered by id) and delete the newer duplicates.
    DELETE FROM public.sanctions
    WHERE id IN (
        SELECT id
        FROM (
            SELECT id,
                ROW_NUMBER() OVER (
                    PARTITION BY discord_user_id, moderator_id, reason, date_trunc('minute', created_at AT TIME ZONE 'UTC')
                    ORDER BY id ASC
                ) as row_num
            FROM public.sanctions
        ) t
        WHERE t.row_num > 1
    );

    -- 1. Create a unique index that allows only ONE sanction per user, per moderator, per reason, PER MINUTE.
    CREATE UNIQUE INDEX IF NOT EXISTS unique_sanction_per_minute 
    ON public.sanctions (
        discord_user_id, 
        moderator_id, 
        reason, 
        (date_trunc('minute', created_at AT TIME ZONE 'UTC'))
    );
