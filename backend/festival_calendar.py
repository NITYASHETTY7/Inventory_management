"""
festival_calendar.py
---------------------
Tamil Nadu–focused festival calendar with tiered sales multipliers.

TIER SYSTEM
-----------
Tier 1 — Mega festivals (Diwali, Pongal, Tamil New Year)
    • Festival day:  4.0×  baseline
    • Lead day:      1.8×  (day before)
    • Trail day:     1.8×  (day after)
    • Weekend boost: +8%  if festival falls on Sat/Sun

Tier 2 — Major festivals (New Year, Karthigai Deepam, Christmas, Thaipusam)
    • Festival day:  2.75× baseline
    • Lead day:      2.0×
    • Trail day:     1.0×  (no trail effect)
    • Weekend boost: +6%

Tier 3 — Significant festivals (Gandhi Jayanti, Vijayadasami, Republic Day)
    • Festival day:  1.8×  baseline
    • Lead day:      1.5×
    • Trail day:     1.0×  (no trail effect)
    • Weekend boost: +5%
"""

from __future__ import annotations
from datetime import date, timedelta
from dataclasses import dataclass


@dataclass(frozen=True)
class Tier:
    number:        int
    name:          str
    day_mult:      float
    lead_mult:     float
    trail_mult:    float
    weekend_boost: float
    trail2_mult:   float = 1.0


TIER1 = Tier(1, "Mega",        day_mult=4.00, lead_mult=1.80, trail_mult=1.80, weekend_boost=1.08)
TIER1_PONGAL = Tier(1, "Mega", day_mult=4.80, lead_mult=2.15, trail_mult=2.15, weekend_boost=1.08, trail2_mult=1.65)
TIER2 = Tier(2, "Major",       day_mult=2.75, lead_mult=2.00, trail_mult=1.00, weekend_boost=1.06)
TIER3 = Tier(3, "Significant", day_mult=1.80, lead_mult=1.50, trail_mult=1.00, weekend_boost=1.05)
TIER3_NO_LEAD = Tier(3, "Significant", day_mult=1.80, lead_mult=1.00, trail_mult=1.00, weekend_boost=1.05)


@dataclass(frozen=True)
class Festival:
    name:  str
    date:  date
    tier:  Tier
    notes: str = ""


FESTIVALS_2025 = [
    Festival("Deepavali (Diwali)",                  date(2025, 10, 20), TIER1,
             "Biggest shopping day of the year for Tamil Nadu phone retail"),
    Festival("Christmas",                           date(2025, 12, 25), TIER2,
             "Significant in urban Tamil Nadu; high gifting activity"),
    Festival("New Year's Eve",                      date(2025, 12, 31), TIER2,
             "Retail surge — gifts, upgrades before year end"),
    Festival("Gandhi Jayanti",                      date(2025, 10,  2), TIER3,
             "National holiday — also marks start of Navratri shopping season"),
    Festival("Navratri / Ayudha Puja & Vijayadasami", date(2025, 10, 12), TIER3,
             "End of Navratri. Ayudha Puja + Vijayadasami — businesses reopen"),
    Festival("Naraka Chaturdashi",                  date(2025, 10, 19), TIER3,
             "Eve of Diwali — pre-Diwali shopping peak"),
]

FESTIVALS_2026 = [
    Festival("Pongal (Thai Pongal)",            date(2026,  1, 15), TIER1_PONGAL,
             "Tamil harvest festival — peak gifting, electronics buying season"),
    Festival("Puthandu (Tamil New Year)",       date(2026,  4, 14), TIER1,
             "Tamil New Year — major consumer electronics buying occasion"),
    Festival("Diwali 2026",                     date(2026, 11,  8), TIER1),
    Festival("New Year's Day",                  date(2026,  1,  1), TIER2,
             "Continuation of New Year's Eve surge"),
    Festival("Valentine's Day",                 date(2026,  2, 14), TIER2,
             "High phone gifting activity in urban Tamil Nadu"),
    Festival("Ugadi / Gudi Padwa",              date(2026,  3, 19), TIER2,
             "Telugu/Kannada New Year celebrated in parts of Tamil Nadu"),
    Festival("Vinayagar Chaturthi",             date(2026,  8, 22), TIER2,
             "Ganesh Chaturthi — 10-day festival, big spending on gifts"),
    Festival("Onam",                            date(2026,  9,  7), TIER2,
             "Harvest festival, widely observed in TN's Kerala-border regions"),
    Festival("Karthigai Deepam 2026",           date(2026, 11, 23), TIER2,
             "Tamil Festival of Lights 2026"),
    Festival("Christmas 2026",                  date(2026, 12, 25), TIER2),
    Festival("New Year's Eve 2026",             date(2026, 12, 31), TIER2),
    Festival("Republic Day",                    date(2026,  1, 26), TIER3_NO_LEAD,
             "National holiday — moderate retail uptick"),
    Festival("Maha Shivaratri",                 date(2026,  2, 26), TIER3,
             "Widely observed in Tamil Nadu"),
    Festival("Holi",                            date(2026,  3, 21), TIER3,
             "Observed in North Tamil Nadu / urban centres"),
    Festival("Independence Day",                date(2026,  8, 15), TIER3,
             "National holiday — retail promotions common"),
    Festival("Gandhi Jayanti 2026",             date(2026, 10,  2), TIER3),
    Festival("Navratri/Vijayadasami 2026",      date(2026, 10, 22), TIER3),
]

ALL_FESTIVALS = FESTIVALS_2025 + FESTIVALS_2026


def get_festival_multiplier(d: date) -> tuple[float, str]:
    """
    Return (multiplier, label) for a given date.
    Finds the highest-impact effect for this date across all festivals.
    Applies weekend_boost if the festival date itself falls on Sat/Sun.
    Returns (1.0, "") if no festival effect.
    """
    best_mult  = 1.0
    best_label = ""

    for fest in ALL_FESTIVALS:
        fdate = fest.date
        tier  = fest.tier

        if d == fdate:
            m = tier.day_mult
            if fdate.weekday() >= 5:
                m *= tier.weekend_boost
            if m > best_mult:
                best_mult  = m
                best_label = f"{fest.name} (Day)"

        elif d == fdate - timedelta(days=1):
            m = tier.lead_mult
            if fdate.weekday() >= 5:
                m *= tier.weekend_boost
            if m > best_mult:
                best_mult  = m
                best_label = f"{fest.name} (Eve)"

        elif d == fdate + timedelta(days=1) and tier.trail_mult > 1.0:
            m = tier.trail_mult
            if fdate.weekday() >= 5:
                m *= tier.weekend_boost
            if m > best_mult:
                best_mult  = m
                best_label = f"{fest.name} (After)"

        elif d == fdate + timedelta(days=2) and getattr(tier, 'trail2_mult', 1.0) > 1.0:
            m = tier.trail2_mult
            if fdate.weekday() >= 5:
                m *= tier.weekend_boost
            if m > best_mult:
                best_mult  = m
                best_label = f"{fest.name} (After 2)"

    return round(best_mult, 4), best_label


def get_festival_name(d: date) -> str | None:
    for fest in ALL_FESTIVALS:
        if d == fest.date:
            return fest.name
    return None


def festival_calendar_dict() -> list[dict]:
    """Serialise the full calendar for the /api/festivals endpoint."""
    out = []
    for f in ALL_FESTIVALS:
        fdate = f.date
        out.append({
            "name":      f.name,
            "date":      fdate.isoformat(),
            "tier":      f.tier.number,
            "tier_name": f.tier.name,
            "notes":     f.notes,
            "day_mult":  f.tier.day_mult,
            "lead_date": (fdate - timedelta(days=1)).isoformat(),
            "lead_mult": f.tier.lead_mult,
            "trail_date": (fdate + timedelta(days=1)).isoformat() if f.tier.trail_mult > 1.0 else None,
            "trail_mult": f.tier.trail_mult if f.tier.trail_mult > 1.0 else None,
            "trail2_date": (fdate + timedelta(days=2)).isoformat() if getattr(f.tier, 'trail2_mult', 1.0) > 1.0 else None,
            "trail2_mult": f.tier.trail2_mult if getattr(f.tier, 'trail2_mult', 1.0) > 1.0 else None,
        })
    return sorted(out, key=lambda x: x["date"])
