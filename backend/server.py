import os
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from database import engine, Base
from routers import auth_routes, projects, documents, admin, kpi, storage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="NumDocMan API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# Serve uploaded files
app.mount("/api/files", StaticFiles(directory=str(UPLOADS_DIR)), name="files")

# Include all routers
app.include_router(auth_routes.router, prefix="/api/auth", tags=["auth"])
app.include_router(projects.router, prefix="/api", tags=["projects"])
app.include_router(documents.router, prefix="/api", tags=["documents"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(kpi.router, prefix="/api/kpi", tags=["kpi"])
app.include_router(storage.router, prefix="/api", tags=["storage"])


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("NumDocMan API started - DB tables created/verified")


@app.on_event("shutdown")
async def shutdown():
    await engine.dispose()
    logger.info("NumDocMan API shutdown")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "NumDocMan"}
