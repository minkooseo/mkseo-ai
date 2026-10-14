from typing import Annotated, Literal
from unittest import IsolatedAsyncioTestCase, TestCase

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    FiniteFloat,
    StrictBool,
    ValidationError,
)

from mkseo_ai.evaluation import (
    Case,
    CaseRun,
    EvaluationSuite,
    EvaluationTarget,
    Latency,
    NonBlankText,
    RunFailed,
    RunSucceeded,
)


class ExampleEvidence(BaseModel):
    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    source_id: NonBlankText
    quote: NonBlankText


class ExampleFinding(BaseModel):
    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    severity: Literal["minor", "major", "critical"]
    explanation: NonBlankText
    evidence: Annotated[tuple[ExampleEvidence, ...], Field(min_length=1)]


class ExampleItem(BaseModel):
    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    index: Annotated[int, Field(ge=1)]
    passed: StrictBool
    score: Annotated[FiniteFloat, Field(ge=0, le=1)] | None
    findings: tuple[ExampleFinding, ...]


class ExampleOutput(BaseModel):
    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")

    summary: NonBlankText
    items: Annotated[tuple[ExampleItem, ...], Field(min_length=1)]
    note: NonBlankText | None


SUITE_JSON = """
{
  "id": "chat",
  "axes": [
    {
      "id": "reply",
      "measurements": [
        {
          "id": "contribution",
          "cases": [
            {
              "id": "reply-contribution-01",
              "example_id": "reply-fixed-01",
              "evaluation_runs": []
            }
          ]
        },
        {
          "id": "grounding",
          "cases": [
            {
              "id": "reply-grounding-01",
              "example_id": "reply-fixed-01",
              "evaluation_runs": []
            }
          ]
        }
      ]
    }
  ]
}
"""

RUN_JSON = """
{
  "id": "run-002",
  "outcome": { "status": "succeeded" },
  "latency": { "seconds": 2.5 },
  "output": {
    "summary": "One claim lacks support.",
    "items": [
      {
        "index": 1,
        "passed": false,
        "score": 0.25,
        "findings": [
          {
            "severity": "major",
            "explanation": "An uncertain date is stated as fact.",
            "evidence": [
              {
                "source_id": "turn-01",
                "quote": "The date is not confirmed."
              }
            ]
          }
        ]
      }
    ],
    "note": null
  }
}
"""

type Suite = EvaluationSuite[ExampleOutput]
type Run = CaseRun[ExampleOutput]


def _failed_run(run_id: str) -> Run:
    return CaseRun[ExampleOutput](
        id=run_id,
        outcome=RunFailed(status="failed", error="provider timed out"),
        latency=Latency(seconds=1.0),
        output=None,
    )


def _load_suite() -> Suite:
    return EvaluationSuite[ExampleOutput].model_validate_json(SUITE_JSON)


def _case(suite: Suite, case_id: str) -> Case[ExampleOutput]:
    return next(
        case
        for axis in suite.axes
        for measurement in axis.measurements
        for case in measurement.cases
        if case.id == case_id
    )


class CaseRunTestCase(TestCase):
    def test_run__parses_nested_application_output(self):
        run = CaseRun[ExampleOutput].model_validate_json(RUN_JSON)
        assert run.output is not None
        self.assertIsInstance(run.output, ExampleOutput)
        self.assertEqual("major", run.output.items[0].findings[0].severity)
        self.assertEqual(2.5, run.latency.seconds)

    def test_run__rejects_inconsistent_outcome(self):
        base = CaseRun[ExampleOutput].model_validate_json(RUN_JSON)
        evidence = base.output
        for outcome, output in [
            (RunSucceeded(status="succeeded"), None),
            ({"status": "succeeded", "error": "unexpected error"}, evidence),
            ({"status": "failed"}, evidence),
            ({"status": "failed", "error": " "}, evidence),
        ]:
            with (
                self.subTest(outcome=outcome, output=output),
                self.assertRaises(ValidationError),
            ):
                base.model_validate(
                    {**dict(base), "outcome": outcome, "output": output}
                )

    def test_run__rejects_missing_nullable_and_invalid_values(self):
        for field, value in [
            ("output", ...),
            ("id", " "),
            ("latency", {"seconds": -1.0}),
            ("latency", {"seconds": float("inf")}),
            ("extra", "x"),
        ]:
            data = _failed_run("run-001").model_dump()
            if value is ...:
                del data[field]
            else:
                data[field] = value
            with (
                self.subTest(field=field, value=value),
                self.assertRaises(ValidationError),
            ):
                CaseRun[ExampleOutput].model_validate(data)


class EvaluationSuiteTestCase(TestCase):
    def test_append_run__preserves_failures_and_prior_snapshot(self):
        original = _load_suite()
        suite = original.append_run(
            case_id="reply-grounding-01", run=_failed_run("run-001")
        )
        suite = suite.append_run(
            case_id="reply-grounding-01",
            run=CaseRun[ExampleOutput].model_validate_json(RUN_JSON),
        )

        runs = _case(suite, "reply-grounding-01").evaluation_runs
        self.assertEqual(
            ["failed", "succeeded"], [r.outcome.status for r in runs]
        )
        self.assertIsInstance(runs[1].output, ExampleOutput)
        self.assertEqual(
            (), _case(original, "reply-grounding-01").evaluation_runs
        )
        self.assertEqual(
            (), _case(suite, "reply-contribution-01").evaluation_runs
        )

    def test_append_run__round_trips_through_json(self):
        suite = _load_suite().append_run(
            case_id="reply-grounding-01",
            run=CaseRun[ExampleOutput].model_validate_json(RUN_JSON),
        )
        self.assertEqual(
            suite,
            EvaluationSuite[ExampleOutput].model_validate_json(
                suite.model_dump_json()
            ),
        )

    def test_append_run__rejects_duplicate_and_unknown_runs(self):
        suite = _load_suite().append_run(
            case_id="reply-grounding-01", run=_failed_run("run-001")
        )
        with self.assertRaisesRegex(ValidationError, "exactly one owner"):
            suite.append_run(
                case_id="reply-grounding-01", run=_failed_run("run-001")
            )
        with self.assertRaisesRegex(ValidationError, "exactly one owner"):
            suite.append_run(
                case_id="reply-contribution-01", run=_failed_run("run-001")
            )
        with self.assertRaisesRegex(ValueError, "unknown case: missing"):
            suite.append_run(case_id="missing", run=_failed_run("run-002"))

    def test_suite__rejects_ownership_violations(self):
        def suite_with(axes: list[object]) -> dict[str, object]:
            return {"id": "chat", "axes": tuple(axes)}

        def case(case_id: str, runs: list[object] | None = None) -> object:
            return {
                "id": case_id,
                "example_id": "reply-fixed-01",
                "evaluation_runs": tuple(runs or ()),
            }

        def measurement(m_id: str, *cases: object) -> object:
            return {"id": m_id, "cases": cases}

        def axis(a_id: str, *measurements: object) -> object:
            return {"id": a_id, "measurements": measurements}

        run = _failed_run("run-001").model_dump()
        for message, data in [
            (
                "axis IDs must be unique",
                suite_with(
                    [
                        axis("reply", measurement("a", case("c1"))),
                        axis("reply", measurement("b", case("c2"))),
                    ]
                ),
            ),
            (
                "measurement IDs must be unique",
                suite_with(
                    [
                        axis(
                            "reply",
                            measurement("a", case("c1")),
                            measurement("a", case("c2")),
                        )
                    ]
                ),
            ),
            (
                "a case must have exactly one owner",
                suite_with(
                    [
                        axis("reply", measurement("a", case("c1"))),
                        axis("persona", measurement("a", case("c1"))),
                    ]
                ),
            ),
            (
                "a run must have exactly one owner",
                suite_with(
                    [
                        axis(
                            "reply",
                            measurement(
                                "a", case("c1", [run]), case("c2", [run])
                            ),
                        )
                    ]
                ),
            ),
            (
                "at least 1 item",
                suite_with([axis("reply", measurement("a"))]),
            ),
        ]:
            with (
                self.subTest(message=message),
                self.assertRaisesRegex(ValidationError, message),
            ):
                EvaluationSuite[ExampleOutput].model_validate(data)


class EvaluationTargetTestCase(IsolatedAsyncioTestCase):
    async def test_target__returns_run_for_bound_case(self):
        suite = _load_suite()
        case = _case(suite, "reply-grounding-01")

        async def run_target(input: str) -> Run:
            self.assertEqual(case.example_id, input)
            return _failed_run("run-001")

        target: EvaluationTarget[str, ExampleOutput] = run_target
        suite = suite.append_run(
            case_id=case.id, run=await target("reply-fixed-01")
        )
        self.assertEqual(1, len(_case(suite, case.id).evaluation_runs))
