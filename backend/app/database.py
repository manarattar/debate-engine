import os

from sqlalchemy import (Column, DateTime, Integer, String, Text, create_engine,
                        func)
from sqlalchemy.orm import DeclarativeBase, sessionmaker

os.makedirs("./data", exist_ok=True)

engine = create_engine(
    "sqlite:///./data/debates.db", connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


class Debate(Base):
    __tablename__ = "debates"

    id = Column(String, primary_key=True)
    topic = Column(String, nullable=False)
    status = Column(String, default="processing")  # processing / complete / failed
    result_json = Column(Text, nullable=True)
    view_count = Column(Integer, default=0, nullable=False)
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


class FactCheck(Base):
    __tablename__ = "fact_checks"

    debate_id = Column(String, primary_key=True)
    result_json = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Vote(Base):
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    debate_id = Column(String, nullable=False, index=True)
    phase = Column(String, nullable=False)  # "before" | "after"
    side = Column(String, nullable=False)  # "pro" | "con"
    session_id = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class ArgumentReaction(Base):
    __tablename__ = "argument_reactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    debate_id = Column(String, nullable=False, index=True)
    side = Column(String, nullable=False)  # "pro" | "con"
    round_name = Column(String, nullable=False)
    reaction = Column(String, nullable=False)  # "like" | "dislike"
    session_id = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
