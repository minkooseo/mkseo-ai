"""Rubrics that judges grade application output against."""

from itertools import pairwise
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from mkseo_ai.evaluation.types.text import NonBlankText


class RubricLevel(BaseModel):
    """One grade a judge may assign and what output at that grade shows."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    score: Annotated[int, Field(ge=0)]
    """Ordinal grade, for example 2."""

    description: NonBlankText
    """Observable qualities at this grade, for example `Every claim is
    supported by the conversation`."""


class Rubric(BaseModel):
    """The criterion a judge assesses and the grades it may assign."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    id: NonBlankText
    """Rubric identifier, for example `grounding`."""

    criterion: NonBlankText
    """What the judge assesses, for example `Is every claim grounded?`."""

    levels: Annotated[tuple[RubricLevel, ...], Field(min_length=2)]
    """Grades in strictly ascending score order."""

    passing_score: int
    """Lowest passing grade; must be a level's score, for example 2."""

    @model_validator(mode="after")
    def _levels_are_ordered(self) -> Self:
        scores = [level.score for level in self.levels]
        if any(low >= high for low, high in pairwise(scores)):
            raise ValueError("level scores must be strictly ascending")
        if self.passing_score not in scores:
            raise ValueError("passing score must be a level score")
        return self
