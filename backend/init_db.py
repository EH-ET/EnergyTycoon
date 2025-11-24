from sqlalchemy.orm import Session

from .database import engine
from .models import User, GeneratorType


# 기본 발전기 목록 (프론트엔드 generators 배열과 동일한 순서)
DEFAULT_GENERATOR_TYPES = [
    {"이름": "식물 광합성 전지", "세부설명": "식물의 광합성을 이용해 소량의 전기를 생산합니다. 낮에만 작동합니다.", "설치비용": 0.5, "설치시간(초)": 3},
    {"이름": "소형 태양광 패널(개인용)", "세부설명": "작은 태양광 패널로 태양 에너지를 이용해 전기를 생산합니다.", "설치비용": 1, "설치시간(초)": 3},
    {"이름": "소형 풍력발전기(마이크로)", "세부설명": "작은 풍력 장치를 이용해 바람으로 전기를 생산합니다.", "설치비용": 20, "설치시간(초)": 6},
    {"이름": "소수력발전기(마을급)", "세부설명": "물을 흐르게 하여 안정적으로 전기를 생산합니다.", "설치비용": 100, "설치시간(초)": 6},
    {"이름": "육상 풍력발전기(일반형)", "세부설명": "육지에서 설치하는 일반적인 풍력 발전기입니다.", "설치비용": 300, "설치시간(초)": 9},
    {"이름": "부유식 태양광(중형)", "세부설명": "수면 위에 설치된 태양광 패널을 이용해 전력을 생산합니다.", "설치비용": 850, "설치시간(초)": 9},
    {"이름": "파력발전기(해양파)", "세부설명": "해양 파도의 운동 에너지를 이용해 전기를 생산합니다.", "설치비용": 3000, "설치시간(초)": 12},
    {"이름": "해상 풍력발전기(대형 터빈)", "세부설명": "해상에서 강한 바람을 이용해 전력을 생산하는 대형 설비입니다.", "설치비용": 5200, "설치시간(초)": 12},
    {"이름": "폐열회수 보일러발전기", "세부설명": "산업 공정에서 버려지는 열을 회수하여 전력을 생산합니다.", "설치비용": 13200, "설치시간(초)": 12},
    {"이름": "바이오매스 발전기", "세부설명": "유기성 자원을 연소하거나 분해하여 전력을 생산합니다.", "설치비용": 15500, "설치시간(초)": 12},
    {"이름": "디젤발전기", "세부설명": "디젤 연료를 사용하여 안정적으로 전력을 생산합니다.", "설치비용": 16000, "설치시간(초)": 9},
    {"이름": "조력발전기", "세부설명": "밀물과 썰물의 수위를 이용해 전력을 생산합니다.", "설치비용": 20000, "설치시간(초)": 15},
    {"이름": "연료전지 발전기(수소)", "세부설명": "수소와 산소의 화학 반응을 통해 전력을 생산합니다.", "설치비용": 45000, "설치시간(초)": 12},
    {"이름": "지열발전기", "세부설명": "지열을 이용하여 안정적이고 지속적인 전력을 생산합니다.", "설치비용": 72500, "설치시간(초)": 15},
    {"이름": "가스터빈 발전기", "세부설명": "가스를 연료로 높은 출력의 전력을 생산합니다.", "설치비용": 100000, "설치시간(초)": 18},
    {"이름": "수소 가스터빈 발전기", "세부설명": "수소를 연료로 사용하는 친환경 고출력 발전기입니다.", "설치비용": 150000, "설치시간(초)": 18},
    {"이름": "수력발전(댐)", "세부설명": "대규모 댐의 낙차를 이용해 전기를 생산합니다.", "설치비용": 500000, "설치시간(초)": 21},
    {"이름": "LNG 복합화력발전기", "세부설명": "LNG를 이용한 고효율 복합 발전 시스템입니다.", "설치비용": 1000000, "설치시간(초)": 24},
    {"이름": "석탄 화력발전기", "세부설명": "석탄을 연소하여 대규모 전력을 생산합니다.", "설치비용": 1500000, "설치시간(초)": 27},
    {"이름": "원자력 발전기", "세부설명": "핵분열을 이용해 막대한 양의 전력을 생산합니다.", "설치비용": 2500000, "설치시간(초)": 30},
    {"이름": "인공 태양 발전기", "세부설명": "핵융합 기반의 초고출력 에너지를 생산합니다.", "설치비용": 10000000, "설치시간(초)": 36},
    {"이름": "초신성 발전기", "세부설명": "초신성 폭발 에너지를 이용한 가상의 초고출력 발전 장치입니다.", "설치비용": 20000000, "설치시간(초)": 60},
    {"이름": "반물질 발전기", "세부설명": "반물질과 물질의 반응으로 극대한 에너지를 생산합니다.", "설치비용": 100000000, "설치시간(초)": 45},
]

DEFAULT_GENERATOR_NAME_TO_INDEX = {t["이름"]: idx for idx, t in enumerate(DEFAULT_GENERATOR_TYPES)}
DEFAULT_GENERATOR_TIME_BY_NAME = {t["이름"]: int(t.get("설치시간(초)") or 0) for t in DEFAULT_GENERATOR_TYPES}


def ensure_user_upgrade_columns():
    """Ensure legacy sqlite DBs contain the newest user upgrade columns."""
    needed = [
        ("production_bonus", "INTEGER NOT NULL DEFAULT 0"),
        ("heat_reduction", "INTEGER NOT NULL DEFAULT 0"),
        ("tolerance_bonus", "INTEGER NOT NULL DEFAULT 0"),
        ("max_generators_bonus", "INTEGER NOT NULL DEFAULT 0"),
        ("money", "INTEGER NOT NULL DEFAULT 10"),
        ("supply_bonus", "INTEGER NOT NULL DEFAULT 0"),
    ]
    with engine.begin() as conn:
        existing = set()
        rows = conn.exec_driver_sql("PRAGMA table_info('users')").fetchall()
        for r in rows:
            existing.add(r[1])
        for col_name, col_def in needed:
            if col_name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")


def ensure_big_value_columns():
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


def ensure_generator_columns():
    """Ensure legacy sqlite DBs contain the newest generator columns."""
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
        cost = _normalize_cost(src.get("설치비용") or src.get("cost") or 0)
        row = existing.get(name)
        if not row:
            db.add(GeneratorType(name=name, description=desc, cost=cost))
            changed = True
            continue
        updated = False
        if row.description != desc:
            row.description = desc
            updated = True
        if row.cost != cost:
            row.cost = cost
            updated = True
        if updated:
            changed = True
    if changed:
        db.commit()


def get_build_time_by_name(name: str | None) -> int:
    if not name:
        return 0
    return DEFAULT_GENERATOR_TIME_BY_NAME.get(name, 0)
