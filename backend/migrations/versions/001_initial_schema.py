"""Initial schema for DRISHTI geospatial platform

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-11-19 23:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Organisations
    op.create_table(
        "organisations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_organisations_slug", "organisations", ["slug"])

    # 2. Users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(150), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="analyst"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_organisation_id", "users", ["organisation_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # 3. Model Registry
    op.create_table(
        "model_registry",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("task", sa.String(100), nullable=False),
        sa.Column("licence", sa.String(100), nullable=False),
        sa.Column("source_url", sa.String(1024), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("local_path", sa.String(1024), nullable=False),
        sa.Column("size_mb", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_model_registry_name", "model_registry", ["name"])

    # 4. Scenes
    op.create_table(
        "scenes",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sensor", sa.String(50), nullable=False),
        sa.Column("product_level", sa.String(50), nullable=False),
        sa.Column("acquisition_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("crs", sa.String(50), nullable=False, server_default="EPSG:4326"),
        sa.Column("footprint", sa.Text(), nullable=True),
        sa.Column("bbox", postgresql.JSONB(), nullable=True),
        sa.Column("cloud_percentage", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("source_path", sa.String(1024), nullable=False),
        sa.Column("size_mb", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("licence", sa.String(255), nullable=False, server_default="Open Access"),
        sa.Column("ingestion_status", sa.String(50), nullable=False, server_default="done"),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("aoi_id", sa.String(100), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_scenes_organisation_id", "scenes", ["organisation_id"])
    op.create_index("ix_scenes_sensor", "scenes", ["sensor"])
    op.create_index("ix_scenes_acquisition_datetime", "scenes", ["acquisition_datetime"])
    op.create_index("ix_scenes_checksum", "scenes", ["checksum"])
    op.create_index("ix_scenes_aoi_id", "scenes", ["aoi_id"])
    op.create_index("ix_scenes_org_sensor_dt", "scenes", ["organisation_id", "sensor", "acquisition_datetime"])

    # 5. Grid Cells
    op.create_table(
        "grid_cells",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("grid_reference", sa.String(100), nullable=False),
        sa.Column("geometry", sa.Text(), nullable=True),
        sa.Column("bbox", postgresql.JSONB(), nullable=True),
        sa.Column("crs", sa.String(50), nullable=False, server_default="EPSG:4326"),
        sa.Column("aoi_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_grid_cells_organisation_id", "grid_cells", ["organisation_id"])
    op.create_index("ix_grid_cells_grid_reference", "grid_cells", ["grid_reference"])
    op.create_index("ix_grid_cells_aoi_id", "grid_cells", ["aoi_id"])

    # 6. Tiles
    op.create_table(
        "tiles",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scene_id", sa.String(100), sa.ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("grid_cell_id", sa.String(100), sa.ForeignKey("grid_cells.id", ondelete="CASCADE"), nullable=False),
        sa.Column("aoi_id", sa.String(100), nullable=True),
        sa.Column("footprint", sa.Text(), nullable=True),
        sa.Column("bbox", postgresql.JSONB(), nullable=True),
        sa.Column("native_crs", sa.String(50), nullable=False, server_default="EPSG:4326"),
        sa.Column("datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sensor", sa.String(50), nullable=False),
        sa.Column("gsd_m", sa.Float(), nullable=False, server_default="10.0"),
        sa.Column("valid_fraction", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("cloud_fraction", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("thumbnail_path", sa.String(1024), nullable=True),
        sa.Column("cog_path", sa.String(1024), nullable=True),
        sa.Column("pixel_window", postgresql.JSONB(), nullable=True),
        sa.Column("embedding_status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("cluster_id", sa.String(100), nullable=True),
        sa.Column("embedding_2d", postgresql.JSONB(), nullable=True),
        sa.Column("concept_terms", postgresql.JSONB(), nullable=True),
        sa.Column("thumb_pattern", sa.String(50), nullable=True, server_default="mixed"),
        sa.Column("thumb_color", sa.String(30), nullable=True, server_default="#3b4252"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tiles_organisation_id", "tiles", ["organisation_id"])
    op.create_index("ix_tiles_scene_id", "tiles", ["scene_id"])
    op.create_index("ix_tiles_grid_cell_id", "tiles", ["grid_cell_id"])
    op.create_index("ix_tiles_aoi_id", "tiles", ["aoi_id"])
    op.create_index("ix_tiles_datetime", "tiles", ["datetime"])
    op.create_index("ix_tiles_sensor", "tiles", ["sensor"])
    op.create_index("ix_tiles_cluster_id", "tiles", ["cluster_id"])

    # 7. Tile Embeddings (vector column)
    op.create_table(
        "tile_embeddings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tile_id", sa.String(100), sa.ForeignKey("tiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model_name", sa.String(100), nullable=False),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("dimension", sa.Integer(), nullable=False),
        sa.Column("embedding", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tile_embeddings_org_model", "tile_embeddings", ["organisation_id", "model_name"])
    op.create_index("ix_tile_embeddings_tile_id", "tile_embeddings", ["tile_id"])

    # 8. Change Jobs
    op.create_table(
        "change_jobs",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.String(150), nullable=False, server_default="analyst"),
        sa.Column("aoi_id", sa.String(100), nullable=True),
        sa.Column("aoi_bbox", postgresql.JSONB(), nullable=True),
        sa.Column("start_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_types", postgresql.JSONB(), nullable=False),
        sa.Column("sensitivity", sa.Float(), nullable=False, server_default="0.55"),
        sa.Column("status", sa.String(50), nullable=False, server_default="queued"),
        sa.Column("current_stage", sa.String(50), nullable=False, server_default="masking"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("funnel_counts", postgresql.JSONB(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.String(1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_change_jobs_organisation_id", "change_jobs", ["organisation_id"])
    op.create_index("ix_change_jobs_status", "change_jobs", ["status"])

    # 9. Change Candidates
    op.create_table(
        "change_candidates",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", sa.String(100), sa.ForeignKey("change_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("aoi_id", sa.String(100), nullable=True),
        sa.Column("grid_cell_id", sa.String(100), sa.ForeignKey("grid_cells.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tile_before_id", sa.String(100), sa.ForeignKey("tiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tile_after_id", sa.String(100), sa.ForeignKey("tiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("geometry", sa.Text(), nullable=True),
        sa.Column("geom_center", postgresql.JSONB(), nullable=True),
        sa.Column("bbox", postgresql.JSONB(), nullable=True),
        sa.Column("area_m2", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("change_type", sa.String(50), nullable=False),
        sa.Column("direction", sa.String(50), nullable=False, server_default="appearance"),
        sa.Column("score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("confidence_factors", postgresql.JSONB(), nullable=True),
        sa.Column("suppression_reason", sa.String(100), nullable=True),
        sa.Column("earliest_interval_start", sa.String(50), nullable=True),
        sa.Column("earliest_interval_end", sa.String(50), nullable=True),
        sa.Column("revisit_gap_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("review_status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("reject_reason", sa.String(50), nullable=True),
        sa.Column("assignee", sa.String(150), nullable=True),
        sa.Column("headline", sa.String(255), nullable=True),
        sa.Column("narrative", sa.String(2048), nullable=True),
        sa.Column("registration_residual_px", sa.Float(), nullable=False, server_default="0.18"),
        sa.Column("seasonal_z_score", sa.Float(), nullable=False, server_default="0.45"),
        sa.Column("sar_agreement", sa.Float(), nullable=False, server_default="0.92"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_change_candidates_organisation_id", "change_candidates", ["organisation_id"])
    op.create_index("ix_change_candidates_job_id", "change_candidates", ["job_id"])
    op.create_index("ix_change_candidates_review_status", "change_candidates", ["review_status"])
    op.create_index("ix_change_candidates_change_type", "change_candidates", ["change_type"])

    # 10. Decisions
    op.create_table(
        "decisions",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", sa.String(100), sa.ForeignKey("change_candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", sa.String(100), nullable=False),
        sa.Column("actor_name", sa.String(150), nullable=False),
        sa.Column("verdict", sa.String(50), nullable=False),
        sa.Column("reason_code", sa.String(100), nullable=True),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_decisions_organisation_id", "decisions", ["organisation_id"])
    op.create_index("ix_decisions_candidate_id", "decisions", ["candidate_id"])

    # 11. Clusters
    op.create_table(
        "clusters",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_saved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("algorithm", sa.String(50), nullable=False, server_default="HDBSCAN"),
        sa.Column("algorithm_version", sa.String(50), nullable=False, server_default="0.8.38"),
        sa.Column("parameters", postgresql.JSONB(), nullable=True),
        sa.Column("centroid_2d", postgresql.JSONB(), nullable=True),
        sa.Column("member_tile_ids", postgresql.JSONB(), nullable=True),
        sa.Column("color", sa.String(50), nullable=False, server_default="#81a1c1"),
        sa.Column("aoi_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_clusters_organisation_id", "clusters", ["organisation_id"])
    op.create_index("ix_clusters_aoi_id", "clusters", ["aoi_id"])

    # 12. Audit Records (Chained hashes)
    op.create_table(
        "audit_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", sa.String(100), nullable=False),
        sa.Column("actor_name", sa.String(150), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("target_id", sa.String(100), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("model_versions", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("previous_hash", sa.String(64), nullable=False),
        sa.Column("record_hash", sa.String(64), unique=True, nullable=False),
    )
    op.create_index("ix_audit_records_org_created", "audit_records", ["organisation_id", "created_at"])
    op.create_index("ix_audit_records_action", "audit_records", ["action"])
    op.create_index("ix_audit_records_target", "audit_records", ["target_type", "target_id"])

    # 13. Ingestion Jobs
    op.create_table(
        "ingestion_jobs",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("organisation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_path", sa.String(1024), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("aoi_id", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="queued"),
        sa.Column("current_stage", sa.String(50), nullable=False, server_default="queued"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("scenes_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tiles_created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("embed_ms", sa.Integer(), nullable=True),
        sa.Column("index_insert_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.String(1024), nullable=True),
        sa.Column("retry_of", sa.String(100), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ingestion_jobs_organisation_id", "ingestion_jobs", ["organisation_id"])
    op.create_index("ix_ingestion_jobs_status", "ingestion_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("ingestion_jobs")
    op.drop_table("audit_records")
    op.drop_table("clusters")
    op.drop_table("decisions")
    op.drop_table("change_candidates")
    op.drop_table("change_jobs")
    op.drop_table("tile_embeddings")
    op.drop_table("tiles")
    op.drop_table("grid_cells")
    op.drop_table("scenes")
    op.drop_table("model_registry")
    op.drop_table("users")
    op.drop_table("organisations")
