"""Ensure all Python files end with a single trailing newline."""
import os

files = [
    "app/services/goal_ai_service.py",
    "app/services/insights_ai_service.py",
    "app/services/category_service.py",
    "app/services/gemini_service.py",
]

for path in files:
    with open(path, "r") as f:
        content = f.read()
    # Strip trailing whitespace/newlines, then add exactly one
    content = content.rstrip("\n\r") + "\n"
    with open(path, "w") as f:
        f.write(content)
    print(f"Fixed: {path}")