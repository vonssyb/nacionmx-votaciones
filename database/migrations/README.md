# Database Migrations

This directory contains all SQL migration scripts for the NacionMX project.

## Naming Convention
All migration files should follow the format:
`YYYYMMDD_HHMM_description.sql`

## Multi-Character Support (2026-02-19)
The scripts `20260219_add_multi_character_support.sql` and `20260219_fix_multi_character_migration.sql` introduce the `character_id` column to key tables and handle Foreign Key dependencies.

## Usage
Run migrations in chronological order.
