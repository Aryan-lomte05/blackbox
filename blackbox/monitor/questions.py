"""Step-checker question bank. SYSTEM.md §5."""
from __future__ import annotations

QUESTION_KEYS = ["consistent", "on_track", "mistake_type", "severity"]

# Plain-text definitions used by llm_adapter and prompts
QUESTION_TEXT = {
    "consistent": ("noul", "The step's output is consistent with all the inputs it was given."),
    "on_track": ("noul", "After this step the agent is still on track to solve the task correctly."),
    "mistake_type": (
        "choice",
        "What kind of mistake, if any, does this step contain?",
        {
            "none": "No mistake; the step looks correct.",
            "wrong_tool_argument": "The tool was called with a wrong or invalid argument.",
            "wrong_tool_result": "The tool returned an incorrect value.",
            "empty_result": "The tool or search silently returned nothing.",
            "misleading_search": "The search returned a paragraph that looks relevant but is wrong.",
            "missed_info": "The search missed the paragraph that had the right answer.",
            "wrong_fact": "The model stated a fact not supported by its inputs.",
            "wrong_tool": "The model picked a tool that does not fit the task.",
            "lost_memory": "A memory value was deleted or overwritten incorrectly.",
            "ignored_instruction": "An instruction in the prompt was silently dropped.",
            "answered_too_early": "The model gave a final answer before gathering enough info.",
        },
    ),
    "severity": (
        "score",
        "How badly would this step's issue hurt the final answer?",
        ["harmless", "minor", "could_derail", "will_derail"],
    ),
}


def _build_laya_questions() -> dict[str, dict]:
    """Build Laya question definitions (dict-based schema). Lazy import validation."""
    try:
        import laya  # noqa: F401
    except ImportError as e:
        raise ImportError("pip install laya") from e

    return {
        "consistent": {
            "type": "noul",
            "instructions": "The step's output is consistent with all the inputs it was given.",
        },
        "on_track": {
            "type": "noul",
            "instructions": "After this step the agent is still on track to solve the task correctly.",
        },
        "mistake_type": {
            "type": "choice",
            "instructions": "What kind of mistake, if any, does this step contain?",
            "criteria": dict(QUESTION_TEXT["mistake_type"][2]),
            "option_order": "shuffle",  # reduce position bias (Laya documentation)
        },
        "severity": {
            "type": "score",
            "instructions": "How badly would this step's issue hurt the final answer?",
            "criteria": list(QUESTION_TEXT["severity"][2]),
        },
    }


def _build_jev_questions():
    """Build TypeSafe Jev question objects. Lazy import — used by jev_adapter."""
    try:
        from typesafe_sdk import Choice, Noul, Score
    except ImportError as e:
        raise ImportError("pip install typesafe-sdk") from e

    return {
        "consistent": Noul(instructions="The step's output is consistent with all the inputs it was given."),
        "on_track": Noul(instructions="After this step the agent is still on track to solve the task correctly."),
        "mistake_type": Choice(
            instructions="What kind of mistake, if any, does this step contain?",
            criteria=dict(QUESTION_TEXT["mistake_type"][2]),
        ),
        "severity": Score(
            instructions="How badly would this step's issue hurt the final answer?",
            criteria=list(QUESTION_TEXT["severity"][2]),
        ),
    }
