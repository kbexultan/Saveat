"""
Runs the API against the local test database for manual QA.

    uv run python -m tests.serve            # http://127.0.0.1:8011

Goes through the same guard as pytest, so it cannot start against the
database configured in backend/.env. Port 8011 keeps it apart from the
regular dev server on 8001.
"""

import sys

from tests.safety import configure_test_environment


def main() -> None:
    configure_test_environment()

    import uvicorn

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8011

    uvicorn.run("app.main:app", host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
