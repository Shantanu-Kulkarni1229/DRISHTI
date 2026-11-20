from typing import Any, List, Optional
from sqlalchemy import JSON, Text, TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB

try:
    from geoalchemy2 import Geometry
    HAS_GEOALCHEMY = True
except ImportError:
    HAS_GEOALCHEMY = False

try:
    from pgvector.sqlalchemy import Vector
    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False


class FlexibleGeometry(TypeDecorator):
    """Stores Geometry in PostGIS if available and PostgreSQL dialect, otherwise JSON/Text."""
    impl = Text
    cache_ok = True

    def __init__(self, geometry_type: str = "POLYGON", srid: int = 4326, **kwargs):
        super().__init__(**kwargs)
        self.geometry_type = geometry_type
        self.srid = srid

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql" and HAS_GEOALCHEMY:
            return dialect.type_descriptor(Geometry(geometry_type=self.geometry_type, srid=self.srid))
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        return value


class FlexibleVector(TypeDecorator):
    """Stores pgvector Vector if available on PostgreSQL, otherwise JSON."""
    impl = JSON
    cache_ok = True

    def __init__(self, dim: Optional[int] = None, **kwargs):
        super().__init__(**kwargs)
        self.dim = dim

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql" and HAS_PGVECTOR:
            if self.dim is not None:
                return dialect.type_descriptor(Vector(self.dim))
            return dialect.type_descriptor(Vector())
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value, dialect):
        return value

    def process_result_value(self, value, dialect):
        return value


class JSONType(TypeDecorator):
    """Uses JSONB on PostgreSQL and JSON elsewhere."""
    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())
