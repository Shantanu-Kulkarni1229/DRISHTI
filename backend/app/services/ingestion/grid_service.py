from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.grid_cell import GridCell


class GridService:
    """Manages the reference analysis grid for multi-temporal tile alignment."""

    def __init__(self, db: Session):
        self.db = db

    def resolve_grid_cell(
        self,
        organisation_id: str,
        bbox: List[float],
        aoi_id: Optional[str] = None,
    ) -> GridCell:
        """Finds or creates a stable grid cell snapped to 0.02 degree increments (~2 km)."""
        # Snap bbox coordinates to regular grid interval
        step = 0.02
        min_x = round(bbox[0] / step) * step
        min_y = round(bbox[1] / step) * step
        max_x = min_x + step
        max_y = min_y + step
        snapped_bbox = [round(min_x, 4), round(min_y, 4), round(max_x, 4), round(max_y, 4)]
        grid_ref = f"cell_{snapped_bbox[0]:.4f}_{snapped_bbox[1]:.4f}"

        cell = (
            self.db.query(GridCell)
            .filter(
                GridCell.organisation_id == organisation_id,
                GridCell.grid_reference == grid_ref,
            )
            .first()
        )
        if not cell:
            cell_id = f"cell-{aoi_id or 'global'}-{abs(hash(grid_ref)) % 10000:04d}"
            cell = GridCell(
                id=cell_id,
                organisation_id=organisation_id,
                grid_reference=grid_ref,
                bbox=snapped_bbox,
                aoi_id=aoi_id,
                crs="EPSG:4326",
            )
            self.db.add(cell)
            self.db.commit()
            self.db.refresh(cell)
        return cell
