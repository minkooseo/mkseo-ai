"""Evaluation suite ownership tree and per-attempt run records."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Annotated, Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    FiniteFloat,
    model_validator,
)

type NonBlankText = Annotated[str, Field(pattern=r"\S")]


class EvaluationModel(BaseModel):
    """Immutable evaluation model with explicit fields and strict values."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")


class Latency(EvaluationModel):
    """Elapsed wall-clock time for one complete evaluation attempt."""

    seconds: Annotated[FiniteFloat, Field(ge=0)]
    """Finite non-negative duration, for example 2.5 seconds."""


class EvaluationRun[Output](EvaluationModel):
    """Immutable root record owned by exactly one evaluation case."""

    id: NonBlankText
    """Unique attempt identifier, for example a UUID."""

    case_id: NonBlankText
    """Owning evaluation case, for example `reply-grounding-01`."""

    variant_id: NonBlankText | None
    """Input variant, for example `calm-counselor`, or null when unused."""

    status: Literal["succeeded", "failed"]
    """Whether valid output was obtained, independently of its quality."""

    latency: Latency
    """Duration of this attempt, including failed generation."""

    output: Output | None
    """Application evidence, including partial work after a failure."""

    error: NonBlankText | None
    """Failure detail, or null when the attempt succeeded."""

    @model_validator(mode="after")
    def _outcome_is_consistent(self) -> Self:
        if self.status == "succeeded":
            if self.output is None or self.error is not None:
                raise ValueError("succeeded run requires output and no error")
        elif self.error is None:
            raise ValueError("failed run requires an error")
        return self


type EvaluationTarget[Input, Output] = Callable[
    [Input], Awaitable[EvaluationRun[Output]]
]
"""Executes one complete attempt for a bound case and returns its record."""


class Case[Output](EvaluationModel):
    """One criterion-specific case and its recorded attempts."""

    id: NonBlankText
    """Evaluation case ID, for example `reply-contribution-01`."""

    example_id: NonBlankText
    """Corpus input reference, for example `reply-fixed-01`."""

    evaluation_runs: tuple[EvaluationRun[Output], ...]
    """Completed attempts in recording order; initially an empty tuple."""


class Measurement[Output](EvaluationModel):
    """One criterion and the cases that measure it."""

    id: NonBlankText
    """Criterion ID, for example `contribution`."""

    cases: Annotated[tuple[Case[Output], ...], Field(min_length=1)]
    """Cases owned exclusively by this measurement."""


class Axis[Output](EvaluationModel):
    """A group of related measurements."""

    id: NonBlankText
    """Concern ID, for example `reply`."""

    measurements: Annotated[
        tuple[Measurement[Output], ...], Field(min_length=1)
    ]
    """Criteria in this axis, for example Contribution and Grounding."""


class EvaluationSuite[Output](EvaluationModel):
    """Coverage and run histories with unique case and run ownership."""

    id: NonBlankText
    """Suite identifier, for example `chat`."""

    axes: Annotated[tuple[Axis[Output], ...], Field(min_length=1)]
    """Suite concerns, for example reply and personality."""

    @model_validator(mode="after")
    def _ownership_is_unique(self) -> Self:
        axis_ids: set[str] = set()
        case_ids: set[str] = set()
        run_ids: set[str] = set()
        for axis in self.axes:
            if axis.id in axis_ids:
                raise ValueError("axis IDs must be unique within a suite")
            axis_ids.add(axis.id)
            measurement_ids: set[str] = set()
            for measurement in axis.measurements:
                if measurement.id in measurement_ids:
                    raise ValueError("measurement IDs must be unique per axis")
                measurement_ids.add(measurement.id)
                for case in measurement.cases:
                    if case.id in case_ids:
                        raise ValueError("a case must have exactly one owner")
                    case_ids.add(case.id)
                    for run in case.evaluation_runs:
                        if run.case_id != case.id:
                            raise ValueError("run belongs to a different case")
                        if run.id in run_ids:
                            raise ValueError(
                                "a run must have exactly one owner"
                            )
                        run_ids.add(run.id)
        return self

    def append_run(self, run: EvaluationRun[Output]) -> Self:
        """Return a validated snapshot with one attempt added to its case."""
        data = self.model_dump(mode="python", round_trip=True)
        for axis in data["axes"]:
            for measurement in axis["measurements"]:
                for case in measurement["cases"]:
                    if case["id"] == run.case_id:
                        case["evaluation_runs"] = (
                            *case["evaluation_runs"],
                            run.model_dump(mode="python", round_trip=True),
                        )
                        return type(self).model_validate(data)
        raise ValueError(f"unknown case: {run.case_id}")
