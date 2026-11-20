from app.services.change_detection.earliest_observation import EarliestObservationService


def test_earliest_observation_interval_detection():
    service = EarliestObservationService()
    timeline = [
        {"date": "2020-01-10", "changeScore": 0.05, "usability": "clear"},
        {"date": "2020-02-12", "changeScore": 0.08, "usability": "clear"},
        {"date": "2020-02-28", "changeScore": 0.65, "usability": "unusable"},  # cloudy, should be skipped
        {"date": "2020-03-15", "changeScore": 0.82, "usability": "clear"},     # first usable post-change date
        {"date": "2020-04-01", "changeScore": 0.85, "usability": "clear"},
    ]

    res = service.estimate_interval(timeline, change_threshold=0.50)
    assert res["earliest_interval_start"] == "2020-02-12"
    assert res["earliest_interval_end"] == "2020-03-15"
    assert res["revisit_gap_days"] == 32
    assert res["cloud_gap_detected"] is True
