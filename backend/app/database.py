from sqlalchemy import create_engine, Column, String, Integer, Text, DateTime, func
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os

os.makedirs("./data", exist_ok=True)

engine = create_engine("sqlite:///./data/debates.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


class Debate(Base):
    __tablename__ = "debates"

    id = Column(String, primary_key=True)
    topic = Column(String, nullable=False)
    status = Column(String, default="processing")  # processing / complete / failed
    result_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class HumanDebate(Base):
    __tablename__ = "human_debates"

    id = Column(String, primary_key=True)
    topic = Column(String, nullable=False)
    human_side = Column(String, nullable=False)  # "pro" | "con"
    status = Column(String, default="gathering_sources")
    # gathering_sources | sources_ready | generating_ai_opening | ai_opening_done
    # | generating_ai_rebuttal | complete | failed

    human_opening = Column(Text, nullable=True)
    ai_opening = Column(Text, nullable=True)
    human_rebuttal = Column(Text, nullable=True)
    ai_rebuttal = Column(Text, nullable=True)
    verdict_content = Column(Text, nullable=True)
    winner = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    error_message = Column(Text, nullable=True)


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
