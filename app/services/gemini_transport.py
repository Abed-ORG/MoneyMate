from __future__ import annotations

import os


DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def configure_gemini_tls() -> None:
    """Use the OS trust store when available for local Windows dev."""
    try:
        import truststore
    except ImportError:
        return
    try:
        truststore.inject_into_ssl()
    except Exception:
        return


def gemini_model_name(default: str = DEFAULT_GEMINI_MODEL) -> str:
    model = os.getenv("GEMINI_MODEL", default).strip() or default
    return model.removeprefix("models/")


def gemini_generate_endpoint(model: str | None = None) -> str:
    selected_model = (model or gemini_model_name()).removeprefix("models/")
    return (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{selected_model}:generateContent"
    )
