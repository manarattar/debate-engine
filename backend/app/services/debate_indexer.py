import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
import os

os.makedirs("./chroma", exist_ok=True)

_client = chromadb.PersistentClient(path="./chroma")
_embed = DefaultEmbeddingFunction()


def _get_collection(name: str):
    return _client.get_or_create_collection(name=name, embedding_function=_embed)


def index_sources(debate_id: str, side: str, sources: list[dict]):
    """Index source chunks into a per-debate, per-side ChromaDB collection."""
    collection = _get_collection(f"{debate_id}_{side}")
    ids, docs, metas = [], [], []
    for i, src in enumerate(sources):
        ids.append(f"{side}_{i}")
        docs.append(src["excerpt"])
        metas.append({"title": src["title"], "url": src["url"]})
    if ids:
        collection.add(ids=ids, documents=docs, metadatas=metas)


def retrieve(debate_id: str, side: str, query: str, n: int = 4) -> list[dict]:
    """Retrieve top-n relevant chunks for a given query."""
    collection = _get_collection(f"{debate_id}_{side}")
    count = collection.count()
    if count == 0:
        return []
    results = collection.query(
        query_texts=[query],
        n_results=min(n, count),
        include=["documents", "metadatas"],
    )
    chunks = []
    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        chunks.append({"excerpt": doc, "title": meta["title"], "url": meta["url"]})
    return chunks


def delete_debate_collections(debate_id: str):
    for side in ("pro", "con"):
        name = f"{debate_id}_{side}"
        try:
            _client.delete_collection(name)
        except Exception:
            pass
