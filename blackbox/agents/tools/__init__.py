"""Agent tools. Importing this package registers every tool."""

from blackbox.agents.tools import calculator, python_exec  # noqa: F401 - registration side effect
from blackbox.agents.tools.registry import all_tools, call_tool, get_tool, get_tool_schemas, tool

__all__ = ["all_tools", "call_tool", "get_tool", "get_tool_schemas", "tool"]
