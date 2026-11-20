from app.services.change_detection.suppression_gauntlet import CandidateSignals, SuppressionGauntlet


def test_gauntlet_passes_genuine_construction():
    gauntlet = SuppressionGauntlet(sensitivity=0.55)
    signals = CandidateSignals(
        candidate_id="cand-real",
        grid_cell_id="cell-1",
        tile_before_id="tb",
        tile_after_id="ta",
        area_m2=3500.0,
        raw_model_score=0.91,
        valid_fraction=1.0,
        cloud_fraction=0.02,
        registration_residual_px=0.15,
        seasonal_z_score=0.35,
        later_usable_detections=3,
        sar_agreement=0.94,
    )
    result = gauntlet.evaluate(signals)
    assert result.passed is True
    assert result.calibrated_confidence > 0.80
    assert len(result.factors) == 7


def test_gauntlet_rejects_cloud_noise_at_validity_gate():
    gauntlet = SuppressionGauntlet(sensitivity=0.55)
    signals = CandidateSignals(
        candidate_id="cand-cloudy",
        grid_cell_id="cell-1",
        tile_before_id="tb",
        tile_after_id="ta",
        area_m2=2000.0,
        raw_model_score=0.88,
        valid_fraction=0.60,  # Below 0.75 threshold
        cloud_fraction=0.55,  # High cloud
        registration_residual_px=0.15,
        seasonal_z_score=0.2,
        later_usable_detections=3,
        sar_agreement=0.90,
    )
    result = gauntlet.evaluate(signals)
    assert result.passed is False
    assert result.rejection_gate == "validity"


def test_gauntlet_rejects_transient_shadow_at_persistence_gate():
    gauntlet = SuppressionGauntlet(sensitivity=0.55)
    signals = CandidateSignals(
        candidate_id="cand-shadow",
        grid_cell_id="cell-1",
        tile_before_id="tb",
        tile_after_id="ta",
        area_m2=1500.0,
        raw_model_score=0.75,
        valid_fraction=0.95,
        cloud_fraction=0.05,
        registration_residual_px=0.20,
        seasonal_z_score=0.4,
        later_usable_detections=0,  # Shadow vanished in next clear observation
        sar_agreement=0.40,
    )
    result = gauntlet.evaluate(signals)
    assert result.passed is False
    assert result.rejection_gate == "persistence"
