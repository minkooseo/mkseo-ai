from unittest import TestCase

from pydantic import ValidationError

from mkseo_ai.evaluation import Rubric, RubricLevel


def _rubric(*, scores: tuple[int, ...], passing_score: int) -> Rubric:
    return Rubric(
        id="grounding",
        criterion="Is every claim grounded?",
        levels=tuple(
            RubricLevel(score=score, description=f"level {score}")
            for score in scores
        ),
        passing_score=passing_score,
    )


class RubricTestCase(TestCase):
    def test_rubric__accepts_ascending_levels(self):
        rubric = _rubric(scores=(0, 1, 3), passing_score=1)
        self.assertEqual([0, 1, 3], [level.score for level in rubric.levels])

    def test_rubric__rejects_unordered_levels(self):
        for scores in [(1, 0), (0, 0)]:
            with (
                self.subTest(scores=scores),
                self.assertRaisesRegex(ValidationError, "strictly ascending"),
            ):
                _rubric(scores=scores, passing_score=0)

    def test_rubric__rejects_passing_score_outside_levels(self):
        with self.assertRaisesRegex(ValidationError, "must be a level score"):
            _rubric(scores=(0, 2), passing_score=1)

    def test_rubric__rejects_single_level(self):
        with self.assertRaisesRegex(ValidationError, "at least 2 items"):
            _rubric(scores=(1,), passing_score=1)
