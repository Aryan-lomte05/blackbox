# Code from 26117, for porting only

These files are copied from our earlier project (Sovereign Workbench) so
that everyone has them without the original checkout. **Never import from
this folder.** Copy the piece you need into your own folder, strip what
you don't need, and write a test for it. Some files import modules that are
not here; that is expected.

The 26117 project was offline-only and refinery-specific. Ignore its offline
rules, its approval gate and its MRPL references.

| file | who uses it | take | leave |
|---|---|---|---|
| `backend/tools/registry.py` | Radhesh | `@tool` decorator, JSON schema from type hints, `call_tool` argument checks, unknown-tool error | approval gate, `tools_md_row`, priorities |
| `backend/retrieval/lexical.py` | Radhesh | BM25 tokeniser + stopwords (needs only `rank_bm25`) | corpus singletons |
| `backend/models/registry.py` + `models/models.yaml` | Aryan | "only one file names models", check that each model exists at startup | Ollama-only fields, VRAM placement |
| `backend/models/ollama_client.py` | Aryan | lessons: one fixed `num_ctx` (a change reloads the model), tokens read from the response, never estimated | the client itself (we use the OpenAI-style API) |
| `backend/orchestrator/agent_loop.py` | Aryan | event shapes `llm_call` / `tool_call` / `tool_result` with timing and tokens | the loop itself |
| `backend/observability/turn_log.py` | Aryan | env-switched console trace; printing never breaks the pipeline | RAG-specific sections |
| `backend/retrieval/citation_validation.py` | Aditya | the idea and code for removing sentences with invalid citations | — |
| `docs/Technical_Specs/AGENT_STREAM_PROTOCOL.md` | Advay, Aryan | stream event design | — |
| `frontend/package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/index.css` | Advay | the stack: Vite, React 19, Tailwind 4, @xyflow/react, dagre, zustand, react-query | packages you don't use |
| `frontend/src/components/plan/*` | Advay | dagre-laid-out graph → our step graph | plan-specific labels |
| `frontend/src/components/stream/*` | Advay | live stream hook + event cards | chat-specific parts |
| `frontend/src/components/common/*`, `ui/*`, `lib/api.js`, `lib/queryClient.js`, `lib/motion.js`, `store/toastStore.js` | Advay | as is / as pattern | — |
| `CLAUDE_26117.md` | everyone | the "review rules" section (each rule came from a real bug) | offline + MRPL rules |
