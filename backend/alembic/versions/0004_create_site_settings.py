"""create site_settings table

Revision ID: 0004_create_site_settings
Revises: 0003_create_storage
Create Date: 2026-09-21
"""

import sqlalchemy as sa
from alembic import op

revision = "0004_create_site_settings"
down_revision = "0003_create_storage"
branch_labels = None
depends_on = None

DEFAULT_THEME = {
    "mode": "system",
    "accent": "violet",
    "radius": 16,
    "blur": 12,
    "background": {"type": "gradient", "value": "aurora"},
}


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_site_settings")),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    settings_table = sa.table(
        "site_settings",
        sa.column("key", sa.String),
        sa.column("value", sa.JSON),
    )
    op.bulk_insert(settings_table, [{"key": "theme", "value": DEFAULT_THEME}])


def downgrade() -> None:
    op.drop_table("site_settings")
