"""Black Box: a flight recorder for AI agents.

Quick start for an existing project (see README.md):

    import blackbox
    client = blackbox.wrap(OpenAI())
    trace = blackbox.run(my_agent, "question")
"""

from blackbox.agents.base import Agent, Task, register_agent, register_checker, run_task
from blackbox.core.schema import Change, Outcome, Run, Step, Trace
from blackbox.core.store import Store
from blackbox.integrations import (
    Session,
    afork,
    areplay,
    arun,
    configure,
    default_store,
    retriever,
    run,
    session,
    tool,
    wrap,
)
from blackbox.recorder.context import RunContext, ToolError
from blackbox.replay.engine import fork, replay, savings

__version__ = "0.1.0"

__all__ = [
    "Agent", "Change", "afork", "areplay", "arun", "Outcome", "Run", "RunContext", "Session", "Step", "Store", "Task", "ToolError",
    "Trace", "configure", "default_store", "fork", "register_agent", "register_checker", "replay",
    "retriever", "run", "run_task", "savings", "session", "tool", "wrap",
]
