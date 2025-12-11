from sqlalchemy.orm import Session

from .database import engine
from .models import User, GeneratorType


# 기본 발전기 목록 (프론트엔드 generators 배열과 동일한 순서)
DEFAULT_GENERATOR_TYPES = [
  {"이름": "식물 광합성 전지", "세부설명": "식물의 광합성을 이용해 소량의 전기를 생산합니다. 낮에만 작동합니다.", "설치비용(수)": 10000, "설치비용(높이)": 0, "설치시간(초)": 3, "생산량(에너지수)": 1000, "생산량(에너지높이)": 0, "크기": 1, "내열한계": 3, "발열": 0},
  {"이름": "소형 태양광 패널(개인용)", "세부설명": "작은 태양광 패널로 태양 에너지를 이용해 전기를 생산합니다.", "설치비용(수)": 250000, "설치비용(높이)": 0, "설치시간(초)": 4, "생산량(에너지수)": 2600, "생산량(에너지높이)": 0, "크기": 2, "내열한계": 10, "발열": 1},
  {"이름": "소형 풍력발전기(마이크로)", "세부설명": "작은 풍력 장치를 이용해 바람으로 전기를 생산합니다.", "설치비용(수)": 100000, "설치비용(높이)": 1, "설치시간(초)": 6, "생산량(에너지수)": 6800, "생산량(에너지높이)": 0, "크기": 2, "내열한계": 15, "발열": 1},
  {"이름": "소수력발전기(마을급)", "세부설명": "물을 흐르게 하여 안정적으로 전기를 생산합니다.", "설치비용(수)": 360000, "설치비용(높이)": 1, "설치시간(초)": 9, "생산량(에너지수)": 18000, "생산량(에너지높이)": 0, "크기": 2.2, "내열한계": 25, "발열": 2},
  {"이름": "육상 풍력발전기(일반형)", "세부설명": "육지에서 설치하는 일반적인 풍력 발전기입니다.", "설치비용(수)": 120000, "설치비용(높이)": 2, "설치시간(초)": 13, "생산량(에너지수)": 54000, "생산량(에너지높이)": 0, "크기": 3, "내열한계": 40, "발열": 1},
  {"이름": "부유식 태양광(중형)", "세부설명": "수면 위에 설치된 태양광 패널을 이용해 전력을 생산합니다.", "설치비용(수)": 720000, "설치비용(높이)": 2, "설치시간(초)": 18, "생산량(에너지수)": 150000, "생산량(에너지높이)": 0, "크기": 3, "내열한계": 75, "발열": 4},
  {"이름": "파력발전기(해양파)", "세부설명": "해양 파도의 운동 에너지를 이용해 전기를 생산합니다.", "설치비용(수)": 500000, "설치비용(높이)": 3, "설치시간(초)": 24, "생산량(에너지수)": 500000, "생산량(에너지높이)": 0, "크기": 2.3, "내열한계": 112, "발열": 3},
  {"이름": "해상 풍력발전기(대형 터빈)", "세부설명": "해상에서 강한 바람을 이용해 전력을 생산하는 대형 설비입니다.", "설치비용(수)": 310000, "설치비용(높이)": 4, "설치시간(초)": 31, "생산량(에너지수)": 200000, "생산량(에너지높이)": 1, "크기": 3.5, "내열한계": 165, "발열": 3},
  {"이름": "폐열회수 보일러발전기", "세부설명": "산업 공정에서 버려지는 열을 회수하여 전력을 생산합니다.", "설치비용(수)": 200000, "설치비용(높이)": 5, "설치시간(초)": 39, "생산량(에너지수)": 750000, "생산량(에너지높이)": 1, "크기": 2.4, "내열한계": 225, "발열": 8},
  {"이름": "바이오매스 발전기", "세부설명": "유기성 자원을 연소하거나 분해하여 전력을 생산합니다.", "설치비용(수)": 120000, "설치비용(높이)": 6, "설치시간(초)": 48, "생산량(에너지수)": 300000, "생산량(에너지높이)": 2, "크기": 2.1, "내열한계": 295, "발열": 10},
  {"이름": "디젤발전기", "세부설명": "디젤 연료를 사용하여 안정적으로 전력을 생산합니다.", "설치비용(수)": 800000, "설치비용(높이)": 6, "설치시간(초)": 58, "생산량(에너지수)": 100000, "생산량(에너지높이)": 3, "크기": 2.3, "내열한계": 375, "발열": 15},
  {"이름": "조력발전기", "세부설명": "밀물과 썰물의 수위를 이용해 전력을 생산합니다.", "설치비용(수)": 100000, "설치비용(높이)": 8, "설치시간(초)": 69, "생산량(에너지수)": 350000, "생산량(에너지높이)": 3, "크기": 2.5, "내열한계": 425, "발열": 4},
  {"이름": "연료전지 발전기(수소)", "세부설명": "수소와 산소의 화학 반응을 통해 전력을 생산합니다.", "설치비용(수)": 382500, "설치비용(높이)": 8, "설치시간(초)": 81, "생산량(에너지수)": 150000, "생산량(에너지높이)": 4, "크기": 2.7, "내열한계": 625, "발열": 50},
  {"이름": "지열발전기", "세부설명": "지열을 이용하여 안정적이고 지속적인 전력을 생산합니다.", "설치비용(수)": 255500, "설치비용(높이)": 9, "설치시간(초)": 94, "생산량(에너지수)": 400000, "생산량(에너지높이)": 4, "크기": 2.5, "내열한계": 750, "발열": 18},
  {"이름": "가스터빈 발전기", "세부설명": "가스를 연료로 높은 출력의 전력을 생산합니다.", "설치비용(수)": 130000, "설치비용(높이)": 11, "설치시간(초)": 108, "생산량(에너지수)": 225000, "생산량(에너지높이)": 5, "크기": 2.8, "내열한계": 875, "발열": 45},
  {"이름": "수소 가스터빈 발전기", "세부설명": "수소를 연료로 사용하는 친환경 고출력 발전기입니다.", "설치비용(수)": 950000, "설치비용(높이)": 11, "설치시간(초)": 123, "생산량(에너지수)": 215700, "생산량(에너지높이)": 6, "크기": 2.9, "내열한계": 925, "발열": 50},
  {"이름": "수력발전(댐)", "세부설명": "대규모 댐의 낙차를 이용해 전기를 생산합니다.", "설치비용(수)": 800000, "설치비용(높이)": 12, "설치시간(초)": 139, "생산량(에너지수)": 855000, "생산량(에너지높이)": 6, "크기": 3.4, "내열한계": 1024, "발열": 28},
  {"이름": "LNG 복합화력발전기", "세부설명": "LNG를 이용한 고효율 복합 발전 시스템입니다.", "설치비용(수)": 420000, "설치비용(높이)": 13, "설치시간(초)": 156, "생산량(에너지수)": 300000, "생산량(에너지높이)": 7, "크기": 2.7, "내열한계": 1200, "발열": 62},
  {"이름": "석탄 화력발전기", "세부설명": "석탄을 연소하여 대규모 전력을 생산합니다.", "설치비용(수)": 325100, "설치비용(높이)": 15, "설치시간(초)": 174, "생산량(에너지수)": 115000, "생산량(에너지높이)": 8, "크기": 3.4, "내열한계": 1650, "발열": 85},
  {"이름": "원자력 발전기", "세부설명": "핵분열을 이용해 막대한 양의 전력을 생산합니다.", "설치비용(수)": 161500, "설치비용(높이)": 17, "설치시간(초)": 193, "생산량(에너지수)": 200000, "생산량(에너지높이)": 9, "크기": 4, "내열한계": 3250, "발열": 300},
  {"이름": "인공 태양 발전기", "세부설명": "핵융합 기반의 초고출력 에너지를 생산합니다.", "설치비용(수)": 200000, "설치비용(높이)": 22, "설치시간(초)": 213, "생산량(에너지수)": 250000, "생산량(에너지높이)": 10, "크기": 4.3, "내열한계": 5200, "발열": 1200},
  {"이름": "항성 핵 발전기", "세부설명": "작은 항성의 핵 반응을 모사해 고밀도 에너지를 안정적으로 뽑아내는 초고출력 발전기입니다.", "설치비용(수)": 927000, "설치비용(높이)": 25, "설치시간(초)": 234, "생산량(에너지수)": 500000, "생산량(에너지높이)": 11, "크기": 4.5, "내열한계": 6800, "발열": 1800},
  {"이름": "초신성 발전기", "세부설명": "초신성 폭발 에너지를 이용한 가상의 초고출력 발전 장치입니다.", "설치비용(수)": 325000, "설치비용(높이)": 27, "설치시간(초)": 256, "생산량(에너지수)": 420000, "생산량(에너지높이)": 12, "크기": 4.7, "내열한계": 7500, "발열": 2450},
  {"이름": "반물질 발전기", "세부설명": "반물질과 물질의 반응으로 극대한 에너지를 생산합니다.", "설치비용(수)": 175000, "설치비용(높이)": 29, "설치시간(초)": 279, "생산량(에너지수)": 267000, "생산량(에너지높이)": 13, "크기": 4.8, "내열한계": 8750, "발열": 3200},
  {"이름": "양자 진동 발전기", "세부설명": "양자장의 미세한 에너지 흔들림을 포착해 안정적으로 전력으로 변환하는 초고효율 발전기입니다.", "설치비용(수)": 115000, "설치비용(높이)": 31, "설치시간(초)": 303, "생산량(에너지수)": 105000, "생산량(에너지높이)": 15, "크기": 4.9, "내열한계": 9550, "발열": 3850},
  {"이름": "쿼크 응축 발전기", "세부설명": "쿼크-글루온 플라즈마를 초고압으로 안정화해 압도적인 에너지를 추출하는 초고밀도 발전기입니다.", "설치비용(수)": 870000, "설치비용(높이)": 36, "설치시간(초)": 328, "생산량(에너지수)": 472500, "생산량(에너지높이)": 17, "크기": 5.0, "내열한계": 11200, "발열": 4320},
  {"이름": "중력 우물 발전기", "세부설명": "인공적으로 형성한 미세 블랙홀의 강력한 중력 에너지를 끌어내 전력으로 전환하는 초중력 기반 발전기입니다.", "설치비용(수)": 125000, "설치비용(높이)": 41, "설치시간(초)": 354, "생산량(에너지수)": 222200, "생산량(에너지높이)": 19, "크기": 5.2, "내열한계": 12500, "발열": 4750},
  {"이름": "엔트로피 역행 발전기", "세부설명": "무질서도가 감소하는 특이 현상을 역이용해 물리 법칙을 거스르는 막대한 에너지를 생성하는 최종단계급 발전기입니다.", "설치비용(수)": 775000, "설치비용(높이)": 46, "설치시간(초)": 381, "생산량(에너지수)": 655000, "생산량(에너지높이)": 20, "크기": 5.3, "내열한계": 14200, "발열": 5620},
  {"이름": "특이점 압축 발전기", "세부설명": "초미세 특이점을 인공적으로 생성·안정화해 극도의 중력 에너지를 짜내는 초고출력 발전기입니다.", "설치비용(수)": 375000, "설치비용(높이)": 51, "설치시간(초)": 408, "생산량(에너지수)": 425000, "생산량(에너지높이)": 22, "크기": 4.8, "내열한계": 16500, "발열": 6730},
  {"이름": "제로포인트 에너지 코어 발전기", "세부설명": "진공 상태에 존재하는 무한한 기본 에너지를 직접 추출해 극도로 효율적인 전력을 생산하는 궁극의 안정형 발전기입니다.", "설치비용(수)": 997000, "설치비용(높이)": 59, "설치시간(초)": 436, "생산량(에너지수)": 552000, "생산량(에너지높이)": 23, "크기": 5.6, "내열한계": 18250, "발열": 7990},
  {"이름": "고차원 에너지 공명 발전기", "세부설명": "4차원 너머의 고차원 공간에서 누출되는 에너지를 공명시켜 현실 차원으로 끌어오는 초고효율 차원간 발전기입니다.", "설치비용(수)": 867000, "설치비용(높이)": 65, "설치시간(초)": 465, "생산량(에너지수)": 213000, "생산량(에너지높이)": 25, "크기": 5.4, "내열한계": 19100, "발열": 9250},
  {"이름": "초공간 균열 에너지 추출 발전기", "세부설명": "초공간 구조에 발생한 미세 균열을 확장하여 누출되는 비정상적 에너지 흐름을 고밀도로 회수하는 발전기입니다.", "설치비용(수)": 473000, "설치비용(높이)": 73, "설치시간(초)": 495, "생산량(에너지수)": 517500, "생산량(에너지높이)": 26, "크기": 5.5, "내열한계": 20500, "발열": 10000},
  {"이름": "양자 진공 불안정 반응 발전기", "세부설명": "진공의 양자 요동을 강제로 불안정화시켜 붕괴 과정에서 분출되는 고차원 에너지를 전력화하는 발전기입니다.", "설치비용(수)": 111000, "설치비용(높이)": 81, "설치시간(초)": 530, "생산량(에너지수)": 365000, "생산량(에너지높이)": 27, "크기": 5.6, "내열한계": 22000, "발열": 12725},
  {"이름": "다중특이점 공진 발전기", "세부설명": "복수의 미세 블랙홀을 공진 배열로 배치해 상호 간섭으로 생성되는 초중력 에너지를 추출하는 발전기입니다.", "설치비용(수)": 876500, "설치비용(높이)": 89, "설치시간(초)": 560, "생산량(에너지수)": 177000, "생산량(에너지높이)": 29, "크기": 5.5, "내열한계": 24300, "발열": 13500},
  {"이름": "초대칭 붕괴 기반 에너지 발전기", "세부설명": "초대칭 입자의 대칭 붕괴가 유발하는 이론적 초고출력 에너지 폭발을 안정적으로 포획하는 발전기입니다.", "설치비용(수)": 997000, "설치비용(높이)": 97, "설치시간(초)": 590, "생산량(에너지수)": 235000, "생산량(에너지높이)": 30, "크기": 5.7, "내열한계": 25500, "발열": 14200},
  {"이름": "원초입자 응축 에너지 발전기", "세부설명": "우주 초기 상태에서만 존재하던 원초입자를 인공 생성·응축해 존재 압력을 직접 전력으로 변환하는 발전기입니다.", "설치비용(수)": 514000, "설치비용(높이)": 105, "설치시간(초)": 620, "생산량(에너지수)": 897000, "생산량(에너지높이)": 32, "크기": 5.3, "내열한계": 26700, "발열": 15500},
  {"이름": "엔트로피 제로 상태 구현 발전기", "세부설명": "엔트로피가 0이 되는 정적 우주 상태를 국소적으로 재현하여 무한대에 가까운 에너지를 회수하는 발전기입니다.", "설치비용(수)": 198000, "설치비용(높이)": 113, "설치시간(초)": 650, "생산량(에너지수)": 197000, "생산량(에너지높이)": 34, "크기": 5.5, "내열한계": 28000, "발열": 17000},
  {"이름": "초차원 압력 변환 발전기", "세부설명": "4차원 이상에서 작용하는 고차원 압력축을 현실 공간으로 투사해 차원압력 에너지를 추출하는 발전기입니다.", "설치비용(수)": 798000, "설치비용(높이)": 121, "설치시간(초)": 680, "생산량(에너지수)": 321000, "생산량(에너지높이)": 36, "크기": 5.6, "내열한계": 28500, "발열": 18500},
  {"이름": "우주배경장 왜곡 변환 발전기", "세부설명": "우주 전체에 깔린 배경장을 인위적으로 왜곡시켜 고 에너지 파동 간섭을 전력으로 전환하는 발전기입니다.", "설치비용(수)": 397000, "설치비용(높이)": 130, "설치시간(초)": 710, "생산량(에너지수)": 155000, "생산량(에너지높이)": 38, "크기": 5.5, "내열한계": 29300, "발열": 19700},
  {"이름": "근본상수 변조형 에너지 발전기", "세부설명": "빛의 속도나 플랑크 상수 등 근본 물리상수를 미세 조정해 상수 재정렬 과정에서 발생하는 에너지를 회수하는 발전기입니다.", "설치비용(수)": 899000, "설치비용(높이)": 140, "설치시간(초)": 740, "생산량(에너지수)": 279000, "생산량(에너지높이)": 40, "크기": 5.7, "내열한계": 30500, "발열": 21000},
  {"이름": "전역 시공간 재구성 발전기", "세부설명": "우주의 시공간 격자를 주기적으로 재배열하며 그 과정에서 발생하는 구조적 에너지 손실을 100% 전력으로 변환하는 발전기입니다.", "설치비용(수)": 425000, "설치비용(높이)": 150, "설치시간(초)": 770, "생산량(에너지수)": 175000, "생산량(에너지높이)": 42, "크기": 5.8, "내열한계": 31200, "발열": 22500},
  {"이름": "변종 오가네손 융합 발전기", "세부설명": "변종 오가네손 핵의 초안정화 융합 반응에서 발생하는 극초단 파장의 초고밀도 에너지를 직접 전력으로 변환하는 발전기입니다.", "설치비용(수)": 777000, "설치비용(높이)": 160, "설치시간(초)": 800, "생산량(에너지수)": 111000, "생산량(에너지높이)": 44, "크기": 5.7, "내열한계": 32000, "발열": 23500},
  {"이름": "신성 엔진 발전기", "세부설명": "현실 법칙을 초월한 에너지 원천을 직접 조율해 사실상 무한에 가까운 힘을 발산하는 최종 단계의 초월적 발전기입니다.", "설치비용(수)": 100000, "설치비용(높이)": 1250000, "설치시간(초)": 830, "생산량(에너지수)": 100000, "생산량(에너지높이)": 46, "크기": 5.8, "내열한계": 33000, "발열": 24700},
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
                ("demand_bonus", "INTEGER NOT NULL DEFAULT 0"),
                ("rebirth_count", "INTEGER NOT NULL DEFAULT 0"),
                ("rebirth_chain_upgrade", "INTEGER NOT NULL DEFAULT 0"),
                ("upgrade_batch_upgrade", "INTEGER NOT NULL DEFAULT 0"),
                ("rebirth_start_money_upgrade", "INTEGER NOT NULL DEFAULT 0"),
                ("tutorial", "INTEGER NOT NULL DEFAULT 1"),
                ("supercoin", "INTEGER NOT NULL DEFAULT 0"),
                ("build_speed_reduction", "INTEGER NOT NULL DEFAULT 0"),
                ("energy_multiplier", "INTEGER NOT NULL DEFAULT 0"),
                ("exchange_rate_multiplier", "INTEGER NOT NULL DEFAULT 0"),
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
            
            # Migrate sold_energy -> sold_energy_data if needed
            if "sold_energy" in cols and "sold_energy_data" in cols:
                conn.exec_driver_sql("UPDATE users SET sold_energy_data = sold_energy WHERE sold_energy_data = 0 AND sold_energy > 0")
                try:
                    conn.exec_driver_sql("ALTER TABLE users DROP COLUMN sold_energy")
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
            if "rebirth_chain_upgrade" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS rebirth_chain_upgrade INTEGER NOT NULL DEFAULT 0"
                )
                existing.add("rebirth_chain_upgrade")
            if "upgrade_batch_upgrade" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS upgrade_batch_upgrade INTEGER NOT NULL DEFAULT 0"
                )
                existing.add("upgrade_batch_upgrade")
            if "rebirth_start_money_upgrade" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS rebirth_start_money_upgrade INTEGER NOT NULL DEFAULT 0"
                )
                existing.add("rebirth_start_money_upgrade")
            if "tutorial" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial INTEGER NOT NULL DEFAULT 1"
                )
                existing.add("tutorial")
            if "sold_energy_data" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS sold_energy_data BIGINT NOT NULL DEFAULT 0"
                )
                existing.add("sold_energy_data")
            if "sold_energy_high" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS sold_energy_high BIGINT NOT NULL DEFAULT 0"
                )
                existing.add("sold_energy_high")
            # Backfill and clean up legacy column if it still exists
            if "supply_bonus" in existing:
                conn.exec_driver_sql("UPDATE users SET demand_bonus = COALESCE(demand_bonus, supply_bonus) WHERE demand_bonus IS NULL")
                conn.exec_driver_sql("ALTER TABLE users DROP COLUMN supply_bonus")
            
            # Migrate sold_energy -> sold_energy_data if needed
            if "sold_energy" in existing and "sold_energy_data" in existing:
                conn.exec_driver_sql("UPDATE users SET sold_energy_data = sold_energy WHERE sold_energy_data = 0 AND sold_energy > 0")
                conn.exec_driver_sql("ALTER TABLE users DROP COLUMN sold_energy")
            conn.exec_driver_sql("UPDATE users SET demand_bonus = 0 WHERE demand_bonus IS NULL")
            conn.exec_driver_sql("ALTER TABLE users ALTER COLUMN demand_bonus SET DEFAULT 0")
            conn.exec_driver_sql("ALTER TABLE users ALTER COLUMN demand_bonus SET NOT NULL")
            
            # Migrate BigValue columns to BIGINT to prevent overflow
            bigvalue_columns = ["energy_data", "energy_high", "money_data", "money_high", "sold_energy_data", "sold_energy_high"]
            for col in bigvalue_columns:
                if col in existing:
                    # Check if column is already BIGINT
                    type_check = conn.exec_driver_sql(
                        f"SELECT data_type FROM information_schema.columns "
                        f"WHERE table_name = 'users' AND column_name = '{col}'"
                    ).fetchone()
                    if type_check and type_check[0] == 'integer':
                        # Convert INTEGER to BIGINT
                        conn.exec_driver_sql(f"ALTER TABLE users ALTER COLUMN {col} TYPE BIGINT")
            
            # Add supercoin column if it doesn't exist
            if "supercoin" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS supercoin INTEGER NOT NULL DEFAULT 0"
                )
                existing.add("supercoin")
            
            # Add special upgrade columns
            if "build_speed_reduction" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS build_speed_reduction INTEGER NOT NULL DEFAULT 0"
                )
                existing.add("build_speed_reduction")
            if "energy_multiplier" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_multiplier INTEGER NOT NULL DEFAULT 0"
                )
                existing.add("energy_multiplier")
            if "exchange_rate_multiplier" not in existing:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS exchange_rate_multiplier INTEGER NOT NULL DEFAULT 0"
                )
                existing.add("exchange_rate_multiplier")


def ensure_big_value_columns():
    # Skip for PostgreSQL - create_all() handles schema
    if not str(engine.url).startswith("sqlite"):
        return

    needed = [
        ("money_data", "INTEGER NOT NULL DEFAULT 0"),
        ("money_high", "INTEGER NOT NULL DEFAULT 0"),
        ("energy_data", "INTEGER NOT NULL DEFAULT 0"),
        ("energy_high", "INTEGER NOT NULL DEFAULT 0"),
        ("sold_energy_data", "INTEGER NOT NULL DEFAULT 0"),
        ("sold_energy_high", "INTEGER NOT NULL DEFAULT 0"),
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
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS play_time_ms BIGINT NOT NULL DEFAULT 0"
                )
            else:
                # Migrate INTEGER to BIGINT if needed
                type_check = conn.exec_driver_sql(
                    "SELECT data_type FROM information_schema.columns "
                    "WHERE table_name = 'users' AND column_name = 'play_time_ms'"
                ).fetchone()
                if type_check and type_check[0] == 'integer':
                    conn.exec_driver_sql("ALTER TABLE users ALTER COLUMN play_time_ms TYPE BIGINT")


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


def ensure_refresh_jti_column():
    """Ensure users table has refresh_jti column for refresh token rotation."""
    dialect = engine.dialect.name
    column_name = "refresh_jti"
    
    if dialect == "sqlite":
        with engine.begin() as conn:
            rows = conn.exec_driver_sql(f"PRAGMA table_info('users')").fetchall()
            cols = {r[1] for r in rows}
            if column_name not in cols:
                conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {column_name} VARCHAR")
        return

    if "postgres" in dialect:
        with engine.begin() as conn:
            rows = conn.exec_driver_sql(
                f"SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
            ).fetchall()
            existing = {row[0] for row in rows}
            if column_name not in existing:
                conn.exec_driver_sql(
                    f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {column_name} VARCHAR"
                )
