"""Evaluation results: the suite ownership tree and per-attempt runs."""

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

from mkseo_ai.evaluation.types.text import NonBlankText


class Latency(BaseModel):
    """Elapsed wall-clock time for one complete evaluation attempt."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    seconds: Annotated[FiniteFloat, Field(ge=0)]
    """Finite non-negative duration, for example 2.5 seconds."""


class RunSucceeded(BaseModel):
    """Valid output was obtained, independently of its quality."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    status: Literal["succeeded"]
    """Outcome discriminator, always `succeeded`."""


class RunFailed(BaseModel):
    """No valid output was obtained."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    status: Literal["failed"]
    """Outcome discriminator, always `failed`."""

    error: NonBlankText
    """Failure detail, for example `provider timed out`."""


type RunOutcome = Annotated[
    RunSucceeded | RunFailed, Field(discriminator="status")
]
"""Whether one attempt obtained valid output, keyed by `status`."""


class CaseRun[Output](BaseModel):
    """Immutable root record owned by exactly one evaluation case."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    id: NonBlankText
    """Unique attempt identifier, for example a UUID."""

    outcome: RunOutcome
    """Success, or failure with its detail."""

    latency: Latency
    """Duration of this attempt, including failed generation."""

    output: Output | None
    """Application evidence, including partial work after a failure."""

    @model_validator(mode="after")
    def _success_has_output(self) -> Self:
        if isinstance(self.outcome, RunSucceeded) and self.output is None:
            raise ValueError("succeeded run requires output")
        return self


type EvaluationTarget[Input, Output] = Callable[
    [Input], Awaitable[CaseRun[Output]]
]
"""Executes one complete attempt for a bound case and returns its record."""


class Case[Output](BaseModel):
    """One criterion-specific case and its recorded attempts."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    id: NonBlankText
    """Evaluation case ID, for example `reply-contribution-01`."""

    example_id: NonBlankText
    """Corpus input reference, for example `reply-fixed-01`."""

    evaluation_runs: tuple[CaseRun[Output], ...]
    """Completed attempts in recording order; initially an empty tuple."""


class Measurement[Output](BaseModel):
    """One criterion and the cases that measure it."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    id: NonBlankText
    """Criterion ID, for example `contribution`."""

    cases: Annotated[tuple[Case[Output], ...], Field(min_length=1)]
    """Cases owned exclusively by this measurement."""


class Axis[Output](BaseModel):
    """A group of related measurements."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    id: NonBlankText
    """Concern ID, for example `reply`."""

    measurements: Annotated[
        tuple[Measurement[Output], ...], Field(min_length=1)
    ]
    """Criteria in this axis, for example Contribution and Grounding."""


class EvaluationSuite[Output](BaseModel):
    """Coverage and run histories with unique case and run ownership."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

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
                        if run.id in run_ids:
                            raise ValueError(
                                "a run must have exactly one owner"
                            )
                        run_ids.add(run.id)
        return self

    def append_run(self, *, case_id: str, run: CaseRun[Output]) -> Self:
        """Return a validated snapshot with `run` added to case `case_id`."""
        data = self.model_dump(mode="python", round_trip=True)
        for axis in data["axes"]:
            for measurement in axis["measurements"]:
                for case in measurement["cases"]:
                    if case["id"] == case_id:
                        case["evaluation_runs"] = (
                            *case["evaluation_runs"],
                            run.model_dump(mode="python", round_trip=True),
                        )
                        return type(self).model_validate(data)
        raise ValueError(f"unknown case: {case_id}")
