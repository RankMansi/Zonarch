"""Shapely-based 3D envelope + georeferenced Site Viewer geometry."""

from __future__ import annotations

import math
from typing import Any

from pyproj import Transformer
from shapely.geometry import Polygon, mapping
from shapely.ops import transform

from tools.zoning_tables import lookup_far

WGS84 = "EPSG:4326"
NY_STATE_PLANE_FT = "EPSG:2263"
FT_TO_M = 0.3048
FLOOR_HEIGHT_FT = 10.5


def _ring_from_latlng(coords: list[tuple[float, float]]) -> Polygon:
    """coords: [(lat, lng), ...] → Shapely polygon in WGS84 (x=lng, y=lat)."""
    if len(coords) < 3:
        raise ValueError("Lot polygon needs at least 3 points")
    ring = [(lng, lat) for lat, lng in coords]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    poly = Polygon(ring)
    if not poly.is_valid:
        poly = poly.buffer(0)
    return poly


def _to_state_plane(poly_wgs84: Polygon) -> Polygon:
    transformer = Transformer.from_crs(WGS84, NY_STATE_PLANE_FT, always_xy=True)
    return transform(transformer.transform, poly_wgs84)


def _to_wgs84(poly_sp: Polygon) -> Polygon:
    transformer = Transformer.from_crs(NY_STATE_PLANE_FT, WGS84, always_xy=True)
    return transform(transformer.transform, poly_sp)


def _rect_lot_polygon(
    lat: float, lng: float, frontage_ft: float, depth_ft: float
) -> Polygon:
    m_per_deg_lat = 111_320.0
    m_per_deg_lng = 111_320.0 * math.cos(math.radians(lat))
    half_d = (depth_ft * FT_TO_M) / 2
    half_f = (frontage_ft * FT_TO_M) / 2
    d_lat = half_d / m_per_deg_lat
    d_lng = half_f / m_per_deg_lng
    ring = [
        (lng - d_lng, lat - d_lat),
        (lng + d_lng, lat - d_lat),
        (lng + d_lng, lat + d_lat),
        (lng - d_lng, lat + d_lat),
        (lng - d_lng, lat - d_lat),
    ]
    return Polygon(ring)


def _feature(layer: str, poly: Polygon, **props: Any) -> dict:
    geom = mapping(poly)
    if geom["type"] == "Polygon" and not geom.get("coordinates"):
        raise ValueError("Empty polygon")
    return {
        "type": "Feature",
        "properties": {"layer": layer, **props},
        "geometry": geom,
    }


def _envelope_metrics(
    lot_area_sqft: float,
    buildable_area_sqft: float,
    far: float,
    sky_exp_base: float,
) -> dict:
    gross_fa = lot_area_sqft * far
    if buildable_area_sqft <= 0:
        raise ValueError("Buildable footprint area is zero")
    floors = math.ceil(gross_fa / buildable_area_sqft)
    total_height_ft = floors * FLOOR_HEIGHT_FT
    required_setback = (
        (total_height_ft - sky_exp_base) * (1 / 85) if total_height_ft > sky_exp_base else 0
    )
    return {
        "gross_floor_area": gross_fa,
        "floors": floors,
        "total_height_ft": total_height_ft,
        "required_setback_ft": required_setback,
    }


def compute_building_envelope(
    lot_area_sqft: float,
    lot_depth_ft: float,
    lot_frontage_ft: float,
    zonedist: str,
    use_uap: bool = True,
) -> dict:
    """Legacy rectangular envelope for spatial agent (local XYZ meters)."""
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
    total_height_ft = floors * FLOOR_HEIGHT_FT
    required_setback = (total_height_ft - sky_exp_base) * (1 / 85) if total_height_ft > sky_exp_base else 0

    w = lot_frontage_ft * FT_TO_M
    d = buildable_depth * FT_TO_M
    h = total_height_ft * FT_TO_M
    setback_m = required_setback * FT_TO_M
    sky_base_m = sky_exp_base * FT_TO_M

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


def compute_site_geometry(
    lot_data: dict,
    zoning_analysis: dict | None = None,
    scenario: str = "both",
) -> dict:
    """
    Georeferenced Site Viewer geometry in WGS84 GeoJSON.
    scenario: 'uap' | 'base' | 'both'
    """
    warnings: list[str] = []
    envelope_method = "polygon"

    lat = float(lot_data.get("latitude", 0))
    lng = float(lot_data.get("longitude", 0))
    lot_area = float(lot_data.get("lot_area_sqft", 0))
    frontage = float(lot_data.get("lot_frontage", 0))
    depth = float(lot_data.get("lot_depth", 0))
    zonedist = lot_data.get("zonedist1", "R7X")
    coords = lot_data.get("lot_polygon_coords")

    zoning = zoning_analysis or {}
    rear_yard = float(zoning.get("rear_yard_ft", 30))
    sky_exp_base = float(zoning.get("sky_exposure_base_ft", lookup_far(zonedist).get("sky_exp_base", 85)))
    base_far = float(zoning.get("base_far", lookup_far(zonedist)["res"]))
    uap_far = float(zoning.get("uap_far", lookup_far(zonedist).get("uap") or base_far))

    if coords and len(coords) >= 3:
        lot_wgs = _ring_from_latlng([(float(c[0]), float(c[1])) for c in coords])
    else:
        envelope_method = "rectangle_fallback"
        warnings.append("Lot polygon approximated from frontage × depth (no PLUTO the_geom)")
        lot_wgs = _rect_lot_polygon(lat, lng, frontage or 50, depth or 100)

    lot_sp = _to_state_plane(lot_wgs)
    buildable_sp = lot_sp.buffer(-rear_yard)
    if buildable_sp.is_empty or buildable_sp.area < 50:
        warnings.append(f"Uniform {rear_yard}ft inset produced sliver footprint; using 50% area shrink")
        buildable_sp = lot_sp.buffer(-math.sqrt(lot_sp.area) * 0.15)
    if buildable_sp.is_empty:
        buildable_sp = lot_sp

    buildable_wgs = _to_wgs84(buildable_sp)
    buildable_area_sqft = buildable_sp.area

    features: list[dict] = []
    features.append(_feature("lot_boundary", lot_wgs, height_ft=2, bbl=lot_data.get("bbl")))
    features.append(
        _feature(
            "buildable_footprint",
            buildable_wgs,
            height_ft=1,
            bbl=lot_data.get("bbl"),
        )
    )

    metrics_out: dict[str, Any] = {}

    def add_envelope(layer: str, far: float) -> dict:
        m = _envelope_metrics(lot_area, buildable_area_sqft, far, sky_exp_base)
        setback = m["required_setback_ft"]
        height = m["total_height_ft"]

        if setback > 0 and height > sky_exp_base:
            top_sp = buildable_sp.buffer(-setback)
            if not top_sp.is_empty and top_sp.area > 10:
                top_wgs = _to_wgs84(top_sp)
                features.append(
                    _feature(
                        layer,
                        buildable_wgs,
                        height_ft=sky_exp_base,
                        extrusion_base_ft=0,
                        floors=m["floors"],
                        gfa_sqft=m["gross_floor_area"],
                    )
                )
                features.append(
                    _feature(
                        layer,
                        top_wgs,
                        height_ft=height,
                        extrusion_base_ft=sky_exp_base,
                        floors=m["floors"],
                        gfa_sqft=m["gross_floor_area"],
                    )
                )
            else:
                features.append(
                    _feature(
                        layer,
                        buildable_wgs,
                        height_ft=height,
                        extrusion_base_ft=0,
                        floors=m["floors"],
                        gfa_sqft=m["gross_floor_area"],
                    )
                )
        else:
            features.append(
                _feature(
                    layer,
                    buildable_wgs,
                    height_ft=height,
                    extrusion_base_ft=0,
                    floors=m["floors"],
                    gfa_sqft=m["gross_floor_area"],
                )
            )
        return m

    if scenario in ("uap", "both"):
        uap_m = add_envelope("envelope_uap", uap_far)
        metrics_out["uap"] = uap_m

    if scenario in ("base", "both"):
        base_m = add_envelope("envelope_base", base_far)
        metrics_out["base"] = base_m

    primary = metrics_out.get("uap") or metrics_out.get("base") or {}

    features.append(
        _feature(
            "sky_exposure_plane",
            lot_wgs,
            height_ft=sky_exp_base + 0.5,
            extrusion_base_ft=max(0, sky_exp_base - 0.5),
            label="Sky exposure reference",
        )
    )

    if zoning.get("zoning_approximated"):
        warnings.append("Zoning district approximated in lookup table")

    return {
        "layers": {"type": "FeatureCollection", "features": features},
        "metrics": {
            "height_ft": primary.get("total_height_ft", 0),
            "floors": primary.get("floors", 0),
            "gfa_sqft": primary.get("gross_floor_area", 0),
            "base_far": base_far,
            "uap_far": uap_far,
            "sky_exposure_base_ft": sky_exp_base,
        },
        "meta": {
            "envelope_method": envelope_method,
            "data_warnings": warnings,
        },
    }
