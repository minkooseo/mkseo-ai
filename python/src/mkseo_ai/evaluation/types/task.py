"""Application inputs that evaluation cases run against."""

from pydantic import BaseModel, ConfigDict

from mkseo_ai.evaluation.types.text import NonBlankText


class Task[Input](BaseModel):
    """One application input, shared by every case that assesses it."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    id: NonBlankText
    """Task identifier, for example `reply-fixed-01`."""

    input: Input
    """Application-defined input passed to the evaluation target."""
