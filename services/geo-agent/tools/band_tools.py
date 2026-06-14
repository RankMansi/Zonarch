"""Band room read/write via HTTP bridge to Next.js orchestrator."""

import os
import httpx

WEB_URL = os.getenv("WEB_ORCHESTRATOR_URL", "http://localhost:3000")


async def read_band_context(room_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{WEB_URL}/api/band/{room_id}")
        if res.status_code == 200:
            return res.json()
    return {}


async def deposit_to_band(room_id: str, key: str, value: dict) -> dict:
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{WEB_URL}/api/band/{room_id}",
            json={"key": key, "value": value},
        )
        return res.json() if res.status_code == 200 else {"success": False}


def flag_violation(room_id: str, violation_type: str, description: str) -> dict:
    return {"room_id": room_id, "type": violation_type, "description": description}
