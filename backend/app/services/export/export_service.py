import csv
import io
import json
import uuid
from typing import Any, Dict, List
from sqlalchemy.orm import Session

from app.core.exceptions import EntityNotFoundError
from app.models.change import ChangeCandidate
from app.models.scene import Scene
from app.models.tile import Tile
from app.schemas.export import ExportRequest, ExportResponse


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def generate_export(self, organisation_id: str, req: ExportRequest) -> ExportResponse:
        candidates = (
            self.db.query(ChangeCandidate)
            .filter(
                ChangeCandidate.organisation_id == organisation_id,
                ChangeCandidate.id.in_(req.candidate_ids),
            )
            .all()
        )
        if not candidates:
            raise EntityNotFoundError("No matching candidates found for export.")

        export_id = f"exp-{uuid.uuid4().hex[:8]}"
        fmt = req.format.lower()

        content = ""
        if fmt == "geojson":
            features = []
            for c in candidates:
                feat = {
                    "type": "Feature",
                    "id": c.id,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [c.bbox[0], c.bbox[1]],
                                [c.bbox[2], c.bbox[1]],
                                [c.bbox[2], c.bbox[3]],
                                [c.bbox[0], c.bbox[3]],
                                [c.bbox[0], c.bbox[1]],
                            ]
                        ]
                        if c.bbox
                        else [],
                    },
                    "properties": {
                        "candidate_id": c.id,
                        "aoi_id": c.aoi_id,
                        "type": c.change_type,
                        "direction": c.direction,
                        "confidence": c.confidence,
                        "score": c.score,
                        "area_m2": c.area_m2,
                        "status": c.review_status,
                        "tile_before_id": c.tile_before_id,
                        "tile_after_id": c.tile_after_id,
                        "revisit_gap_days": c.revisit_gap_days,
                        "sar_agreement": c.sar_agreement,
                    },
                }
                features.append(feat)
            content = json.dumps({"type": "FeatureCollection", "features": features}, indent=2)

        elif fmt == "csv":
            out = io.StringIO()
            writer = csv.writer(out)
            writer.writerow([
                "candidate_id", "aoi_id", "change_type", "direction",
                "confidence", "score", "area_m2", "review_status",
                "tile_before_id", "tile_after_id", "revisit_gap_days"
            ])
            for c in candidates:
                writer.writerow([
                    c.id, c.aoi_id, c.change_type, c.direction,
                    c.confidence, c.score, c.area_m2, c.review_status,
                    c.tile_before_id, c.tile_after_id, c.revisit_gap_days
                ])
            content = out.getvalue()

        else:
            # Fallback format envelope (KML / STAC / GeoPackage placeholder descriptor)
            content = json.dumps({
                "format": fmt,
                "candidate_count": len(candidates),
                "export_id": export_id,
            })

        return ExportResponse(
            export_id=export_id,
            format=fmt,
            item_count=len(candidates),
            download_url=f"/api/export/{export_id}/download",
            file_size_bytes=len(content.encode("utf-8")),
        )
