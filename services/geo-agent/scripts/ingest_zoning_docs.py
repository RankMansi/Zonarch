"""One-time ChromaDB population script."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.chromadb_rag import get_collection, SAMPLE_CHUNKS


def main():
    collection = get_collection()
    print(f"ChromaDB collection 'nyc_zoning_resolution' ready with {collection.count()} chunks.")
    for chunk in SAMPLE_CHUNKS:
        print(f"  - {chunk['section']}: {chunk['title']}")


if __name__ == "__main__":
    main()
