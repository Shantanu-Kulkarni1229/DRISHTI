import json
from datetime import datetime, timezone
import pytest

from app.models.change import ChangeJob, ChangeCandidate
from app.models.grid_cell import GridCell
from app.models.scene import Scene
from app.models.tile import Tile, TileEmbedding
from app.schemas.changes import ChangeJobCreateRequest
from app.schemas.search import RelevanceFeedbackRequest, SearchQueryRequest
from app.services.change_detection.change_service import ChangeService
from app.services.search.query_service import SearchService


def test_search_service_vector_and_hybrid(db_session, test_user):
    # 1. Seed two scenes and tiles with embeddings
    now = datetime.now(timezone.utc)
    scene = Scene(
        id="scene-srv-search-01",
        organisation_id=test_user.organisation_id,
        sensor="RGB-Aerial",
        product_level="L1C",
        acquisition_datetime=now,
        source_path="/tmp/test1.tif",
        checksum="chk-srv-1",
        licence="Open",
        ingested_at=now,
        aoi_id="aoi-test",
    )
    db_session.add(scene)

    tile1 = Tile(
        id="tile-srv-airplane",
        organisation_id=test_user.organisation_id,
        scene_id=scene.id,
        grid_cell_id="gc-test-01",
        aoi_id="aoi-test",
        bbox=[72.88, 18.98, 72.90, 19.00],
        native_crs="EPSG:4326",
        datetime=now,
        sensor="RGB-Aerial",
        gsd_m=0.3,
        valid_fraction=1.0,
        cloud_fraction=0.0,
        concept_terms=["airplane", "runway", "tarmac"],
    )
    tile2 = Tile(
        id="tile-srv-tanks",
        organisation_id=test_user.organisation_id,
        scene_id=scene.id,
        grid_cell_id="gc-test-02",
        aoi_id="aoi-test",
        bbox=[72.90, 18.98, 72.92, 19.00],
        native_crs="EPSG:4326",
        datetime=now,
        sensor="RGB-Aerial",
        gsd_m=0.3,
        valid_fraction=1.0,
        cloud_fraction=0.0,
        concept_terms=["storagetanks", "fuel", "depot"],
    )
    db_session.add_all([tile1, tile2])
    db_session.commit()

    # Add mock DINOv2 and RemoteCLIP embeddings
    clip_vec1 = [0.9] + [0.0] * 511
    clip_vec2 = [0.0] * 256 + [0.9] + [0.0] * 255
    dino_vec1 = [0.8] + [0.0] * 383
    dino_vec2 = [0.0] * 192 + [0.8] + [0.0] * 191

    emb_clip_1 = TileEmbedding(
        tile_id=tile1.id,
        organisation_id=test_user.organisation_id,
        model_name="remoteclip",
        model_version="ViT-B-32",
        dimension=512,
        embedding=clip_vec1,
    )
    emb_dino_1 = TileEmbedding(
        tile_id=tile1.id,
        organisation_id=test_user.organisation_id,
        model_name="dinov2",
        model_version="ViT-S-14",
        dimension=384,
        embedding=dino_vec1,
    )
    emb_clip_2 = TileEmbedding(
        tile_id=tile2.id,
        organisation_id=test_user.organisation_id,
        model_name="remoteclip",
        model_version="ViT-B-32",
        dimension=512,
        embedding=clip_vec2,
    )
    emb_dino_2 = TileEmbedding(
        tile_id=tile2.id,
        organisation_id=test_user.organisation_id,
        model_name="dinov2",
        model_version="ViT-S-14",
        dimension=384,
        embedding=dino_vec2,
    )
    db_session.add_all([emb_clip_1, emb_dino_1, emb_clip_2, emb_dino_2])
    db_session.commit()

    service = SearchService(db_session)

    # A. Text search
    req_text = SearchQueryRequest(
        query_text="airplane on runway",
        mode="text",
        aoi_id="aoi-test",
        top_k=5,
    )
    res_text = service.execute_search(str(test_user.organisation_id), req_text)
    assert res_text.query_id is not None
    assert len(res_text.results) >= 1

    # B. Image similarity search
    req_img = SearchQueryRequest(
        image_tile_id=tile1.id,
        mode="image",
        aoi_id="aoi-test",
        top_k=5,
    )
    res_img = service.execute_search(str(test_user.organisation_id), req_img)
    assert len(res_img.results) >= 1

    # C. Hybrid blend search
    req_both = SearchQueryRequest(
        query_text="airplane",
        image_tile_id=tile1.id,
        mode="both",
        blend=0.7,
        top_k=5,
    )
    res_both = service.execute_search(str(test_user.organisation_id), req_both)
    assert len(res_both.results) >= 1
    hit = res_both.results[0]
    assert hit.score >= 0.0

    # D. Rocchio Relevance Feedback
    fb_req = RelevanceFeedbackRequest(
        query_id=res_both.query_id,
        tile_id=tile1.id,
        label="good",
    )
    fb_res = service.submit_feedback(
        organisation_id=str(test_user.organisation_id),
        actor_id=str(test_user.id),
        actor_name=test_user.display_name,
        req=fb_req,
    )
    assert fb_res.status == "recorded"
    assert fb_res.feedback_rounds >= 1


def test_change_service_bitemporal_pipeline_and_gauntlet(db_session, test_user):
    # 1. Create a grid cell and 2 co-located temporal tiles (t1 and t2)
    cell = GridCell(
        id="gc-bitemporal-01",
        organisation_id=test_user.organisation_id,
        grid_reference="CELL-01",
    )
    db_session.add(cell)

    t1_dt = datetime(2021, 1, 15, tzinfo=timezone.utc)
    t2_dt = datetime(2023, 6, 20, tzinfo=timezone.utc)

    sc1 = Scene(
        id="sc-bt-1",
        organisation_id=test_user.organisation_id,
        sensor="RGB-Aerial",
        product_level="L1C",
        acquisition_datetime=t1_dt,
        source_path="/path1",
        checksum="chk1",
        ingested_at=t1_dt,
    )
    sc2 = Scene(
        id="sc-bt-2",
        organisation_id=test_user.organisation_id,
        sensor="RGB-Aerial",
        product_level="L1C",
        acquisition_datetime=t2_dt,
        source_path="/path2",
        checksum="chk2",
        ingested_at=t2_dt,
    )
    db_session.add_all([sc1, sc2])
    db_session.commit()

    tile_before = Tile(
        id="tile-bt-before",
        organisation_id=test_user.organisation_id,
        scene_id=sc1.id,
        grid_cell_id=cell.id,
        aoi_id="aoi-chg",
        datetime=t1_dt,
        sensor="RGB-Aerial",
        gsd_m=0.3,
        valid_fraction=0.98,
        cloud_fraction=0.01,
        concept_terms=["grass", "bare", "vegetation"],
    )
    tile_after = Tile(
        id="tile-bt-after",
        organisation_id=test_user.organisation_id,
        scene_id=sc2.id,
        grid_cell_id=cell.id,
        aoi_id="aoi-chg",
        datetime=t2_dt,
        sensor="RGB-Aerial",
        gsd_m=0.3,
        valid_fraction=0.99,
        cloud_fraction=0.01,
        concept_terms=["construction", "building", "structures"],
    )
    db_session.add_all([tile_before, tile_after])
    db_session.commit()

    # DINOv2 embeddings with structural divergence
    dino_before = TileEmbedding(
        tile_id=tile_before.id,
        organisation_id=test_user.organisation_id,
        model_name="dinov2",
        model_version="ViT-S-14",
        dimension=4,
        embedding=[0.9, 0.1, 0.0, 0.0],
    )
    dino_after = TileEmbedding(
        tile_id=tile_after.id,
        organisation_id=test_user.organisation_id,
        model_name="dinov2",
        model_version="ViT-S-14",
        dimension=4,
        embedding=[0.0, 0.1, 0.9, 0.1],
    )
    db_session.add_all([dino_before, dino_after])
    db_session.commit()

    # 2. Run Change Service Pipeline
    service = ChangeService(db_session)
    job_req = ChangeJobCreateRequest(
        aoi_id="aoi-chg",
        date_from="2020-01-01",
        date_to="2024-01-01",
        types=["construction", "clearance"],
        sensitivity=0.60,
    )
    job = service.create_job(
        organisation_id=str(test_user.organisation_id),
        actor=test_user.display_name,
        req=job_req,
    )

    assert job.status == "done"
    assert job.current_stage == "done"
    assert job.progress == 100
    assert job.funnel_counts is not None
    assert "screened" in job.funnel_counts

    # 3. Check created ChangeCandidate
    candidates = (
        db_session.query(ChangeCandidate)
        .filter(ChangeCandidate.job_id == job.id)
        .all()
    )
    assert len(candidates) >= 1
    cand = candidates[0]
    assert cand.tile_before_id == tile_before.id
    assert cand.tile_after_id == tile_after.id
    assert cand.change_type == "construction"
    assert cand.confidence > 0.0
    assert len(cand.confidence_factors) == 7
    assert cand.earliest_interval_start is not None
    assert cand.earliest_interval_end is not None
