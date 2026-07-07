"""App package for FastAPI scaffold."""

from dotenv import load_dotenv

# Load the root .env before any submodules read os.getenv() at import time.
load_dotenv()

__all__ = ["main"]
