from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


class EarliestObservationService:
    """Estimates the earliest-supported observation interval and revisit gap across usable observations only."""

    def estimate_interval(
        self,
        timeline: List[Dict[str, Any]],
        change_threshold: float = 0.45,
    ) -> Dict[str, Any]:
        """
        timeline: list of sorted observations with 'date', 'changeScore', 'usability' ('clear', 'partly_cloudy', 'unusable')
        """
        usable_obs = [obs for obs in timeline if obs.get("usability") in ("clear", "partly_cloudy")]
        if not usable_obs:
            return {
                "earliest_interval_start": "Unknown",
                "earliest_interval_end": "Unknown",
                "revisit_gap_days": 0,
                "cloud_gap_detected": False,
            }

        last_clear_before = usable_obs[0]
        first_clear_after = None

        for obs in usable_obs:
            score = obs.get("changeScore", 0.0)
            if score >= change_threshold:
                first_clear_after = obs
                break
            else:
                last_clear_before = obs

        if not first_clear_after:
            first_clear_after = usable_obs[-1]

        d0 = datetime.fromisoformat(last_clear_before["date"])
        d1 = datetime.fromisoformat(first_clear_after["date"])
        gap_days = max(1, abs((d1 - d0).days))

        # Check if there were cloudy or unusable acquisitions between d0 and d1
        unusable_in_between = any(
            obs.get("usability") in ("unusable", "missing")
            and d0 < datetime.fromisoformat(obs["date"]) < d1
            for obs in timeline
        )

        return {
            "earliest_interval_start": last_clear_before["date"],
            "earliest_interval_end": first_clear_after["date"],
            "revisit_gap_days": gap_days,
            "cloud_gap_detected": unusable_in_between or gap_days > 14,
        }
