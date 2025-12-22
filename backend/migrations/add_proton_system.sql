-- 양성자 시스템 추가를 위한 SQL 마이그레이션 스크립트
-- PostgreSQL 전용

-- Proton resource columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_data BIGINT DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_high BIGINT DEFAULT 0 NOT NULL;

-- Proton related upgrades in other categories
ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_gain_money_upgrade INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_gain_rebirth_upgrade INTEGER DEFAULT 0 NOT NULL;

-- Proton Upgrades
ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_demand_increase_upgrade INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_energy_gain_upgrade INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_sparkle_gain_upgrade INTEGER DEFAULT 0 NOT NULL;

-- Special Upgrades
ALTER TABLE users ADD COLUMN IF NOT EXISTS proton_gain_special_upgrade INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sparkle_gain_special_upgrade INTEGER DEFAULT 0 NOT NULL;
