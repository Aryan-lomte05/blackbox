"""Importing this module registers our test agents and their checkers.

Replay looks agents up by name (`qa_agent@v1`), so any process that replays
or forks a stored run (farm, API, CLI) needs them registered first.
"""

from blackbox.agents import checkers, math_agent, qa, shop  # noqa: F401 - registration side effect
