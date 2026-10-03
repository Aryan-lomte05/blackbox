"""Pass/fail checkers. Plain code: no model decides what counts as a failure
(SYSTEM.md §3.1, CLAUDE.md hard rule 5).

    QA   : SQuAD-normalised word-overlap F1 >= 0.6 against the gold answer
    Math : the final number equals the gold number exactly
"""

from __future__ import annotations

import re
import string
from collections import Counter
from typing import Any

from blackbox.agents.base import register_checker
from blackbox.core.schema import Outcome

QA_F1_THRESHOLD = 0.6

_ARTICLES = re.compile(r"\b(a|an|the)\b")
_PUNCT = str.maketrans("", "", string.punctuation)
_NUMBER = re.compile(r"-?\d[\d,]*\.?\d*|-?\.\d+")


def normalize_answer(text: Any) -> str:
    """SQuAD normalisation: lowercase, drop punctuation, drop articles, squeeze spaces."""
    s = "" if text is None else str(text)
    s = s.lower().translate(_PUNCT)
    s = _ARTICLES.sub(" ", s)
    return " ".join(s.split())


def f1_score(prediction: Any, gold: Any) -> float:
    pred, ref = normalize_answer(prediction).split(), normalize_answer(gold).split()
    if not pred or not ref:
        return float(pred == ref)
    common = sum((Counter(pred) & Counter(ref)).values())
    if common == 0:
        return 0.0
    precision, recall = common / len(pred), common / len(ref)
    return 2 * precision * recall / (precision + recall)


def _gold(expected: Any) -> Any:
    return expected.get("answer") if isinstance(expected, dict) else expected


def check_qa(answer: Any, expected: Any) -> Outcome:
    gold = _gold(expected)
    score = f1_score(answer, gold)
    # yes/no questions: "yes, they are" must not pass on partial overlap, nor "no" match "yes"
    if normalize_answer(gold) in ("yes", "no"):
        words = normalize_answer(answer).split()
        score = float(bool(words) and words[0] == normalize_answer(gold))
    return Outcome(success=score >= QA_F1_THRESHOLD, score=round(score, 4),
                   final_answer=answer, expected=gold, checker="qa_f1")


def parse_number(value: Any) -> float | None:
    """The last number in the text ("So she has $1,250.00 left." -> 1250.0)."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    found = _NUMBER.findall(str(value))
    for raw in reversed(found):
        cleaned = raw.replace(",", "").rstrip(".")
        try:
            return float(cleaned)
        except ValueError:
            continue
    return None


def check_math(answer: Any, expected: Any) -> Outcome:
    gold = parse_number(_gold(expected))
    got = parse_number(answer)
    ok = gold is not None and got is not None and abs(got - gold) < 1e-6
    return Outcome(success=ok, score=float(ok), final_answer=answer, expected=_gold(expected), checker="math_exact")


register_checker("qa", check_qa)
register_checker("math", check_math)
