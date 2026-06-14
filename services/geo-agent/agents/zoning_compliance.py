"""Zoning Compliance Agent — RAG + lookup tables."""

from tools.chromadb_rag import query_zoning_rules
from tools.zoning_tables import lookup_far, UAP_BONUS


def run_zoning_compliance(lot_data: dict) -> tuple[dict, str]:
    zonedist = lot_data["zonedist1"]
    zoning = lookup_far(zonedist)

    rag_queries = [
        f"UAP Universal Affordability Preference density bonus {zonedist}",
        f"sky exposure plane setback requirements {zonedist}",
        "rear yard requirements residence district",
        "City of Yes parking mandate elimination 2024",
    ]
    rag_results = []
    for q in rag_queries:
        rag_results.extend(query_zoning_rules(q, n_results=2))

    rag_sources = list({r.get("source", "") + " " + r.get("section", "") for r in rag_results})

    analysis = {
        "base_far": zoning["res"],
        "uap_far": zoning.get("uap") or zoning["res"],
        "max_height_ft": zoning.get("max_height"),
        "sky_exposure_base_ft": zoning.get("sky_exp_base", 85),
        "sky_exposure_angle": 85,
        "rear_yard_ft": 30,
        "min_front_setback_ft": 0,
        "max_lot_coverage_pct": 70,
        "parking_required": False,
        "uap_eligible": bool(zoning.get("uap")),
        "uap_affordable_pct": UAP_BONUS["affordable_pct_required"],
        "applicable_zr_sections": ["ZR 23-154", "ZR 23-47", "ZR 23-631", "ZR 33-26"],
        "city_of_yes_notes": "City of Yes (2024): Parking mandates eliminated. UAP: +20% FAR at 20% affordable ≤60% AMI.",
        "rag_sources": rag_sources,
    }

    log = f"ZONING LOCKED: {zonedist} | Base FAR {analysis['base_far']} | UAP FAR {analysis['uap_far']} | RAG sources: {len(rag_sources)}"
    return analysis, log
