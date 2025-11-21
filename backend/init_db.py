from sqlalchemy.orm import Session

from .database import engine
from .models import User, GeneratorType


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
    ]
    with engine.begin() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info('generators')")}
        for col_name, col_def in needed:
            if col_name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE generators ADD COLUMN {col_name} {col_def}")


def create_default_generator_types(db: Session):
    """Seed default generator types if none exist."""
    if db.query(GeneratorType).count() == 0:
        default_types = [
            {"name": "광합성", "description": "태양을 이용해 에너지를 생산합니다. 낮에만 작동합니다.", "cost": 5},
            {"name": "풍력", "description": "바람을 이용해 에너지를 생산합니다.", "cost": 20},
            {"name": "지열", "description": "지열을 이용해 안정적으로 전력을 생산합니다.", "cost": 50},
        ]
        for t in default_types:
            db.add(GeneratorType(name=t["name"], description=t["description"], cost=t["cost"]))
        db.commit()
