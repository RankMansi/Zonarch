"""FastAPI geo-agent service for zoning + spatial agents."""

import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from agents.zoning_compliance import run_zoning_compliance
from agents.spatial_calculator import run_spatial_calculator

app = FastAPI(title="Zone-Draft Geo Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory room store synced via HTTP from orchestrator
room_store: dict = {}


class RoomRequest(BaseModel):
    room_id: str


class RoomUpdate(BaseModel):
    key: str
    value: dict


@app.get("/health")
def health():
    return {"status": "ok", "service": "geo-agent"}


@app.post("/sync-room")
def sync_room(data: dict):
    room_id = data.get("room_id")
    schema = data.get("schema", {})
    if room_id:
        room_store[room_id] = schema
    return {"success": True}


@app.post("/run-zoning-agent")
def run_zoning_agent(req: RoomRequest):
    schema = room_store.get(req.room_id, {})
    lot_data = schema.get("lot_data")
    if not lot_data:
        return {"error": "No lot_data in room", "log": "Zoning agent failed: missing lot_data"}

    analysis, log = run_zoning_compliance(lot_data)
    schema["zoning_analysis"] = analysis
    room_store[req.room_id] = schema
    return {"log": log, "zoning_analysis": analysis}


@app.post("/run-spatial-agent")
def run_spatial_agent(req: RoomRequest):
    schema = room_store.get(req.room_id, {})
    lot_data = schema.get("lot_data")
    zoning = schema.get("zoning_analysis")
    if not lot_data or not zoning:
        return {"error": "Missing context", "log": "Spatial agent failed: missing lot_data or zoning_analysis"}

    envelope, log = run_spatial_calculator(lot_data, zoning)
    schema["building_envelope"] = envelope
    room_store[req.room_id] = schema
    return {"log": log, "building_envelope": envelope}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("GEO_AGENT_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
