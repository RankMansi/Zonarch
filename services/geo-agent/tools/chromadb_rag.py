"""ChromaDB vector store queries for NYC Zoning Resolution RAG."""

import os
import chromadb
from chromadb.utils import embedding_functions

CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")

SAMPLE_CHUNKS = [
    {
        "text": "ZR 23-154 Universal Affordability Preference: developments providing at least 20% of units as permanently affordable at up to 60% AMI may receive a 20% FAR bonus.",
        "source": "ZR_Article_II",
        "section": "23-154",
        "title": "UAP",
    },
    {
        "text": "ZR 23-47 Rear Yards: in R6 through R10 districts, a rear yard with a minimum depth of 30 feet is required.",
        "source": "ZR_Article_II",
        "section": "23-47",
        "title": "Rear Yards",
    },
    {
        "text": "ZR 23-631 Sky Exposure Plane: on wide streets in R7X districts, buildings may rise 85 feet before the sky exposure plane applies at a ratio of 85 feet vertical to 1 foot horizontal.",
        "source": "ZR_Article_II",
        "section": "23-631",
        "title": "Sky Exposure",
    },
    {
        "text": "City of Yes for Housing (2024): parking mandates eliminated citywide for residential development within half-mile of transit.",
        "source": "City_of_Yes",
        "section": "Parking",
        "title": "Parking Elimination",
    },
]


def get_collection():
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    ef = embedding_functions.DefaultEmbeddingFunction()
    collection = client.get_or_create_collection(
        name="nyc_zoning_resolution", embedding_function=ef
    )
    if collection.count() == 0:
        collection.add(
            documents=[c["text"] for c in SAMPLE_CHUNKS],
            metadatas=[{"source": c["source"], "section": c["section"], "title": c["title"]} for c in SAMPLE_CHUNKS],
            ids=[f"chunk_{i}" for i in range(len(SAMPLE_CHUNKS))],
        )
    return collection


def query_zoning_rules(query: str, n_results: int = 5) -> list[dict]:
    collection = get_collection()
    results = collection.query(
        query_texts=[query],
        n_results=min(n_results, max(collection.count(), 1)),
        include=["documents", "metadatas", "distances"],
    )
    docs = results["documents"][0] if results["documents"] else []
    metas = results["metadatas"][0] if results["metadatas"] else []
    return [
        {"text": doc, "source": meta.get("source", ""), "section": meta.get("section", "")}
        for doc, meta in zip(docs, metas)
    ]
