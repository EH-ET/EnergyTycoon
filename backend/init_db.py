from sqlalchemy.orm import Session

from .database import engine
from .models import User, GeneratorType


# 기본 발전기 목록 (프론트엔드 generators 배열과 동일한 순서)
DEFAULT_GENERATOR_TYPES = [
  {"이름": "식물 광합성 전지", "세부설명": "식물의 광합성을 이용해 소량의 전기를 생산합니다. 낮에만 작동합니다.", "설치비용(수)": 10000, "설치비용(높이)": 0, "설치시간(초)": 3, "생산량(에너지수)": 1000, "생산량(에너지높이)": 0, "크기": 1, "내열한계": 3, "발열": 0},
  {"이름": "소형 태양광 패널(개인용)", "세부설명": "작은 태양광 패널로 태양 에너지를 이용해 전기를 생산합니다.", "설치비용(수)": 80000, "설치비용(높이)": 0, "설치시간(초)": 4, "생산량(에너지수)": 2600, "생산량(에너지높이)": 0, "크기": 2, "내열한계": 10, "발열": 1},
  {"이름": "소형 풍력발전기(마이크로)", "세부설명": "작은 풍력 장치를 이용해 바람으로 전기를 생산합니다.", "설치비용(수)": 250000, "설치비용(높이)": 0, "설치시간(초)": 6, "생산량(에너지수)": 6800, "생산량(에너지높이)": 0, "크기": 2.5, "내열한계": 15, "발열": 1},
  {"이름": "소수력발전기(마을급)", "세부설명": "물을 흐르게 하여 안정적으로 전기를 생산합니다.", "설치비용(수)": 100000, "설치비용(높이)": 1, "설치시간(초)": 9, "생산량(에너지수)": 18000, "생산량(에너지높이)": 0, "크기": 2.2, "내열한계": 25, "발열": 2},
  {"이름": "육상 풍력발전기(일반형)", "세부설명": "육지에서 설치하는 일반적인 풍력 발전기입니다.", "설치비용(수)": 360000, "설치비용(높이)": 1, "설치시간(초)": 13, "생산량(에너지수)": 54000, "생산량(에너지높이)": 0, "크기": 3, "내열한계": 40, "발열": 1},
  {"이름": "부유식 태양광(중형)", "세부설명": "수면 위에 설치된 태양광 패널을 이용해 전력을 생산합니다.", "설치비용(수)": 120000, "설치비용(높이)": 2, "설치시간(초)": 18, "생산량(에너지수)": 150000, "생산량(에너지높이)": 0, "크기": 2.5, "내열한계": 75, "발열": 4},
  {"이름": "파력발전기(해양파)", "세부설명": "해양 파도의 운동 에너지를 이용해 전기를 생산합니다.", "설치비용(수)": 720000, "설치비용(높이)": 2, "설치시간(초)": 24, "생산량(에너지수)": 500000, "생산량(에너지높이)": 0, "크기": 2.3, "내열한계": 112, "발열": 3},
  {"이름": "해상 풍력발전기(대형 터빈)", "세부설명": "해상에서 강한 바람을 이용해 전력을 생산하는 대형 설비입니다.", "설치비용(수)": 500000, "설치비용(높이)": 3, "설치시간(초)": 31, "생산량(에너지수)": 200000, "생산량(에너지높이)": 1, "크기": 3.5, "내열한계": 165, "발열": 3},
  {"이름": "폐열회수 보일러발전기", "세부설명": "산업 공정에서 버려지는 열을 회수하여 전력을 생산합니다.", "설치비용(수)": 310000, "설치비용(높이)": 4, "설치시간(초)": 39, "생산량(에너지수)": 750000, "생산량(에너지높이)": 1, "크기": 2.4, "내열한계": 225, "발열": 8},
  {"이름": "바이오매스 발전기", "세부설명": "유기성 자원을 연소하거나 분해하여 전력을 생산합니다.", "설치비용(수)": 200000, "설치비용(높이)": 5, "설치시간(초)": 48, "생산량(에너지수)": 300000, "생산량(에너지높이)": 1, "크기": 2.1, "내열한계": 295, "발열": 10},
  {"이름": "디젤발전기", "세부설명": "디젤 연료를 사용하여 안정적으로 전력을 생산합니다.", "설치비용(수)": 120000, "설치비용(높이)": 6, "설치시간(초)": 58, "생산량(에너지수)": 100000, "생산량(에너지높이)": 2, "크기": 2.3, "내열한계": 375, "발열": 15},
  {"이름": "조력발전기", "세부설명": "밀물과 썰물의 수위를 이용해 전력을 생산합니다.", "설치비용(수)": 800000, "설치비용(높이)": 6, "설치시간(초)": 69, "생산량(에너지수)": 350000, "생산량(에너지높이)": 2, "크기": 2.5, "내열한계": 425, "발열": 4},
  {"이름": "연료전지 발전기(수소)", "세부설명": "수소와 산소의 화학 반응을 통해 전력을 생산합니다.", "설치비용(수)": 100000, "설치비용(높이)": 8, "설치시간(초)": 81, "생산량(에너지수)": 150000, "생산량(에너지높이)": 3, "크기": 2.7, "내열한계": 625, "발열": 50},
  {"이름": "지열발전기", "세부설명": "지열을 이용하여 안정적이고 지속적인 전력을 생산합니다.", "설치비용(수)": 382500, "설치비용(높이)": 8, "설치시간(초)": 94, "생산량(에너지수)": 400000, "생산량(에너지높이)": 3, "크기": 2.5, "내열한계": 750, "발열": 18},
  {"이름": "가스터빈 발전기", "세부설명": "가스를 연료로 높은 출력의 전력을 생산합니다.", "설치비용(수)": 255500, "설치비용(높이)": 9, "설치시간(초)": 108, "생산량(에너지수)": 225000, "생산량(에너지높이)": 4, "크기": 2.8, "내열한계": 875, "발열": 45},
  {"이름": "수소 가스터빈 발전기", "세부설명": "수소를 연료로 사용하는 친환경 고출력 발전기입니다.", "설치비용(수)": 130000, "설치비용(높이)": 11, "설치시간(초)": 123, "생산량(에너지수)": 215700, "생산량(에너지높이)": 5, "크기": 2.9, "내열한계": 925, "발열": 50},
  {"이름": "수력발전(댐)", "세부설명": "대규모 댐의 낙차를 이용해 전기를 생산합니다.", "설치비용(수)": 950000, "설치비용(높이)": 11, "설치시간(초)": 139, "생산량(에너지수)": 855000, "생산량(에너지높이)": 5, "크기": 3.4, "내열한계": 1024, "발열": 28},
  {"이름": "LNG 복합화력발전기", "세부설명": "LNG를 이용한 고효율 복합 발전 시스템입니다.", "설치비용(수)": 800000, "설치비용(높이)": 12, "설치시간(초)": 156, "생산량(에너지수)": 300000, "생산량(에너지높이)": 6, "크기": 2.7, "내열한계": 1200, "발열": 62},
  {"이름": "석탄 화력발전기", "세부설명": "석탄을 연소하여 대규모 전력을 생산합니다.", "설치비용(수)": 420000, "설치비용(높이)": 13, "설치시간(초)": 174, "생산량(에너지수)": 115000, "생산량(에너지높이)": 7, "크기": 3.4, "내열한계": 1650, "발열": 85},
  {"이름": "원자력 발전기", "세부설명": "핵분열을 이용해 막대한 양의 전력을 생산합니다.", "설치비용(수)": 325100, "설치비용(높이)": 15, "설치시간(초)": 193, "생산량(에너지수)": 200000, "생산량(에너지높이)": 8, "크기": 4, "내열한계": 3250, "발열": 300},
  {"이름": "인공 태양 발전기", "세부설명": "핵융합 기반의 초고출력 에너지를 생산합니다.", "설치비용(수)": 161500, "설치비용(높이)": 17, "설치시간(초)": 213, "생산량(에너지수)": 250000, "생산량(에너지높이)": 9, "크기": 5, "내열한계": 6500, "발열": 1200},
  {"이름": "초신성 발전기", "세부설명": "초신성 폭발 에너지를 이용한 가상의 초고출력 발전 장치입니다.", "설치비용(수)": 200000, "설치비용(높이)": 22, "설치시간(초)": 234, "생산량(에너지수)": 500000, "생산량(에너지높이)": 10, "크기": 6.5, "내열한계": 10000, "발열": 6000},
  {"이름": "반물질 발전기", "세부설명": "반물질과 물질의 반응으로 극대한 에너지를 생산합니다.", "설치비용(수)": 100000, "설치비용(높이)": 1000000, "설치시간(초)": 256, "생산량(에너지수)": 100000, "생산량(에너지높이)": 13, "크기": 8, "내열한계": 35000, "발열": 50000}
]

DEFAULT_GENERATOR_NAME_TO_INDEX = {t["이름"]: idx for idx, t in enumerate(DEFAULT_GENERATOR_TYPES)}
DEFAULT_GENERATOR_TIME_BY_NAME = {t["이름"]: int(t.get("설치시간(초)") or 0) for t in DEFAULT_GENERATOR_TYPES}


def ensure_user_upgrade_columns():
    """Ensure legacy sqlite DBs contain the newest user upgrade columns."""
    dialect = engine.dialect.name
    if dialect == "sqlite":
        with engine.begin() as conn:
            rows = conn.exec_driver_sql("PRAGMA table_info('users')").fetchall()
            cols = {r[1] for r in rows}
            # Rename supply_bonus -> demand_bonus if needed
            if "demand_bonus" not in cols and "supply_bonus" in cols:
                conn.exec_driver_sql("ALTER TABLE users RENAME COLUMN supply_bonus TO demand_bonus")
                cols.discard("supply_bonus")
                cols.add("demand_bonus")
            needed = [
                ("production_bonus", "INTEGER NOT NULL DEFAULT 0"),
                ("heat_reduction", "INTEGER NOT NULL DEFAULT 0"),
                ("tolerance_bonus", "INTEGER NOT NULL DEFAULT 0"),
                ("max_generators_bonus", "INTEGER NOT NULL DEFAULT 0"),
                ("money", "INTEGER NOT NULL DEFAULT 10"),
                ("demand_bonus", "INTEGER NOT NULL DEFAULT 0"),
                ("rebirth_count", "INTEGER NOT NULL DEFAULT 0"),
            ]
            for col_name, col_def in needed:
                if col_name not in cols:
                    conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
            # Backfill demand_bonus from legacy supply_bonus if both exist
            if "supply_bonus" in cols and "demand_bonus" in cols:
                conn.exec_driver_sql("UPDATE users SET demand_bonus = COALESCE(demand_bonus, supply_bonus)")
                try:
                    conn.exec_driver_sql("ALTER TABLE users DROP COLUMN supply_bonus")
                except Exception:
                    pass
        return

    if "postgres" in dialect:
        with engine.begin() as conn:
            rows = conn.exec_driver_sql(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
            ).fetchall()
            existing = {row[0] for row in rows}
            # Rename supply_bonus -> demand_bonus if needed
            if "demand_bonus" not in existing and "supply_bonus" in existing:
                conn.exec_driver_sql("ALTER TABLE users RENAME COLUMN supply_bonus TO demand_bonus")
                existing.discard("supply_bonus")
                existing.add("demand_bonus")
            if "demand_bonus" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS demand_bonus INTEGER NOT NULL DEFAULT 0"
                )
                existing.add("demand_bonus")
            if "rebirth_count" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS rebirth_count INTEGER NOT NULL DEFAULT 0"
                )
                existing.add("rebirth_count")
            # Backfill and clean up legacy column if it still exists
            if "supply_bonus" in existing:
                conn.exec_driver_sql(
                    "UPDATE users SET demand_bonus = COALESCE(demand_bonus, supply_bonus) WHERE demand_bonus IS NULL"
                )
                conn.exec_driver_sql("ALTER TABLE users DROP COLUMN supply_bonus")
            conn.exec_driver_sql("UPDATE users SET demand_bonus = 0 WHERE demand_bonus IS NULL")
            conn.exec_driver_sql("ALTER TABLE users ALTER COLUMN demand_bonus SET DEFAULT 0")
            conn.exec_driver_sql("ALTER TABLE users ALTER COLUMN demand_bonus SET NOT NULL")


def ensure_big_value_columns():
    # Skip for PostgreSQL - create_all() handles schema
    if not str(engine.url).startswith("sqlite"):
        return

    needed = [
        ("money_data", "INTEGER NOT NULL DEFAULT 0"),
        ("money_high", "INTEGER NOT NULL DEFAULT 0"),
        ("energy_data", "INTEGER NOT NULL DEFAULT 0"),
        ("energy_high", "INTEGER NOT NULL DEFAULT 0"),
    ]
    with engine.begin() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info('users')")}
        for col_name, col_def in needed:
            if col_name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")


def ensure_play_time_column():
    """Ensure play_time_ms column exists in users table."""
    dialect = engine.dialect.name

    if dialect == "sqlite":
        with engine.begin() as conn:
            rows = conn.exec_driver_sql("PRAGMA table_info('users')").fetchall()
            cols = {r[1] for r in rows}
            if "play_time_ms" not in cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN play_time_ms INTEGER NOT NULL DEFAULT 0")
        return

    if "postgres" in dialect:
        with engine.begin() as conn:
            rows = conn.exec_driver_sql(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
            ).fetchall()
            existing = {row[0] for row in rows}
            if "play_time_ms" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS play_time_ms INTEGER NOT NULL DEFAULT 0"
                )


def ensure_generator_columns():
    """Ensure legacy sqlite DBs contain the newest generator columns."""
    # Skip for PostgreSQL - create_all() handles schema
    if not str(engine.url).startswith("sqlite"):
        return

    needed = [
        ("build_complete_ts", "INTEGER"),
        ("running", "INTEGER NOT NULL DEFAULT 1"),
    ]
    with engine.begin() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info('generators')")}
        for col_name, col_def in needed:
            if col_name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE generators ADD COLUMN {col_name} {col_def}")


def ensure_map_progress_columns():
    # Skip for PostgreSQL - create_all() handles schema
    if not str(engine.url).startswith("sqlite"):
        return

    needed = [
        ("production_upgrade", "INTEGER NOT NULL DEFAULT 0"),
        ("heat_reduction_upgrade", "INTEGER NOT NULL DEFAULT 0"),
        ("tolerance_upgrade", "INTEGER NOT NULL DEFAULT 0"),
    ]
    with engine.begin() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info('map_progress')")}
        for col_name, col_def in needed:
            if col_name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE map_progress ADD COLUMN {col_name} {col_def}")


def ensure_generator_type_columns():
    """Ensure generator_types table has cost_data and cost_high columns."""
    needed = [
        ("cost_data", "INTEGER NOT NULL DEFAULT 0"),
        ("cost_high", "INTEGER NOT NULL DEFAULT 0"),
    ]

    dialect = engine.dialect.name
    if dialect == "sqlite":
        with engine.begin() as conn:
            existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info('generator_types')")}
            for col_name, col_def in needed:
                if col_name not in existing:
                    conn.exec_driver_sql(f"ALTER TABLE generator_types ADD COLUMN {col_name} {col_def}")
        return

    if "postgres" in dialect:
        with engine.begin() as conn:
            rows = conn.exec_driver_sql(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'generator_types'"
            ).fetchall()
            existing = {row[0] for row in rows}
            for col_name, col_def in needed:
                if col_name not in existing:
                    conn.exec_driver_sql(f"ALTER TABLE generator_types ADD COLUMN {col_name} {col_def}")


def create_default_generator_types(db: Session):
    """Seed default generator types if none exist."""
    if db.query(GeneratorType).count() == 0:
        sync_generator_types(db)


def _normalize_cost(val):
    try:
        num = float(val)
    except (TypeError, ValueError):
        return 1
    return max(1, int(round(num)))


def sync_generator_types(db: Session):
    """Ensure DB generator_types match the canonical frontend list (append/update)."""
    existing = {t.name: t for t in db.query(GeneratorType).all()}
    changed = False
    for src in DEFAULT_GENERATOR_TYPES:
        name = src.get("이름") or src.get("name")
        if not name:
            continue
        desc = src.get("세부설명") or src.get("description") or ""
        
        # Read BigValue cost components
        cost_data = int(src.get("설치비용(수)") or 0)
        cost_high = int(src.get("설치비용(높이)") or 0)
        
        row = existing.get(name)
        if not row:
            db.add(GeneratorType(
                name=name, 
                description=desc, 
                cost_data=cost_data,
                cost_high=cost_high
            ))
            changed = True
            continue
        updated = False
        if row.description != desc:
            row.description = desc
            updated = True
        if getattr(row, "cost_data", 0) != cost_data:
            row.cost_data = cost_data
            updated = True
        if getattr(row, "cost_high", 0) != cost_high:
            row.cost_high = cost_high
            updated = True
        if updated:
            changed = True
    if changed:
        db.commit()


def get_build_time_by_name(name: str | None) -> int:
    if not name:
        return 0
    return DEFAULT_GENERATOR_TIME_BY_NAME.get(name, 0)
