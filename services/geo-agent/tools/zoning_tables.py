"""NYC Zoning FAR + setback lookup tables (2024, post-City of Yes)."""

BASE_FAR = {
    "R1-1": {"res": 0.5, "uap": None, "max_height": 35, "sky_exp_base": 25},
    "R3-2": {"res": 0.5, "uap": None, "max_height": 35, "sky_exp_base": 25},
    "R6": {"res": 2.43, "uap": 3.0, "max_height": None, "sky_exp_base": 60},
    "R7A": {"res": 3.45, "uap": 4.6, "max_height": 80, "sky_exp_base": 60},
    "R7X": {"res": 3.75, "uap": 4.6, "max_height": None, "sky_exp_base": 85},
    "R8": {"res": 6.02, "uap": 7.2, "max_height": None, "sky_exp_base": 85},
    "R8A": {"res": 6.02, "uap": 7.2, "max_height": 120, "sky_exp_base": 60},
    "R9A": {"res": 7.52, "uap": 9.0, "max_height": 145, "sky_exp_base": 60},
    "R10": {"res": 10.0, "uap": 12.0, "max_height": None, "sky_exp_base": 85},
    "C6-1": {"res": 6.0, "uap": 7.2, "comm": 6.0, "sky_exp_base": 85},
    "C6-2A": {"res": 6.0, "uap": 7.2, "comm": 6.0, "sky_exp_base": 60},
    "C6-4": {"res": 10.0, "uap": 12.0, "comm": 10.0, "sky_exp_base": 85},
    "M1-5/R7X": {"res": 3.75, "uap": 4.6, "comm": 2.0, "mfg": 2.0, "sky_exp_base": 85},
    "M1-5/R8A": {"res": 6.02, "uap": 7.2, "comm": 2.0, "mfg": 2.0, "sky_exp_base": 85},
    "M1-6/R10": {"res": 10.0, "uap": 12.0, "comm": 2.0, "mfg": 2.0, "sky_exp_base": 85},
}

SKY_EXP_ANGLES = {
    "narrow_street": {"initial_setback": 0, "angle": "75:1"},
    "wide_street_85": {"initial_setback": 85, "angle": "85:1"},
    "wide_street_60": {"initial_setback": 60, "angle": "60:1"},
}

REAR_YARD = {
    "R1-R5": 30,
    "R6-R10": 30,
    "C1-C4": 20,
    "C5-C8": 0,
    "M1-M3": 0,
}

UAP_BONUS = {
    "affordable_pct_required": 20,
    "ami_max": 60,
    "far_multiplier": 1.2,
    "parking_waived": True,
}

HARD_COSTS_PSF = {
    "residential_rental": 375,
    "residential_condo": 425,
    "commercial_office": 475,
    "mixed_use": 400,
}

SOFT_COST_PCT = 0.22
FINANCING_COST_PCT = 0.06
DEVELOPER_PROFIT_PCT = 0.18

def lookup_far(zonedist: str) -> dict:
    if zonedist in BASE_FAR:
        return BASE_FAR[zonedist]
    for key in BASE_FAR:
        if zonedist.startswith(key.split("/")[0]):
            return BASE_FAR[key]
    return BASE_FAR["R7X"]
