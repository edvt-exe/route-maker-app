from fastapi import APIRouter
from app.api.endpoints import health, users, routes

api_router = APIRouter()
api_router.include_router(health.router, prefix="/system", tags=["System"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(routes.router, prefix="/routes", tags=["Routes"])