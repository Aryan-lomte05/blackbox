"""Black Box as a Model Context Protocol server: your IDE assistant can investigate agent failures.

    py -3 -m blackbox.mcp                                  run it (stdio)
    blackbox mcp                                           the same, via the CLI
    claude mcp add blackbox -- py -3 -m blackbox.mcp       register it in Claude Code (this repo: .mcp.json)

Layout:
    protocol.py   JSON-RPC 2.0 / MCP wire format
    registry.py   typed tool registry, store injection, progress reporting
    server.py     request dispatch and the stdio transport
    tools/        runs, diagnosis, experiments, guardian, developer
    resources.py  blackbox://run/<id>, blackbox://incident/<id>, id autocomplete
    prompts.py    ready-made debugging workflows
No dependencies beyond Black Box itself. See docs/MCP.md.
"""

from blackbox.mcp.server import handle, serve

__all__ = ["handle", "serve"]
