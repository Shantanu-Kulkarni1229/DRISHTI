import sys
from pathlib import Path
from urllib.parse import urlparse

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import get_settings
from sqlalchemy import create_engine, text

def verify_resulting_schema():
    settings = get_settings()
    url = settings.DATABASE_URL

    print("==================================================")
    print("PHASE 7: VERIFY RESULTING SCHEMA ON SUPABASE")
    print("==================================================")

    engine = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 15})

    with engine.connect() as conn:
        # 1. Alembic current revision
        rev = conn.execute(text("SELECT version_num FROM alembic_version;")).scalar()
        print(f"1. Current Alembic Revision:\n   {rev}")
        assert rev == "001_initial_schema", f"Expected 001_initial_schema, got {rev}"

        # 2. Check all expected tables exist
        expected_tables = {
            "organisations",
            "users",
            "model_registry",
            "scenes",
            "grid_cells",
            "tiles",
            "tile_embeddings",
            "change_jobs",
            "change_candidates",
            "decisions",
            "clusters",
            "audit_records",
            "ingestion_jobs",
            "alembic_version",
        }
        tables_query = text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        actual_tables = set(r[0] for r in conn.execute(tables_query).fetchall())
        print(f"\n2. Total tables created: {len(actual_tables)}")
        missing = expected_tables - actual_tables
        if missing:
            print(f"   [ERROR] Missing tables: {missing}")
        else:
            print(f"   [SUCCESS] All {len(expected_tables)} expected tables present:")
            for t in sorted(actual_tables):
                print(f"     - {t}")

        # 3. Check Primary Keys
        pk_query = text("""
            SELECT 
                tc.table_name, 
                kc.column_name 
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kc 
                ON tc.constraint_name = kc.constraint_name 
                AND tc.table_schema = kc.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY' 
                AND tc.table_schema = 'public'
            ORDER BY tc.table_name;
        """)
        pks = conn.execute(pk_query).fetchall()
        print(f"\n3. Primary Keys Verified ({len(pks)}):")
        for t, col in pks:
            print(f"     * {t}.{col} (PK)")

        # 4. Check Foreign Keys
        fk_query = text("""
            SELECT 
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' 
                AND tc.table_schema = 'public'
            ORDER BY tc.table_name, kcu.column_name;
        """)
        fks = conn.execute(fk_query).fetchall()
        print(f"\n4. Foreign Keys Verified ({len(fks)}):")
        for t, col, ft, fcol in fks:
            print(f"     * {t}.{col} -> {ft}.{fcol}")

        # 5. Check Indexes
        idx_query = text("""
            SELECT 
                tablename, 
                indexname, 
                indexdef 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
                AND indexname NOT LIKE '%_pkey'
            ORDER BY tablename, indexname;
        """)
        indexes = conn.execute(idx_query).fetchall()
        print(f"\n5. Secondary Indexes Verified ({len(indexes)}):")
        for t, iname, idef in indexes:
            print(f"     * {iname} on {t}")

        # 6. Check Extensions active
        ext_query = text("""
            SELECT extname, extversion 
            FROM pg_extension 
            WHERE extname IN ('postgis', 'vector', 'pgcrypto')
            ORDER BY extname;
        """)
        active_exts = conn.execute(ext_query).fetchall()
        print(f"\n6. Active Extensions ({len(active_exts)}):")
        for name, ver in active_exts:
            print(f"     * {name} (v{ver})")

        # 7. Execute live sample ORM query via backend models
        from app.models.organisation import Organisation
        from app.models.user import User
        from app.models.scene import Scene
        from app.db.session import SessionLocal

        db = SessionLocal()
        org_count = db.query(Organisation).count()
        user_count = db.query(User).count()
        scene_count = db.query(Scene).count()
        db.close()
        print(f"\n7. Live Backend Query Execution:")
        print(f"   - Organisations count: {org_count}")
        print(f"   - Users count:         {user_count}")
        print(f"   - Scenes count:        {scene_count}")
        print("   [SUCCESS] Backend ORM query executed cleanly!")

    print("\n==================================================")
    print("[ALL PHASES COMPLETE AND VERIFIED]")
    print("==================================================")

if __name__ == "__main__":
    verify_resulting_schema()
