"""Shapely-based 3D envelope calculations."""

import math
from tools.zoning_tables import lookup_far


def compute_building_envelope(
    lot_area_sqft: float,
    lot_depth_ft: float,
    lot_frontage_ft: float,
    zonedist: str,
    use_uap: bool = True,
) -> dict:
    zoning = lookup_far(zonedist)
    far = zoning["uap"] if (use_uap and zoning.get("uap")) else zoning["res"]
    gross_fa = lot_area_sqft * far
    rear_yard = 30.0
    buildable_depth = lot_depth_ft - rear_yard
    sky_exp_base = zoning.get("sky_exp_base", 85)
    floor_plate = lot_frontage_ft * buildable_depth

    if floor_plate <= 0:
        raise ValueError(f"Invalid lot geometry: frontage={lot_frontage_ft}, depth={buildable_depth}")

    floors = math.ceil(gross_fa / floor_plate)
    floor_height_ft = 10.5
    total_height_ft = floors * floor_height_ft
    required_setback = (total_height_ft - sky_exp_base) * (1 / 85) if total_height_ft > sky_exp_base else 0

    sf_to_m = 0.3048
    w = lot_frontage_ft * sf_to_m
    d = buildable_depth * sf_to_m
    h = total_height_ft * sf_to_m
    setback_m = required_setback * sf_to_m
    sky_base_m = sky_exp_base * sf_to_m

    vertices = [
        {"x": 0, "y": 0, "z": 0},
        {"x": w, "y": 0, "z": 0},
        {"x": w, "y": 0, "z": d},
        {"x": 0, "y": 0, "z": d},
    ]

    if required_setback > 0:
        vertices.extend([
            {"x": 0, "y": sky_base_m, "z": 0},
            {"x": w, "y": sky_base_m, "z": 0},
            {"x": w, "y": sky_base_m, "z": d},
            {"x": 0, "y": sky_base_m, "z": d},
            {"x": setback_m, "y": h, "z": setback_m},
            {"x": w - setback_m, "y": h, "z": setback_m},
            {"x": w - setback_m, "y": h, "z": d - setback_m},
            {"x": setback_m, "y": h, "z": d - setback_m},
        ])
    else:
        vertices.extend([
            {"x": 0, "y": h, "z": 0},
            {"x": w, "y": h, "z": 0},
            {"x": w, "y": h, "z": d},
            {"x": 0, "y": h, "z": d},
        ])

    setback_planes = [
        {"elevation_ft": sky_exp_base, "setback_depth_ft": required_setback, "face": face}
        for face in ["north", "south", "east", "west"]
    ] if required_setback > 0 else []

    return {
        "max_residential_sqft": gross_fa,
        "max_commercial_sqft": lot_area_sqft * zoning.get("comm", 0),
        "gross_floor_area": gross_fa,
        "floors_standard": math.ceil((lot_area_sqft * zoning["res"]) / floor_plate),
        "floors_with_uap": floors,
        "total_height_ft": total_height_ft,
        "envelope_vertices": vertices,
        "setback_planes": setback_planes,
        "violation_log": [],
        "iteration_count": 0,
    }
