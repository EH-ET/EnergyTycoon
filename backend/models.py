from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base
from .auth_utils import generate_uuid

CASCADE_OPTION = "all, delete-orphan"


class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, default=generate_uuid, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    energy = Column(Integer, default=0, nullable=False)
    money = Column(Integer, default=10, nullable=False)
    energy_data = Column(Integer, default=0, nullable=False)
    energy_high = Column(Integer, default=0, nullable=False)
    money_data = Column(Integer, default=0, nullable=False)
    money_high = Column(Integer, default=0, nullable=False)
    production_bonus = Column(Integer, default=0, nullable=False)
    heat_reduction = Column(Integer, default=0, nullable=False)
    tolerance_bonus = Column(Integer, default=0, nullable=False)
    max_generators_bonus = Column(Integer, default=0, nullable=False)
    supply_bonus = Column(Integer, default=0, nullable=False)

    generators = relationship("Generator", back_populates="owner", cascade=CASCADE_OPTION)
    map_progresses = relationship("MapProgress", back_populates="user", cascade=CASCADE_OPTION)


class GeneratorType(Base):
    __tablename__ = "generator_types"

    generator_type_id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=False)
    cost = Column(Integer, nullable=False)

    generators = relationship("Generator", back_populates="generator_type")


class Generator(Base):
    __tablename__ = "generators"

    generator_id = Column(String, primary_key=True, default=generate_uuid, index=True)
    generator_type_id = Column(String, ForeignKey("generator_types.generator_type_id"), nullable=False)
    owner_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    level = Column(Integer, default=1, nullable=False)
    x_position = Column(Integer, nullable=False)
    world_position = Column(Integer, nullable=False)
    isdeveloping = Column(Boolean, default=False, nullable=False)
    build_complete_ts = Column(Integer, nullable=True)
    heat = Column(Integer, default=0, nullable=False)
    running = Column(Boolean, default=True, nullable=False)

    owner = relationship("User", back_populates="generators")
    generator_type = relationship("GeneratorType")
    map_progresses = relationship("MapProgress", back_populates="generator", cascade=CASCADE_OPTION)


class MapProgress(Base):
    __tablename__ = "map_progress"

    map_progress_id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    generator_id = Column(String, ForeignKey("generators.generator_id"), nullable=False)
    production_upgrade = Column(Integer, default=0, nullable=False)
    heat_reduction_upgrade = Column(Integer, default=0, nullable=False)
    tolerance_upgrade = Column(Integer, default=0, nullable=False)

    user = relationship("User", back_populates="map_progresses")
    generator = relationship("Generator", back_populates="map_progresses")

    __table_args__ = (UniqueConstraint("user_id", "generator_id", name="_user_generator_uc"),)
