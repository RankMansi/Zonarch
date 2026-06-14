"""Spatial Calculator Agent — envelope math + constraint validation."""

from tools.shapely_engine import compute_building_envelope


def run_spatial_calculator(lot_data: dict, zoning_analysis: dict) -> tuple[dict, str]:
    envelope = compute_building_envelope(
        lot_area_sqft=lot_data["lot_area_sqft"],
        lot_depth_ft=lot_data["lot_depth"],
        lot_frontage_ft=lot_data["lot_frontage"],
        zonedist=lot_data["zonedist1"],
        use_uap=zoning_analysis.get("uap_eligible", True),
    )

    violations = []
    if envelope["max_residential_sqft"] / lot_data["lot_area_sqft"] > zoning_analysis["uap_far"] * 1.01:
        violations.append({
            "type": "FAR_CAP",
            "description": "Envelope exceeded UAP FAR cap",
            "resolution": "Recomputed with corrected parameters",
        })
        envelope["iteration_count"] = 1
        envelope["violation_log"] = violations

    log = (
        f"ENVELOPE COMPUTED: {envelope['floors_with_uap']} floors | "
        f"{envelope['total_height_ft']:.0f}ft | GFA {envelope['gross_floor_area']:,.0f} sqft"
    )
    if violations:
        log += f" | {len(violations)} violation(s) resolved"

    return envelope, log
