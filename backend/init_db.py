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


def create_default_generator_types(db: Session):
    """Seed default generator types if none exist."""
    if db.query(GeneratorType).count() == 0:
        default_types = [
            {"name": "식물 광합성 전지", "description": "식물의 광합성을 이용해 소량의 전기를 생산합니다. 낮에만 작동합니다.", "cost": 0.5},
            {"name": "소형 태양광 패널(개인용)", "description": "작은 태양광 패널로 태양 에너지를 이용해 전기를 생산합니다.", "cost": 1},
            {"name": "소형 풍력발전기(마이크로)", "description": "작은 풍력 장치를 이용해 바람으로 전기를 생산합니다.", "cost": 20},
            {"name": "소수력발전기(마을급)", "description": "물을 흐르게 하여 안정적으로 전기를 생산합니다.", "cost": 100},
            {"name": "육상 풍력발전기(일반형)", "description": "육지에서 설치하는 일반적인 풍력 발전기입니다.", "cost": 300},
            {"name": "부유식 태양광(중형)", "description": "수면 위에 설치된 태양광 패널을 이용해 전력을 생산합니다.", "cost": 850},
            {"name": "파력발전기(해양파)", "description": "해양 파도의 운동 에너지를 이용해 전기를 생산합니다.", "cost": 3000},
            {"name": "해상 풍력발전기(대형 터빈)", "description": "해상에서 강한 바람을 이용해 전력을 생산하는 대형 설비입니다.", "cost": 5200},
            {"name": "폐열회수 보일러발전기", "description": "산업 공정에서 버려지는 열을 회수하여 전력을 생산합니다.", "cost": 13200},
            {"name": "바이오매스 발전기", "description": "유기성 자원을 연소하거나 분해하여 전력을 생산합니다.", "cost": 15500},
            {"name": "디젤발전기", "description": "디젤 연료를 사용하여 안정적으로 전력을 생산합니다.", "cost": 16000},
            {"name": "조력발전기", "description": "밀물과 썰물의 수위를 이용해 전력을 생산합니다.", "cost": 20000},
            {"name": "연료전지 발전기(수소)", "description": "수소와 산소의 화학 반응을 통해 전력을 생산합니다.", "cost": 45000},
            {"name": "지열발전기", "description": "지열을 이용하여 안정적이고 지속적인 전력을 생산합니다.", "cost": 72500},
            {"name": "가스터빈 발전기", "description": "가스를 연료로 높은 출력의 전력을 생산합니다.", "cost": 100000},
            {"name": "수소 가스터빈 발전기", "description": "수소를 연료로 사용하는 친환경 고출력 발전기입니다.", "cost": 150000},
            {"name": "수력발전(댐)", "description": "대규모 댐의 낙차를 이용해 전기를 생산합니다.", "cost": 500000},
            {"name": "LNG 복합화력발전기", "description": "LNG를 이용한 고효율 복합 발전 시스템입니다.", "cost": 1000000},
            {"name": "석탄 화력발전기", "description": "석탄을 연소하여 대규모 전력을 생산합니다.", "cost": 1500000},
            {"name": "원자력 발전기", "description": "핵분열을 이용해 막대한 양의 전력을 생산합니다.", "cost": 2500000},
            {"name": "인공 태양 발전기", "description": "핵융합 기반의 초고출력 에너지를 생산합니다.", "cost": 10000000},
            {"name": "초신성 발전기", "description": "초신성 폭발 에너지를 이용한 가상의 초고출력 발전 장치입니다.", "cost": 20000000},
            {"name": "반물질 발전기", "description": "반물질과 물질의 반응으로 극대한 에너지를 생산합니다.", "cost": 100000000}
        ]

        for t in default_types:
            db.add(GeneratorType(name=t["name"], description=t["description"], cost=t["cost"]))
        db.commit()
