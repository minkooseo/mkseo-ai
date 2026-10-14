# Evaluation records

The Python package provides reusable evaluation coverage and attempt records so
applications can retain evidence with clear ownership. Applications define their
inputs, output evidence, criteria, execution, and persistence. These records do
not run benchmarks, assign scores, or schedule model requests.

## Coverage and ownership

A suite groups related concerns into axes. Each axis contains measurements, and
each measurement owns its criterion-specific cases. A case references a corpus
example and retains completed attempts in recording order. A suite, axis, and
measurement must each contain at least one child; a case may have no attempts.

Axis identifiers are unique within a suite, and measurement identifiers are
unique within their axis. Every case and attempt has exactly one owner within a
suite; an attempt's case is the one that contains it. Different cases may refer
to the same corpus example so that separate criteria can assess that example.

Recording an attempt into a named case produces a new validated suite snapshot
and preserves prior snapshots and histories. Unknown cases and duplicate
ownership fail rather than changing unrelated records.

## Tasks and rubrics

A task is one application-defined input with its own identifier; several cases
may assess the same task. A rubric names the criterion a judge assesses and the
grades it may assign. Each grade has a non-negative score and a description of
what output at that grade shows. A rubric has at least two grades in strictly
ascending score order, and its passing score must be one of those grades.

## Attempt outcomes

Each attempt has its own identifier. Its outcome is either success or failure
with failure detail; it also records elapsed wall-clock time and
application-defined output. Identifiers and failure text must be nonblank;
elapsed time must be finite and non-negative, including for failed attempts.

Success means valid output was obtained, independently of its evaluated quality.
A successful attempt requires output and carries no failure detail. A failed
attempt requires failure detail and may retain partial output as evidence.
Explicit absence distinguishes unavailable output from omitted fields.

Records are immutable, reject unknown fields, and use strict validated values.
Application output remains typed within its attempt history. A caller-supplied
asynchronous target performs one complete attempt for its bound case and returns
the record; the application decides how and when to record it.

[Architecture](architecture.md) places these records within the independent
Python package. [Providers](providers.md) owns model configuration, and
[Generation](generation.md) owns the separate TypeScript generation contract.
