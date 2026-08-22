from fastapi import APIRouter
router = APIRouter()

@router.get("/health")
def health_check():
    """
    Checks the server status.
    Returns 200 OK if everything is working correctly.
    """
    return {"status": "ok", "message": "The Route Maker API is working perfectly!"}