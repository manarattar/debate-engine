import json
import time

import httpx
import jwt
from app.config import get_settings
from fastapi import Header, HTTPException
from jwt.algorithms import RSAAlgorithm

# In-process JWKS cache (refresh every hour)
_cache: dict = {"keys": None, "fetched_at": 0.0}
_TTL = 3600


async def _get_jwks() -> list:
    now = time.time()
    if _cache["keys"] and now - _cache["fetched_at"] < _TTL:
        return _cache["keys"]
    jwks_url = get_settings().clerk_jwks_url
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url, timeout=5)
        resp.raise_for_status()
    _cache["keys"] = resp.json()["keys"]
    _cache["fetched_at"] = now
    return _cache["keys"]


async def get_current_user(authorization: str = Header(None)) -> str:
    """Require a valid Clerk JWT. Returns the Clerk user ID (sub)."""
    if not get_settings().clerk_jwks_url:
        raise HTTPException(status_code=503, detail="Auth not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    try:
        header = jwt.get_unverified_header(token)
        keys = await _get_jwks()
        key_data = next((k for k in keys if k["kid"] == header["kid"]), None)
        if not key_data:
            raise ValueError("No matching key")
        public_key = RSAAlgorithm.from_jwk(json.dumps(key_data))
        payload = jwt.decode(token, public_key, algorithms=["RS256"])
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
