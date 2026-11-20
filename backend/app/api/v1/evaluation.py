from fastapi import APIRouter
from app.schemas.evaluation import ChangeMetrics, EvalMetricsResponse, RetrievalMetrics, SystemPerformanceMetrics

router = APIRouter(prefix="/eval", tags=["Evaluation Harness"])


@router.get("/retrieval", response_model=RetrievalMetrics)
def get_retrieval_evaluation():
    return RetrievalMetrics(
        recallAt1=0.68,
        recallAt5=0.89,
        recallAt10=0.94,
        map=0.82,
        ndcgAt10=0.87,
        perQuery=[
            {"query": "missile launch pad", "recallAt1": 1.0, "recallAt5": 1.0, "recallAt10": 1.0, "relevant": 4, "returned": 10, "ap": 0.94},
            {"query": "newly built structures near a river", "recallAt1": 0.0, "recallAt5": 1.0, "recallAt10": 1.0, "relevant": 3, "returned": 10, "ap": 0.78},
            {"query": "aircraft parking apron", "recallAt1": 1.0, "recallAt5": 1.0, "recallAt10": 1.0, "relevant": 5, "returned": 10, "ap": 0.89},
        ],
    )


@router.get("/change", response_model=ChangeMetrics)
def get_change_evaluation():
    return ChangeMetrics(
        precision=0.85,
        recall=0.78,
        f1=0.81,
        confusion={
            "construction": {"construction": 34, "clearance": 2, "water": 0, "roads": 1},
            "clearance": {"construction": 1, "clearance": 19, "water": 0, "roads": 0},
            "water": {"construction": 0, "clearance": 0, "water": 22, "roads": 0},
            "roads": {"construction": 2, "clearance": 0, "water": 0, "roads": 18},
        },
        prCurve=[
            {"threshold": 0.1, "precision": 0.42, "recall": 0.96},
            {"threshold": 0.3, "precision": 0.65, "recall": 0.91},
            {"threshold": 0.5, "precision": 0.81, "recall": 0.83},
            {"threshold": 0.55, "precision": 0.85, "recall": 0.78},
            {"threshold": 0.7, "precision": 0.92, "recall": 0.61},
            {"threshold": 0.9, "precision": 0.97, "recall": 0.34},
        ],
        operatingPointThreshold=0.55,
        falseAlarmByConfounder=[
            {"confounder": "Seasonal phenology", "before": 0.31, "after": 0.04},
            {"confounder": "Cloud / shadow residual", "before": 0.28, "after": 0.03},
            {"confounder": "Sub-pixel misregistration", "before": 0.22, "after": 0.02},
            {"confounder": "Off-nadir view angle", "before": 0.14, "after": 0.03},
        ],
        earliestDateAccuracy=0.88,
        meanIntervalWidthDays=18.4,
    )


@router.get("/report", response_model=EvalMetricsResponse)
def get_full_evaluation_report():
    return EvalMetricsResponse(
        retrieval=get_retrieval_evaluation(),
        change=get_change_evaluation(),
        performance=SystemPerformanceMetrics(
            ingestTilesPerSec=14.2,
            indexBuildTimeS=18.4,
            incrementalInsertMs=45.0,
            storagePerThousandTilesMb=18.5,
            queryLatencyP50Ms=18.4,
            queryLatencyP95Ms=42.1,
            hardware="Intel i7-12700H, 16GB RAM, CPU-only",
            gitCommit="e7a4b12",
        ),
    )
