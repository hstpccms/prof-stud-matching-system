"""
FastAPI Application Entry Point
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
import models
from routers import auth, data, matching, download


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables and required directories on startup
    os.makedirs("data/uploads", exist_ok=True)
    os.makedirs("data/results", exist_ok=True)
    models.Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Prof-Student Matching System API",
    description="Admin dashboard API for the professor-student matching system",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(data.router)
app.include_router(matching.router)
app.include_router(download.router)


@app.get("/")
def root():
    return {"message": "Prof-Student Matching System API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
