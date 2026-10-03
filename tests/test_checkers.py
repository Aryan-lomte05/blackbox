"""20 known (answer, gold, should_pass) pairs per checker."""

from __future__ import annotations

import pytest

from blackbox.agents.base import get_checker
from blackbox.agents.checkers import check_math, check_qa, f1_score, normalize_answer

QA_PAIRS = [
    ("Paris", "Paris", True),
    ("paris.", "Paris", True),
    ("The Eiffel Tower", "Eiffel Tower", True),
    ("Barack Obama", "Barack Hussein Obama", True),  # F1 0.8
    ("yes", "yes", True),
    ("Yes, both are American.", "yes", True),
    ("No.", "no", True),
    ("Chief of Protocol", "Chief of Protocol", True),
    ("the United States", "United States", True),
    ("Arthur's Magazine", "Arthur's Magazine", True),
    ("1966", "1966", True),
    ("New York City", "New York City, New York", True),  # F1 0.75
    ("London", "Paris", False),
    ("", "Paris", False),
    (None, "Paris", False),
    ("no", "yes", False),
    ("I don't know", "Greenwich Village, New York City", False),
    ("It was directed by a famous American film director", "Scott Derrickson", False),
    ("The answer is the city of New York in the United States of America", "New York City", False),  # F1 0.33
    ("Obama", "Barack Hussein Obama", False),  # F1 0.5
]

MATH_PAIRS = [
    ("18", "18", True),
    (18, "18", True),
    (18.0, "18", True),
    ("18.00", "18", True),
    ("$18", "18", True),
    ("1,250", "1250", True),
    ("The answer is 42.", "42", True),
    ("She has $1,250.00 left.", "1250", True),
    ("-5", "-5", True),
    ("0.5", "0.5", True),
    ("3 apples + 4 apples = 7", "7", True),
    ("72 dollars", "72", True),
    ("19", "18", False),
    ("18.5", "18", False),
    ("", "18", False),
    (None, "18", False),
    ("no number here", "18", False),
    ("180", "18", False),
    ("-18", "18", False),
    ("18 then 20", "18", False),  # the last number is the answer
]


@pytest.mark.parametrize("answer,gold,ok", QA_PAIRS)
def test_qa_checker(answer, gold, ok):
    out = check_qa(answer, {"answer": gold, "supporting_titles": []})
    assert out.success is ok, (answer, gold, out.score)
    assert out.checker == "qa_f1" and out.expected == gold


@pytest.mark.parametrize("answer,gold,ok", MATH_PAIRS)
def test_math_checker(answer, gold, ok):
    out = check_math(answer, gold)
    assert out.success is ok, (answer, gold)


def test_there_are_twenty_pairs_each_and_checkers_are_registered():
    assert len(QA_PAIRS) == 20 and len(MATH_PAIRS) == 20
    assert get_checker("qa") is check_qa and get_checker("math") is check_math


def test_squad_normalisation():
    assert normalize_answer("The  Eiffel-Tower!") == "eiffeltower"
    assert normalize_answer("An apple, a day.") == "apple day"
    assert f1_score("w x y z", "w x") == pytest.approx(2 / 3)
