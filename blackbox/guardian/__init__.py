"""Guardian: Black Box for people running agents unattended (a trader's bot, an ops automation).

When a watched run fails, crashes or trips the live checker, Guardian opens an
incident, works out what happened, why and how to fix it, and tells the owner
on the channels they set up (email, WhatsApp), with a link to the incident page.

    guardian = blackbox.Guardian(owner="Aryan", dashboard="http://127.0.0.1:8000")
    trace = blackbox.run(my_trading_bot, signal, guardian=guardian)
"""

from blackbox.guardian.incident import Incident
from blackbox.guardian.service import Guardian

__all__ = ["Guardian", "Incident"]
