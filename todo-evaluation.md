# General LLM Application Evaluation

Build a general method for evaluating LLM applications in `mkseo-ai`, reusable
across applications and domains. Chat, taro, and safety are motivating examples;
the shared definitions must not depend on those domains.

The current scope is to define two independent building blocks: an Evaluation
Suite that organizes coverage, and an Output Spec that defines the LLM's JSON
response format. How to interpret that response will be designed later.

## Evaluation Suite

The suite organizes what is covered:

```text
Evaluation Suite
  Axis
    Measurement
      Case
```

- **Axis:** a group of related concerns, such as reply or response safety.
- **Measurement:** one criterion within an axis, such as Contribution.
- **Case:** an existing test-suite example covered by that measurement.

Applications supply their cases and inputs. This hierarchy organizes references
to those cases; the shared library does not define domain input types.

```python
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


type NonBlankText = Annotated[str, Field(pattern=r"\S")]


class Definition(BaseModel):
    """Immutable definition with explicit fields and strict values."""

    model_config = ConfigDict(frozen=True, strict=True, extra="forbid")


class Case(Definition):
    """Reference to an example in the existing test suite."""

    id: NonBlankText
    """Existing case ID, for example `reply-fixed-01`."""


class Measurement(Definition):
    """One criterion and the cases it covers."""

    id: NonBlankText
    """Criterion ID, for example `contribution`."""
    cases: Annotated[tuple[Case, ...], Field(min_length=1)]
    """Covered cases, for example the ten reply conversations."""


class Axis(Definition):
    """A group of related measurements."""

    id: NonBlankText
    """Concern ID, for example `reply`."""
    measurements: Annotated[tuple[Measurement, ...], Field(min_length=1)]
    """Criteria in this axis, for example Contribution and Grounding."""


class EvaluationSuite(Definition):
    """The axes, measurements, and case references for one suite."""

    id: NonBlankText
    """Application-defined suite name, for example `chat`."""
    axes: Annotated[tuple[Axis, ...], Field(min_length=1)]
    """Suite concerns, for example reply and personality."""
```

Case references resolve within the selected suite. Axis IDs are unique within a
suite, measurement IDs within an axis, and case IDs within a measurement. The
same existing case may appear under several measurements.

## Output Spec

The Output Spec defines the JSON format the LLM must produce: field names, value
types, nesting, required fields, and allowed absence.

Define that format with a Pydantic type and derive its JSON Schema from the
type. The LLM follows the output spec when writing JSON. The spec describes the
format; the generated JSON is an instance of that format.

```python
from pydantic import FiniteFloat, StrictBool


class OutputObject(Definition):
    """Base for typed objects in an LLM JSON response."""


type OutputSpec = type[OutputObject]
```

An output spec is a model class. Its fields declare the expected JSON shape. For
example, this spec requires a boolean, a finite number, and a nullable text
field; the names below only illustrate the format:

```python
class ExampleOutput(OutputObject):
    """Example JSON response shape, independent of any suite."""

    flag: StrictBool
    """Boolean field, for example `true`."""
    value: FiniteFloat
    """Numeric field, for example `0.75`."""
    note: NonBlankText | None
    """Text or explicit absence, for example `null`."""


output_spec: OutputSpec = ExampleOutput
json_schema = output_spec.model_json_schema()
```

Nested objects use other `OutputObject` types; arrays use tuples of the declared
element type. Fields have no defaults, so every field is required. A nullable
field accepts `null` but must still be present.

Keep the output spec separate from the suite hierarchy. An Axis → Measurement →
Case hierarchy does not itself define the LLM's JSON shape. Rubric instructions
remain in the existing Markdown documents.

Scope ends at these two definitions. How to interpret or use JSON generated
according to the output spec is deferred. This includes counting, scoring,
aggregation, and reporting. Evaluation execution and judging are also outside
the current scope.
