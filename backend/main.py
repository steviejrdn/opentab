from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.data import router as data_router
from api.tables import router as tables_router
from api.compute import router as compute_router

app = FastAPI(title="opentab_ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data_router, prefix="/api/data")
app.include_router(tables_router, prefix="/api/tables")
app.include_router(compute_router, prefix="/api/compute")
