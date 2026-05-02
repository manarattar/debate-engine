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


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
