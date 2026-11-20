from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class RetrievalQueryResultItem(BaseModel):
    query: str
    recallAt1: float
    recallAt5: float
    recallAt10: float
    relevant: int
    returned: int
    ap: float


class RetrievalMetrics(BaseModel):
    recallAt1: float
    recallAt5: float
    recallAt10: float
    map: float
    ndcgAt10: float
    perQuery: List[RetrievalQueryResultItem]


class PRCurvePoint(BaseModel):
    threshold: float
    precision: float
    recall: float


class FalseAlarmConfounder(BaseModel):
    confounder: str
    before: float
    after: float


class ChangeMetrics(BaseModel):
    precision: float
    recall: float
    f1: float
    confusion: Dict[str, Dict[str, int]]
    prCurve: List[PRCurvePoint]
    operatingPointThreshold: float
    falseAlarmByConfounder: List[FalseAlarmConfounder]
    earliestDateAccuracy: float
    meanIntervalWidthDays: float


class SystemPerformanceMetrics(BaseModel):
    ingestTilesPerSec: float
    indexBuildTimeS: float
    incrementalInsertMs: float
    storagePerThousandTilesMb: float
    queryLatencyP50Ms: float
    queryLatencyP95Ms: float
    hardware: str
    gitCommit: str


class EvalMetricsResponse(BaseModel):
    retrieval: RetrievalMetrics
    change: ChangeMetrics
    performance: SystemPerformanceMetrics
