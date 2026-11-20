from enum import Enum
from typing import List


class SensorType(str, Enum):
    S2 = "S2"
    S1 = "S1"
    L8 = "L8"
    BHUVAN = "BHUVAN"


class ChangeType(str, Enum):
    CONSTRUCTION = "construction"
    CLEARANCE = "clearance"
    WATER = "water"
    ROADS = "roads"


class ChangeDirection(str, Enum):
    APPEARANCE = "appearance"
    DISAPPEARANCE = "disappearance"
    EXPANSION = "expansion"
    CONTRACTION = "contraction"


class AcquisitionUsability(str, Enum):
    CLEAR = "clear"
    PARTLY_CLOUDY = "partly_cloudy"
    UNUSABLE = "unusable"
    MISSING = "missing"


class SuppressionGate(str, Enum):
    VALIDITY = "validity"
    RADIOMETRY = "radiometry"
    REGISTRATION = "registration"
    SEASON = "season"
    PERSISTENCE = "persistence"
    CROSS_SENSOR = "cross_sensor"
    GEOMETRY = "geometry"


class RejectReason(str, Enum):
    CLOUD = "cloud"
    SHADOW = "shadow"
    SEASONAL = "seasonal"
    MISREGISTRATION = "misregistration"
    NOT_OF_INTEREST = "not_of_interest"
    DUPLICATE = "duplicate"


class IngestStatus(str, Enum):
    QUEUED = "queued"
    MASKING = "masking"
    NORMALISING = "normalising"
    ALIGNING = "aligning"
    TILING = "tiling"
    EMBEDDING = "embedding"
    INDEXING = "indexing"
    DONE = "done"
    FAILED = "failed"


class UserRole(str, Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"


class DecisionVerdict(str, Enum):
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    PENDING = "pending"


# Default suppression gate evaluation sequence
SUPPRESSION_GATE_ORDER: List[SuppressionGate] = [
    SuppressionGate.VALIDITY,
    SuppressionGate.RADIOMETRY,
    SuppressionGate.REGISTRATION,
    SuppressionGate.SEASON,
    SuppressionGate.PERSISTENCE,
    SuppressionGate.CROSS_SENSOR,
    SuppressionGate.GEOMETRY,
]
