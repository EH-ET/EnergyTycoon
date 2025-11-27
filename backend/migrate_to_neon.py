#!/usr/bin/env python3
"""
Migration script to copy data from SQLite to Neon PostgreSQL.
Run this once to migrate your existing data.
"""
import os
import sys
import pathlib

# Ensure package imports work
ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

# Load .env file
from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Base, User, GeneratorType, Generator, MapProgress
from backend.init_db import sync_generator_types


def migrate():
    # SQLite source
    sqlite_url = "sqlite:///./data/energy_tycoon.db"
    sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    SqliteSession = sessionmaker(bind=sqlite_engine)

    # Ensure legacy SQLite DB has the demand_bonus column populated
    with sqlite_engine.begin() as conn:
        rows = conn.exec_driver_sql("PRAGMA table_info('users')").fetchall()
        cols = {row[1] for row in rows}
        if "demand_bonus" not in cols:
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN demand_bonus INTEGER NOT NULL DEFAULT 0")
            cols.add("demand_bonus")
        if "supply_bonus" in cols:
            conn.exec_driver_sql("UPDATE users SET demand_bonus = supply_bonus WHERE demand_bonus = 0")

    # PostgreSQL (Neon) destination
    postgres_url = os.getenv("DATABASE_URL")
    if not postgres_url or postgres_url.startswith("sqlite"):
        print("Error: DATABASE_URL must be set to your Neon PostgreSQL connection string")
        print("Current DATABASE_URL:", postgres_url)
        sys.exit(1)

    postgres_engine = create_engine(postgres_url)
    PostgresSession = sessionmaker(bind=postgres_engine)

    print("Creating tables in Neon...")
    Base.metadata.create_all(bind=postgres_engine)

    with SqliteSession() as src_db, PostgresSession() as dst_db:
        print("\nMigrating generator types...")
        # First sync generator types (this will create the default ones)
        sync_generator_types(dst_db)
        dst_db.commit()  # Commit to ensure types are persisted

        # Get existing generator types from both databases for ID mapping
        src_gen_types = {gt.generator_type_id: gt for gt in src_db.query(GeneratorType).all()}
        dst_gen_types = {gt.name: gt for gt in dst_db.query(GeneratorType).all()}

        # Map source IDs to destination IDs by name
        gen_type_id_map = {}
        for src_id, src_gt in src_gen_types.items():
            if src_gt.name in dst_gen_types:
                gen_type_id_map[src_id] = dst_gen_types[src_gt.name].generator_type_id
            else:
                print(f"  Warning: Generator type '{src_gt.name}' not found in destination")

        print(f"  Synced {len(dst_gen_types)} generator types")
        print(f"  Mapped {len(gen_type_id_map)} generator type IDs")

        print("\nMigrating users...")
        users = src_db.query(User).all()
        user_id_map = {}
        for user in users:
            new_user = User(
                user_id=user.user_id,
                username=user.username,
                password=user.password,
                energy=user.energy,
                money=user.money,
                energy_data=user.energy_data,
                energy_high=user.energy_high,
                money_data=user.money_data,
                money_high=user.money_high,
                production_bonus=user.production_bonus,
                heat_reduction=user.heat_reduction,
                tolerance_bonus=user.tolerance_bonus,
                max_generators_bonus=user.max_generators_bonus,
                demand_bonus=user.demand_bonus,
            )
            dst_db.add(new_user)
            user_id_map[user.user_id] = user.user_id
        dst_db.commit()
        print(f"  Migrated {len(users)} users")

        print("\nMigrating generators...")
        generators = src_db.query(Generator).all()
        generator_id_map = {}
        skipped = 0
        for gen in generators:
            # Skip generators with unmapped types
            if gen.generator_type_id not in gen_type_id_map:
                print(f"  Warning: Skipping generator {gen.generator_id} with unmapped type ID {gen.generator_type_id}")
                skipped += 1
                continue

            new_gen = Generator(
                generator_id=gen.generator_id,
                generator_type_id=gen_type_id_map[gen.generator_type_id],
                owner_id=gen.owner_id,
                level=gen.level,
                x_position=gen.x_position,
                world_position=gen.world_position,
                isdeveloping=gen.isdeveloping,
                build_complete_ts=gen.build_complete_ts,
                heat=gen.heat,
                running=gen.running,
            )
            dst_db.add(new_gen)
            generator_id_map[gen.generator_id] = gen.generator_id
        dst_db.commit()
        print(f"  Migrated {len(generators) - skipped} generators (skipped {skipped})")

        print("\nMigrating map progress...")
        map_progresses = src_db.query(MapProgress).all()
        mp_skipped = 0
        for mp in map_progresses:
            # Skip map progress for unmigrated generators
            if mp.generator_id not in generator_id_map:
                mp_skipped += 1
                continue

            new_mp = MapProgress(
                map_progress_id=mp.map_progress_id,
                user_id=mp.user_id,
                generator_id=mp.generator_id,
                production_upgrade=mp.production_upgrade,
                heat_reduction_upgrade=mp.heat_reduction_upgrade,
                tolerance_upgrade=mp.tolerance_upgrade,
            )
            dst_db.add(new_mp)
        dst_db.commit()
        print(f"  Migrated {len(map_progresses) - mp_skipped} map progress records (skipped {mp_skipped})")

    print("\n✓ Migration complete!")
    print(f"  - {len(dst_gen_types)} generator types")
    print(f"  - {len(users)} users")
    print(f"  - {len(generators)} generators")
    print(f"  - {len(map_progresses)} map progress records")


if __name__ == "__main__":
    migrate()
