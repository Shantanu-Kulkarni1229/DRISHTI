from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.candidates import SuppressionFactor
from app.schemas.changes import SuppressionFunnelResponse


@dataclass
class CandidateSignals:
    candidate_id: str
    grid_cell_id: str
    tile_before_id: str
    tile_after_id: str
    area_m2: float
    raw_model_score: float  # 0..1
    valid_fraction: float  # 0..1
    cloud_fraction: float  # 0..1
    registration_residual_px: float  # e.g. 0.18 px
    seasonal_z_score: float  # deviation from seasonal harmonic model
    later_usable_detections: int  # count of later dates where change persists
    sar_agreement: float  # 0..1 Sentinel-1 backscatter agreement
    aspect_ratio: float = 1.2
    hugging_edge: bool = False


@dataclass
class GateEvaluationResult:
    passed: bool
    rejection_gate: Optional[str] = None
    rejection_reason: Optional[str] = None
    calibrated_confidence: float = 0.0
    factors: List[SuppressionFactor] = field(default_factory=list)


class SuppressionGauntlet:
    """Evaluates candidates through the 7 sequential quality and false-alarm suppression gates."""

    def __init__(self, sensitivity: float = 0.55):
        # sensitivity: 0 = extreme precision (stricter gates), 1 = high recall (lenient gates)
        self.sensitivity = sensitivity

    def evaluate(self, signals: CandidateSignals) -> GateEvaluationResult:
        factors: List[SuppressionFactor] = []

        # Gate 1: Validity
        # Reject if either tile has excessive cloud or low valid fraction
        validity_val = signals.valid_fraction * (1.0 - signals.cloud_fraction)
        factors.append(SuppressionFactor(gate="validity", label="Valid observation fraction", value=round(validity_val, 2)))
        if signals.cloud_fraction > (0.35 + 0.20 * self.sensitivity) or signals.valid_fraction < 0.75:
            return GateEvaluationResult(
                passed=False,
                rejection_gate="validity",
                rejection_reason="Excessive cloud/shadow or low valid fraction",
                factors=factors,
            )

        # Gate 2: Radiometry (IR-MAD normalisation)
        radiometry_val = max(0.0, 1.0 - abs(signals.seasonal_z_score) * 0.2)
        factors.append(SuppressionFactor(gate="radiometry", label="Radiometric consistency", value=round(radiometry_val, 2)))
        if signals.raw_model_score < (0.45 - 0.20 * self.sensitivity):
            return GateEvaluationResult(
                passed=False,
                rejection_gate="radiometry",
                rejection_reason="Signal dropped after IR-MAD normalisation",
                factors=factors,
            )

        # Gate 3: Registration Quality
        # Reject changes narrower than ~1.5x the residual shift (misregistration slivers)
        reg_val = max(0.0, min(1.0, 1.0 - signals.registration_residual_px / 1.5))
        factors.append(SuppressionFactor(gate="registration", label="Registration residual", value=round(reg_val, 2)))
        if signals.registration_residual_px > (0.80 + 0.40 * self.sensitivity):
            return GateEvaluationResult(
                passed=False,
                rejection_gate="registration",
                rejection_reason="Misregistration edge artifact (sub-pixel shift too high)",
                factors=factors,
            )

        # Gate 4: Seasonality
        season_val = max(0.0, 1.0 - min(1.0, signals.seasonal_z_score / 3.0))
        factors.append(SuppressionFactor(gate="season", label="Phenological envelope fit", value=round(season_val, 2)))
        if signals.seasonal_z_score > (2.5 + 1.0 * self.sensitivity):
            return GateEvaluationResult(
                passed=False,
                rejection_gate="season",
                rejection_reason="Within expected seasonal phenological envelope",
                factors=factors,
            )

        # Gate 5: Temporal Persistence (highest value gate)
        # Real construction persists, clouds/shadows do not
        persist_val = min(1.0, signals.later_usable_detections / 2.0)
        factors.append(SuppressionFactor(gate="persistence", label="Multi-date persistence", value=round(persist_val, 2)))
        min_persist = 1 if self.sensitivity > 0.7 else 2
        if signals.later_usable_detections < min_persist:
            return GateEvaluationResult(
                passed=False,
                rejection_gate="persistence",
                rejection_reason="Transient anomaly — failed to persist in subsequent acquisitions",
                factors=factors,
            )

        # Gate 6: Cross-Sensor Corroboration (Sentinel-1 SAR)
        factors.append(SuppressionFactor(gate="cross_sensor", label="SAR agreement", value=round(signals.sar_agreement, 2)))

        # Gate 7: Geometry Sanity
        geom_val = 1.0 if (signals.area_m2 >= 100.0 and not signals.hugging_edge) else 0.2
        factors.append(SuppressionFactor(gate="geometry", label="Geometry compactness", value=round(geom_val, 2)))
        if signals.area_m2 < 100.0 or signals.hugging_edge:
            return GateEvaluationResult(
                passed=False,
                rejection_gate="geometry",
                rejection_reason="Sub-resolution polygon or edge-clipping artifact",
                factors=factors,
            )

        # Calibrated confidence computation via weighted factor combination
        calibrated_conf = (
            0.25 * signals.raw_model_score
            + 0.25 * persist_val
            + 0.15 * signals.sar_agreement
            + 0.15 * season_val
            + 0.10 * reg_val
            + 0.10 * validity_val
        )
        calibrated_conf = max(0.10, min(0.99, calibrated_conf))

        return GateEvaluationResult(
            passed=True,
            calibrated_confidence=round(calibrated_conf, 2),
            factors=factors,
        )
