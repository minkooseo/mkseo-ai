"""Run this package's validation and distribution checks."""

import subprocess
from pathlib import Path


def main():
    """Validate dependencies, Python source, tests, and package artifacts."""
    commands = (
        ("uv", "lock", "--check"),
        ("uv", "run", "--locked", "ruff", "format", "--check", "."),
        ("uv", "run", "--locked", "ruff", "check", "."),
        ("uv", "run", "--locked", "pyright"),
        ("uv", "run", "--locked", "pytest"),
        ("uv", "build", "--no-sources"),
    )
    for command in commands:
        subprocess.run(command, cwd=Path(__file__).parent, check=True)


if __name__ == "__main__":
    main()
