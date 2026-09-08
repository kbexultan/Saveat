from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import test_database_connection

from app.routers.businesses import router as businesses_router
from app.routers.branches import router as branches_router
from app.routers.products import router as products_router
from app.routers.offers import router as offers_router
from app.routers.orders import router as orders_router
from app.routers.users import router as users_router
from app.routers.auth import router as auth_router

app = FastAPI(
    title="SAVEAT API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(businesses_router)
app.include_router(branches_router)
app.include_router(products_router)
app.include_router(offers_router)
app.include_router(users_router)
app.include_router(orders_router)
app.include_router(auth_router)


@app.get("/")
def root():
    return {
        "name": "SAVEAT API",
        "status": "running",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
    }


@app.get("/health/database")
def database_health():
    result = test_database_connection()

    return {
        "database": "connected",
        "result": result,
    }