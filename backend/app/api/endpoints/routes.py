from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# Importă funcțiile tale de auth și DB (adaptează importurile la structura ta)
# from app.db.database import get_db
# from app.api.dependencies.auth import get_current_user

from app.schemas.route import RouteCreate, RouteData
from app.services.itinerary import generate_itinerary

router = APIRouter()

# Mock dependencies pentru context - folosește-le pe ale tale reale!
def get_db():
    yield None

def get_current_user():
    return {"user_id": 1}

@router.post("/", response_model=RouteData, status_code=status.HTTP_200_OK)
async def create_route(
    request: RouteCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Generates a highly personalized, optimized multi-day travel route based on 
    complex user preferences by delegating POI retrieval to the AI Agent.
    """
    try:
        # Validate critical fields
        if not request.city:
            raise ValueError("A primary city must be provided.")
            
        # Await the async itinerary generator
        route_data = await generate_itinerary(db, request) 
        
        if not route_data.waypoints:
            raise ValueError("Could not generate waypoints for the given criteria.")
            
        return route_data
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while generating the route: {str(e)}"
        )