from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes_whatsapp import router as whatsapp_router

app = FastAPI(
    title="ConstruData Local WhatsApp Bridge",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(whatsapp_router)


@app.get("/health")
def health():
    return {"ok": True, "service": "local_whatsapp_bridge"}
