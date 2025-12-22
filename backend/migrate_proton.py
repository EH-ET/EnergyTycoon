"""
양성자 시스템 추가를 위한 DB 마이그레이션 스크립트
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import text

# Load environment variables from .env
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

from database import engine

def migrate_proton_system():
    """Add proton system columns to users table"""
    
    migration_steps = [
        # Proton resource
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_data BIGINT DEFAULT 0 NOT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_high BIGINT DEFAULT 0 NOT NULL",
        
        # Proton related upgrades in other categories
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_gain_money_upgrade INTEGER DEFAULT 0 NOT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_gain_rebirth_upgrade INTEGER DEFAULT 0 NOT NULL",
        
        # Proton Upgrades
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_demand_increase_upgrade INTEGER DEFAULT 0 NOT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_energy_gain_upgrade INTEGER DEFAULT 0 NOT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_sparkle_gain_upgrade INTEGER DEFAULT 0 NOT NULL",
        
        # Special Upgrades
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_gain_special_upgrade INTEGER DEFAULT 0 NOT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS sparkle_gain_special_upgrade INTEGER DEFAULT 0 NOT NULL",
    ]
    
    with engine.connect() as conn:
        for step in migration_steps:
            try:
                print(f"Executing: {step}")
                conn.execute(text(step))
                conn.commit()
                print("✓ Success")
            except Exception as e:
                print(f"✗ Error: {e}")
                # Continue with next step even if one fails (column might already exist)
                continue
    
    print("\n✅ Migration completed!")

if __name__ == "__main__":
    migrate_proton_system()
