

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints.routes import router as routes_router

app = FastAPI(
    title="Route Maker API",
    description="Main backend: receives trip filters from the frontend and delegates POI retrieval to WayFinder-Agent.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_router, prefix="/api/v1/routes", tags=["routes"])


@app.get("/health")
async def health() -> dict:
    """Basic liveness probe."""
    return {"status": "ok"}