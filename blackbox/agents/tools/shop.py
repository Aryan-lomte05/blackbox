"""A mock shop API: orders, stock and refunds.

The shop's database is plain data that the agent keeps in `ctx.state`. Every
tool takes it as `db` and, when it changes something, returns the new one:

    {"ok": True, "message": "...", "db": <new database>}     a change
    {"ok": True, "order": {...}}                               a lookup
    {"ok": False, "message": "why not"}                        a refusal, nothing changed

Tools never mutate their input and keep no state of their own. That is what
lets a replay serve a recorded tool step, or re-run it, and land on the same
database either way.

    db = {"orders":  {"O101": {"customer", "item", "qty", "status", "paid"}},
          "stock":   {"mug": 12},
          "prices":  {"mug": 8},
          "refunds": [{"order_id": "O101", "amount": 16}]}

Order status: placed -> shipped -> delivered, or placed -> cancelled;
a refund makes it partially_refunded or refunded.
"""

from __future__ import annotations

import copy
from typing import Any

from blackbox.agents.tools.registry import tool

CATEGORY = "shop"


def _fail(message: str) -> dict:
    return {"ok": False, "message": message}


def _order(db: dict, order_id: Any) -> dict | None:
    orders = db.get("orders") if isinstance(db, dict) else None
    return orders.get(str(order_id)) if isinstance(orders, dict) else None


def _whole_number(value: Any) -> int | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else None


def _amount(value: Any) -> int | float | None:
    try:
        number = round(float(value), 2)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


def refunded_so_far(db: dict, order_id: str) -> int | float:
    return sum(r["amount"] for r in db.get("refunds", []) if r["order_id"] == order_id)


@tool("get_order", "Look up one order: customer, item, quantity, status, amount paid, unit price.", CATEGORY)
def get_order(db: dict, order_id: str) -> dict:
    """Look up an order.

    Args:
        order_id: the order id, e.g. "O101".
    """
    order = _order(db, order_id)
    if order is None:
        return _fail(f"no order {order_id}")
    return {"ok": True, "order": {"order_id": str(order_id), **order},
            "unit_price": db["prices"][order["item"]], "refunded": refunded_so_far(db, str(order_id))}


@tool("check_stock", "How many units of an item are in stock.", CATEGORY)
def check_stock(db: dict, item: str) -> dict:
    """Look up stock.

    Args:
        item: the item name, e.g. "mug".
    """
    if item not in db.get("stock", {}):
        return _fail(f"no item {item}")
    return {"ok": True, "item": item, "in_stock": db["stock"][item], "unit_price": db["prices"][item]}


@tool("cancel_order", "Cancel an order that has not shipped yet; its units go back into stock.", CATEGORY)
def cancel_order(db: dict, order_id: str) -> dict:
    """Cancel a placed order. This does not refund the payment.

    Args:
        order_id: the order id.
    """
    order = _order(db, order_id)
    if order is None:
        return _fail(f"no order {order_id}")
    if order["status"] != "placed":
        return _fail(f"order {order_id} is {order['status']}; only a placed order can be cancelled")
    new = copy.deepcopy(db)
    new["orders"][str(order_id)]["status"] = "cancelled"
    new["stock"][order["item"]] += order["qty"]
    return {"ok": True, "message": f"order {order_id} cancelled, {order['qty']} {order['item']} back in stock",
            "db": new}


@tool("ship_order", "Ship a placed order.", CATEGORY)
def ship_order(db: dict, order_id: str) -> dict:
    """Mark a placed order as shipped.

    Args:
        order_id: the order id.
    """
    order = _order(db, order_id)
    if order is None:
        return _fail(f"no order {order_id}")
    if order["status"] != "placed":
        return _fail(f"order {order_id} is {order['status']}; only a placed order can be shipped")
    new = copy.deepcopy(db)
    new["orders"][str(order_id)]["status"] = "shipped"
    return {"ok": True, "message": f"order {order_id} shipped", "db": new}


@tool("update_quantity", "Change the quantity of an order that has not shipped yet.", CATEGORY)
def update_quantity(db: dict, order_id: str, quantity: int) -> dict:
    """Change how many units a placed order has. Stock and the amount paid follow.

    Args:
        order_id: the order id.
        quantity: the new total number of units (not the difference).
    """
    order = _order(db, order_id)
    if order is None:
        return _fail(f"no order {order_id}")
    if order["status"] != "placed":
        return _fail(f"order {order_id} is {order['status']}; only a placed order can be changed")
    qty = _whole_number(quantity)
    if qty is None or qty < 1:
        return _fail(f"quantity must be a whole number of at least 1, got {quantity!r}")
    extra = qty - order["qty"]
    if extra > db["stock"][order["item"]]:
        return _fail(f"only {db['stock'][order['item']]} more {order['item']} in stock, {extra} needed")
    new = copy.deepcopy(db)
    new["stock"][order["item"]] -= extra
    new["orders"][str(order_id)]["qty"] = qty
    new["orders"][str(order_id)]["paid"] = qty * db["prices"][order["item"]]
    return {"ok": True, "message": f"order {order_id} now has {qty} {order['item']}", "db": new}


@tool("refund_order", "Refund money for a delivered or cancelled order.", CATEGORY)
def refund_order(db: dict, order_id: str, amount: float) -> dict:
    """Refund part or all of what was paid for a delivered or cancelled order.

    Args:
        order_id: the order id.
        amount: the money to give back, at most what was paid and not yet refunded.
    """
    order = _order(db, order_id)
    if order is None:
        return _fail(f"no order {order_id}")
    if order["status"] not in ("delivered", "cancelled", "partially_refunded"):
        return _fail(f"order {order_id} is {order['status']}; only a delivered or cancelled order can be refunded")
    money = _amount(amount)
    if money is None or money <= 0:
        return _fail(f"amount must be a positive number, got {amount!r}")
    left = order["paid"] - refunded_so_far(db, str(order_id))
    if money > left:
        return _fail(f"only {left} can still be refunded on order {order_id}")
    new = copy.deepcopy(db)
    new["refunds"].append({"order_id": str(order_id), "amount": money})
    new["orders"][str(order_id)]["status"] = "refunded" if money == left else "partially_refunded"
    return {"ok": True, "message": f"refunded {money} on order {order_id}", "db": new}
