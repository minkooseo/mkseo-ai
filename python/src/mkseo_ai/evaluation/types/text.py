"""Validated text shared by evaluation records."""

from typing import Annotated

from pydantic import Field

type NonBlankText = Annotated[str, Field(pattern=r"\S")]
"""Text with at least one non-whitespace character."""
