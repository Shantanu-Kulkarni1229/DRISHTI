"""Add pgvector Vector type and partial HNSW indexes

Revision ID: 002_vector_and_spatial_indexes
Revises: 001_initial_schema
Create Date: 2026-11-20 01:21:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "002_vector_and_spatial_indexes"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # 1. Convert tile_embeddings.embedding from JSONB to unconstrained pgvector Vector
        op.execute(
            """
            ALTER TABLE tile_embeddings 
            ALTER COLUMN embedding TYPE vector 
            USING NULL;
            """
        )

        # 2. Add Unique constraint (tile_id, model_name, model_version)
        op.execute(
            """
            ALTER TABLE tile_embeddings 
            ADD CONSTRAINT uq_tile_embeddings_model_version 
            UNIQUE (tile_id, model_name, model_version);
            """
        )

        # 3. Create partial HNSW indexes for RemoteCLIP and DINOv2
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_tile_embeddings_remoteclip_hnsw
            ON tile_embeddings USING hnsw ((embedding::vector(768)) vector_cosine_ops)
            WHERE model_name = 'RemoteCLIP' AND dimension = 768;
            """
        )
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_tile_embeddings_dinov2_hnsw
            ON tile_embeddings USING hnsw ((embedding::vector(768)) vector_cosine_ops)
            WHERE model_name = 'DINOv2' AND dimension = 768;
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_tile_embeddings_dinov2_hnsw;")
        op.execute("DROP INDEX IF EXISTS ix_tile_embeddings_remoteclip_hnsw;")
        op.execute("ALTER TABLE tile_embeddings DROP CONSTRAINT IF EXISTS uq_tile_embeddings_model_version;")
        op.execute(
            """
            ALTER TABLE tile_embeddings 
            ALTER COLUMN embedding TYPE jsonb 
            USING NULL;
            """
        )
