from app.database import Debate, get_db
from app.schemas import GraphData, GraphLink, GraphNode
from app.services.domain_classifier import classify_topic
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("/graph", response_model=GraphData)
def get_graph(db: Session = Depends(get_db)):
    debates = (
        db.query(Debate)
        .filter(Debate.status == "complete")
        .order_by(Debate.created_at.desc())
        .limit(50)
        .all()
    )

    domain_set: set[str] = set()
    topic_nodes: list[GraphNode] = []
    links: list[GraphLink] = []

    for d in debates:
        primary_domain, all_domains = classify_topic(d.topic)
        for domain in all_domains:
            domain_set.add(domain)
            links.append(GraphLink(source=f"domain_{domain}", target=f"topic_{d.id}"))
        topic_nodes.append(
            GraphNode(
                id=f"topic_{d.id}",
                label=d.topic,
                type="topic",
                domain=primary_domain,
                debate_id=d.id,
                view_count=d.view_count or 0,
            )
        )

    domain_nodes = [
        GraphNode(id=f"domain_{domain}", label=domain, type="domain", domain=domain)
        for domain in domain_set
    ]

    return GraphData(
        nodes=domain_nodes + topic_nodes,
        links=links,
        debate_count=len(debates),
        domain_count=len(domain_set),
    )
