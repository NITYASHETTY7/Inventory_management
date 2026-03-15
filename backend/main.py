"""
main.py
-------
FastAPI application entry point.

Run with:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import time
from build_store_profiles import build_profiles

from api_routes import router


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Sangeetha Analytics API",
    description=(
        "Statistical demand-forecasting API for phone retail branches. "
        "Uses median baseline + day-of-week multipliers + festival scaling."
    ),
    version="1.0.0",
)

# Allow the React dev server (port 5173) and any other origin during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routes under the /api prefix
app.include_router(router, prefix="/api")


from closing_stock_loader import load_all_closing_stock_sheets

DATA = {}

@app.on_event("startup")
def startup_event():
    global DATA
    # Load closing stock
    closing_stock_path = os.path.join(os.path.dirname(__file__), 'data', 'CLOSING STOCK FINAL.xlsx')
    if not os.path.exists(closing_stock_path):
        closing_stock_path = os.path.join(os.path.dirname(__file__), 'CLOSING STOCK FINAL.xlsx')
        
    try:
        DATA["closing_stock_sheets"] = load_all_closing_stock_sheets(closing_stock_path)
    except Exception as e:
        print(f"Failed to load closing stock sheets: {e}")
        DATA["closing_stock_sheets"] = {}

    profiles_path = os.path.join(os.path.dirname(__file__), 'store_profiles.json')
    needs_build = False
    if not os.path.exists(profiles_path):
        needs_build = True
    else:
        # Check if older than 24 hours
        mtime = os.path.getmtime(profiles_path)
        if time.time() - mtime > 24 * 3600:
            needs_build = True
            
    if needs_build:
        print("store_profiles.json is missing or older than 24 hours. Building...")
        try:
            build_profiles()
        except Exception as e:
            print(f"Failed to build store profiles on startup: {e}")

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["ops"])
def health() -> dict:
    return {"status": "ok"}
