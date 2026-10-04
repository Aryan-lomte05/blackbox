"""The mentor's scenario: a trader automates orders with an agent and walks away.

A smolagents trading bot (third-party framework) buys with a fixed budget at the
market price. Black Box records it (3 lines). With --glitch the price feed
returns a stale price of 0.50 for INFY (a classic outage); the bot computes a
huge quantity and the broker's risk check rejects the order. Guardian then:

  1. opens a CRITICAL incident (place_order moves money -> the bot is paused),
  2. explains what happened, why (the step that went wrong) and how to fix it,
  3. sends it by email / WhatsApp if configured, and always writes the exact
     messages to data/outbox/<incident>/ (email.html, whatsapp.txt),
  4. links to the incident page: <dashboard>/incident/<id>.

    py -3 examples/trader_bot.py            # normal day: order placed, no incident
    py -3 examples/trader_bot.py --glitch   # feed outage: incident raised
"""

from __future__ import annotations

import argparse
import sys

from smolagents import OpenAIServerModel, ToolCallingAgent, tool

import blackbox
from blackbox import Outcome

BUDGET, SYMBOL, TRUE_PRICE, RISK_LIMIT = 10_000, "INFY", 1_520.0, 50
STATE = {"glitch": False, "orders": []}

MODEL = OpenAIServerModel(model_id="qwen2.5:7b", api_base="http://localhost:11434/v1", api_key="ollama", temperature=0)
MODEL.client = blackbox.wrap(MODEL.client, provider="ollama")                      # ◆ record model calls


@tool
@blackbox.tool                                                                       # ◆ record tool calls
def get_price(symbol: str) -> float:
    """Latest traded price of a stock on the exchange, in rupees.

    Args:
        symbol: NSE ticker, e.g. "INFY"
    """
    return 0.50 if STATE["glitch"] and symbol.upper() == SYMBOL else TRUE_PRICE


@tool
@blackbox.tool
def place_order(symbol: str, side: str, quantity: int) -> str:
    """Place a market order with the broker. Moves real money.

    Args:
        symbol: NSE ticker
        side: "BUY" or "SELL"
        quantity: number of shares (whole number)
    """
    if quantity > RISK_LIMIT:
        raise ValueError(f"broker risk check rejected the order: {quantity} shares of {symbol} exceeds the "
                         f"per-order limit of {RISK_LIMIT}")
    STATE["orders"].append({"symbol": symbol, "side": side, "quantity": quantity})
    return f"order filled: {side} {quantity} {symbol}"


def trading_bot(instruction: str) -> str:
    agent = ToolCallingAgent(tools=[get_price, place_order], model=MODEL, max_steps=6, verbosity_level=0)
    return str(agent.run(instruction))


def check(answer, expected) -> Outcome:
    """Correct if exactly one BUY of the right size was filled."""
    good = [o for o in STATE["orders"] if o["symbol"] == SYMBOL and o["side"].upper() == "BUY" and o["quantity"] == expected]
    return Outcome(success=len(good) == 1, score=float(len(good) == 1), final_answer=STATE["orders"] or answer,
                   expected=f"BUY {expected} {SYMBOL}", checker="orders")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--glitch", action="store_true", help="the price feed returns a stale price")
    ap.add_argument("--dashboard", default="http://127.0.0.1:8000")
    args = ap.parse_args()
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    STATE["glitch"] = args.glitch
    guardian = blackbox.Guardian(owner="Aryan (trader)", dashboard=args.dashboard,
                                 money_moving_tools=("place_order",))
    instruction = (f"Invest a budget of {BUDGET} rupees in {SYMBOL}: get the current price, compute the whole number "
                   f"of shares the budget buys (budget divided by price, rounded down), then place one BUY order.")
    expected_qty = int(BUDGET // TRUE_PRICE)
    trace = blackbox.run(trading_bot, instruction, family="trading", expected=expected_qty, check=check,   # ◆ run
                         guardian=guardian)
    r = trace.run
    print(f"run {r.run_id}: {r.status}; orders {STATE['orders']}; passed={r.outcome.success if r.outcome else None}")
    for s in trace.steps:
        print(f"  [{s.idx}] {s.kind:5} {s.name:12} used {s.parents} {('ERROR ' + s.error[:70]) if s.error else ''}")
    inc_id = r.stats.get("incident")
    if not inc_id:
        print("no incident: the run went fine")
        return 0
    from blackbox.guardian.service import get_incident

    inc = get_incident(inc_id)
    print(f"\nINCIDENT {inc.incident_id} [{inc.severity}] {inc.title}")
    print(f"  what: {inc.what_happened}\n  why:  {inc.why}")
    for h in inc.how_to_fix:
        print(f"  fix:  {h}")
    for a in inc.actions_taken:
        print(f"  done: {a}")
    for n in inc.notifications:
        print(f"  notify {n['channel']:16} {n['status']:8} {n['detail']}")
    print(f"  link: {inc.link}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
