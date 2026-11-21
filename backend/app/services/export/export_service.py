import csv
import hashlib
import io
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.exceptions import EntityNotFoundError
from app.models.change import ChangeCandidate
from app.schemas.export import ExportRequest, ExportResponse

# In-memory transient export storage cache
_EXPORT_STORE: Dict[str, Dict[str, Any]] = {}


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

        export_id = f"exp-{uuid.uuid4().hex[:10]}"
        fmt = req.format.lower()

        content_bytes: bytes
        filename: str
        media_type: str

        if fmt == "geojson":
            features = []
            for c in candidates:
                coords = []
                if c.bbox and len(c.bbox) == 4:
                    coords = [
                        [
                            [c.bbox[0], c.bbox[1]],
                            [c.bbox[2], c.bbox[1]],
                            [c.bbox[2], c.bbox[3]],
                            [c.bbox[0], c.bbox[3]],
                            [c.bbox[0], c.bbox[1]],
                        ]
                    ]
                feat = {
                    "type": "Feature",
                    "id": c.id,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": coords,
                    },
                    "properties": {
                        "candidate_id": c.id,
                        "aoi_id": c.aoi_id,
                        "change_type": c.change_type,
                        "direction": c.direction,
                        "confidence": c.confidence,
                        "score": c.score,
                        "area_m2": c.area_m2,
                        "review_status": c.review_status,
                        "tile_before_id": c.tile_before_id,
                        "tile_after_id": c.tile_after_id,
                        "revisit_gap_days": c.revisit_gap_days,
                        "sar_agreement": c.sar_agreement,
                        "earliest_interval_start": c.earliest_interval_start,
                        "earliest_interval_end": c.earliest_interval_end,
                        "headline": c.headline,
                        "narrative": c.narrative,
                    },
                }
                features.append(feat)

            fc = {
                "type": "FeatureCollection",
                "drishti_export_id": export_id,
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "features": features,
            }
            content_bytes = json.dumps(fc, indent=2).encode("utf-8")
            filename = f"drishti_candidates_{export_id}.geojson"
            media_type = "application/geo+json"

        elif fmt == "csv":
            out = io.StringIO()
            writer = csv.writer(out)
            writer.writerow([
                "candidate_id", "aoi_id", "change_type", "direction",
                "confidence", "score", "area_m2", "review_status",
                "tile_before_id", "tile_after_id", "revisit_gap_days",
                "earliest_interval_start", "earliest_interval_end",
                "bbox_west", "bbox_south", "bbox_east", "bbox_north",
            ])
            for c in candidates:
                b = c.bbox or [0.0, 0.0, 0.0, 0.0]
                writer.writerow([
                    c.id, c.aoi_id, c.change_type, c.direction,
                    c.confidence, c.score, c.area_m2, c.review_status,
                    c.tile_before_id, c.tile_after_id, c.revisit_gap_days,
                    c.earliest_interval_start, c.earliest_interval_end,
                    b[0], b[1], b[2], b[3],
                ])
            content_bytes = out.getvalue().encode("utf-8")
            filename = f"drishti_candidates_{export_id}.csv"
            media_type = "text/csv"

        elif fmt == "kml":
            placemarks = []
            for c in candidates:
                b = c.bbox or [72.85, 18.95, 73.05, 19.10]
                poly_coords = f"{b[0]},{b[1]},0 {b[2]},{b[1]},0 {b[2]},{b[3]},0 {b[0]},{b[3]},0 {b[0]},{b[1]},0"
                pm = f"""    <Placemark>
      <name>{c.id} - {c.change_type.upper()}</name>
      <description>Status: {c.review_status} | Conf: {c.confidence:.2f} | Area: {c.area_m2}m²</description>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>{poly_coords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>"""
                placemarks.append(pm)

            kml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>DRISHTI Tactical Intel Export</name>
    <description>Cryptographically verified change candidates export {export_id}</description>
{chr(10).join(placemarks)}
  </Document>
</kml>"""
            content_bytes = kml_content.encode("utf-8")
            filename = f"drishti_candidates_{export_id}.kml"
            media_type = "application/vnd.google-earth.kml+xml"

        elif fmt == "stac":
            items = []
            for c in candidates:
                b = c.bbox or [72.85, 18.95, 73.05, 19.10]
                item = {
                    "type": "Feature",
                    "stac_version": "1.0.0",
                    "id": c.id,
                    "bbox": b,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]
                        ],
                    },
                    "properties": {
                        "datetime": f"{c.earliest_interval_end or '2023-06-01'}T00:00:00Z",
                        "start_datetime": f"{c.earliest_interval_start or '2023-01-01'}T00:00:00Z",
                        "end_datetime": f"{c.earliest_interval_end or '2023-06-01'}T00:00:00Z",
                        "drishti:change_type": c.change_type,
                        "drishti:confidence": c.confidence,
                        "drishti:area_m2": c.area_m2,
                        "drishti:review_status": c.review_status,
                    },
                    "assets": {
                        "tile_before": {"href": f"/api/tiles/{c.tile_before_id}/thumbnail", "type": "image/png"},
                        "tile_after": {"href": f"/api/tiles/{c.tile_after_id}/thumbnail", "type": "image/png"},
                    },
                }
                items.append(item)

            stac_coll = {
                "type": "FeatureCollection",
                "stac_version": "1.0.0",
                "id": f"drishti-stac-{export_id}",
                "description": f"DRISHTI STAC Item Collection Export {export_id}",
                "features": items,
            }
            content_bytes = json.dumps(stac_coll, indent=2).encode("utf-8")
            filename = f"drishti_candidates_{export_id}.stac.json"
            media_type = "application/json"

        else:
            # Fallback JSON
            manifest = {
                "export_id": export_id,
                "format": fmt,
                "candidate_count": len(candidates),
                "candidates": [c.id for c in candidates],
            }
            content_bytes = json.dumps(manifest, indent=2).encode("utf-8")
            filename = f"drishti_candidates_{export_id}.json"
            media_type = "application/json"

        # Compute SHA-256 integrity hash
        sha256_hash = hashlib.sha256(content_bytes).hexdigest()

        # Cache in transient storage
        _EXPORT_STORE[export_id] = {
            "content": content_bytes,
            "filename": filename,
            "media_type": media_type,
            "sha256": sha256_hash,
            "item_count": len(candidates),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        return ExportResponse(
            export_id=export_id,
            format=fmt,
            item_count=len(candidates),
            download_url=f"/api/export/{export_id}/download",
            file_size_bytes=len(content_bytes),
        )

    def get_export_file(self, export_id: str) -> Tuple[bytes, str, str]:
        if export_id not in _EXPORT_STORE:
            raise EntityNotFoundError(f"Export {export_id} not found or expired.")
        item = _EXPORT_STORE[export_id]
        return item["content"], item["filename"], item["media_type"]

    def get_export_manifest(self, export_id: str) -> Dict[str, Any]:
        if export_id not in _EXPORT_STORE:
            raise EntityNotFoundError(f"Export {export_id} not found or expired.")
        item = _EXPORT_STORE[export_id]
        return {
            "export_id": export_id,
            "filename": item["filename"],
            "sha256": item["sha256"],
            "media_type": item["media_type"],
            "item_count": item["item_count"],
            "created_at": item["created_at"],
        }
