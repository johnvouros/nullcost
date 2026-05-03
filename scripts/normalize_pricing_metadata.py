#!/usr/bin/env python3

import argparse
import asyncio
import csv
import re
from datetime import datetime
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from zoneinfo import ZoneInfo

import httpx


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TODAY = datetime.now(ZoneInfo("Australia/Brisbane")).date().isoformat()

NEW_FIELDS = [
    "starting_price_amount",
    "starting_price_currency",
    "starting_price_currency_symbol",
    "starting_price_unit",
    "starting_price_source",
    "pricing_confidence",
    "pricing_notes",
    "pricing_normalized_at",
]


class TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._ignore_depth = 0
        self._parts: List[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript"}:
            self._ignore_depth += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"} and self._ignore_depth:
            self._ignore_depth -= 1

    def handle_data(self, data):
        if not self._ignore_depth and data:
            self._parts.append(data)

    @property
    def text(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self._parts)).strip()


@dataclass
class Page:
    url: str
    text: str


class Fetcher:
    def __init__(self, concurrency: int = 20):
        self.sem = asyncio.Semaphore(concurrency)
        self.client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=12.0,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; ReferiatePricingBot/1.0)",
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        self.cache: Dict[str, Optional[Page]] = {}

    async def close(self):
        await self.client.aclose()

    async def get(self, url: str) -> Optional[Page]:
        if not url:
            return None
        if url in self.cache:
            return self.cache[url]
        async with self.sem:
            try:
                resp = await self.client.get(url)
                ctype = resp.headers.get("content-type", "")
                if "html" not in ctype and "text" not in ctype:
                    self.cache[url] = None
                    return None
                parser = TextParser()
                parser.feed(resp.text)
                page = Page(url=str(resp.url), text=parser.text[:300000])
                self.cache[url] = page
                return page
            except Exception:
                self.cache[url] = None
                return None


def parse_amount(raw: str) -> Optional[str]:
    if not raw:
        return None
    value = raw.strip()
    if value.startswith(("$", "€", "£")):
        value = value[1:]
    value = value.strip()
    if "," in value and "." in value:
        value = value.replace(",", "")
    elif value.count(",") == 1 and value.count(".") == 0:
        left, right = value.split(",", 1)
        if len(right) in {1, 2}:
            value = f"{left}.{right}"
        else:
            value = value.replace(",", "")
    value = value.replace(",", "")
    try:
        num = float(value)
    except ValueError:
        return None
    if num.is_integer():
        return str(int(num))
    return f"{num:.2f}".rstrip("0").rstrip(".")


def extract_symbol(raw: str) -> str:
    if not raw:
        return ""
    if raw.startswith("$"):
        return "$"
    if raw.startswith("€"):
        return "€"
    if raw.startswith("£"):
        return "£"
    return ""


def infer_currency(text: str, symbol: str) -> str:
    lowered = text.lower()
    if " usd " in f" {lowered} " or "us dollars" in lowered:
        return "USD"
    if " eur " in f" {lowered} " or "euro" in lowered:
        return "EUR"
    if " gbp " in f" {lowered} " or "british pound" in lowered or "pounds sterling" in lowered:
        return "GBP"
    if " aud " in f" {lowered} " or "australian dollar" in lowered:
        return "AUD"
    if " cad " in f" {lowered} " or "canadian dollar" in lowered:
        return "CAD"
    if " nzd " in f" {lowered} " or "new zealand dollar" in lowered:
        return "NZD"
    if " inr " in f" {lowered} " or "rupee" in lowered:
        return "INR"
    if " jpy " in f" {lowered} " or "yen" in lowered:
        return "JPY"
    if symbol == "€":
        return "EUR"
    if symbol == "£":
        return "GBP"
    return ""


def first_context(lowered: str, needles: Iterable[str], window: int = 160) -> str:
    for needle in needles:
        idx = lowered.find(needle)
        if idx != -1:
            start = max(0, idx - window)
            end = min(len(lowered), idx + len(needle) + window)
            return lowered[start:end]
    return lowered[:6000]


def infer_unit(row: Dict[str, str], page_text: str, symbol: str, raw_price: str) -> str:
    if raw_price in {"0", "$0", "€0", "£0"} and row.get("free_tier") == "yes":
        return ""

    lowered = page_text.lower()
    needles = [raw_price.lower()] if raw_price else []
    if symbol and raw_price:
        needles.append(raw_price.lower().replace(symbol, "").strip())
    context = first_context(lowered, [n for n in needles if n]) if needles else lowered[:6000]

    ordered = [
        ("seat", ["per seat", "/seat"]),
        ("user", ["per user", "/user"]),
        ("month", ["/mo", "/month", "per month", "monthly"]),
        ("year", ["/yr", "/year", "per year", "annually", "annual"]),
        ("hour", ["/hour", "per hour"]),
        ("day", ["/day", "per day"]),
        ("request", ["per request", "/request"]),
        ("token", ["per token", "/token", "1m tokens", "million tokens"]),
        ("credit", ["credit pack", "credits per", "credits/month"]),
        ("email", ["per email", "/email", "per 1,000 emails"]),
        ("gb", ["per gb", "/gb"]),
        ("project", ["per project"]),
        ("workspace", ["per workspace"]),
    ]
    for unit, phrases in ordered:
        if any(phrase in context for phrase in phrases):
            return unit

    model = row.get("pricing_model", "")
    if model == "seat_based":
        return "seat"
    if model == "tiered" and raw_price not in {"0", "$0", "€0", "£0"}:
        return "month"
    return ""


def infer_source_and_confidence(row: Dict[str, str], page_text: str, raw_price: str) -> (str, str, str):
    lowered = page_text.lower()
    raw = raw_price.lower().strip()
    if raw in {"0", "$0", "€0", "£0"} and row.get("free_tier") == "yes":
        return "free_tier_inferred", "medium", "free tier detected on pricing page"

    explicit_markers = ["starting at", "starts at", "plans start at", "from $", "from €", "from £"]
    near = first_context(lowered, [raw]) if raw else lowered[:4000]
    if raw and any(marker in near for marker in explicit_markers):
        return "explicit_phrase", "high", "price phrase matched on official pricing page"
    if raw and any(marker in lowered for marker in explicit_markers):
        return "explicit_phrase", "medium", "explicit pricing language found on official pricing page"
    if raw:
        return "page_parse", "low", "price present but explicit entry phrase not confirmed"
    return "", "", ""


async def enrich_row(row: Dict[str, str], fetcher: Fetcher) -> Dict[str, str]:
    row = dict(row)
    for field in NEW_FIELDS:
        row.setdefault(field, "")

    pricing_url = row.get("pricing_url", "")
    page = await fetcher.get(pricing_url) if pricing_url else None
    page_text = page.text if page else ""
    raw_price = row.get("starting_price", "") or ""
    symbol = extract_symbol(raw_price)
    amount = parse_amount(raw_price)
    currency = infer_currency(page_text, symbol) if raw_price else ""
    unit = infer_unit(row, page_text, symbol, raw_price) if raw_price else ""
    source, confidence, notes = infer_source_and_confidence(row, page_text, raw_price) if raw_price else ("", "", "")

    if not raw_price:
        notes = ""
        if row.get("pricing_model") == "contact_sales":
            notes = "contact sales or non-public pricing"
        elif row.get("pricing_url"):
            notes = "pricing page found but entry price not extracted"
        confidence = "low" if row.get("pricing_url") else ""

    row.update(
        {
            "starting_price_amount": amount or "",
            "starting_price_currency": currency,
            "starting_price_currency_symbol": symbol,
            "starting_price_unit": unit,
            "starting_price_source": source,
            "pricing_confidence": confidence,
            "pricing_notes": notes,
            "pricing_normalized_at": TODAY if row.get("pricing_url") else "",
        }
    )
    return row


async def run(path: Path, limit: int = 0) -> None:
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    fieldnames = list(rows[0].keys())
    for field in NEW_FIELDS:
        if field not in fieldnames:
            fieldnames.append(field)

    target = rows[:limit] if limit else rows
    fetcher = Fetcher()
    try:
        enriched = await asyncio.gather(*(enrich_row(r, fetcher) for r in target))
    finally:
        await fetcher.close()

    if limit:
        rows[:limit] = enriched
    else:
        rows = enriched

    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "rows": len(rows),
        "starting_price_amount": sum(1 for r in rows if r.get("starting_price_amount")),
        "starting_price_currency": sum(1 for r in rows if r.get("starting_price_currency")),
        "starting_price_unit": sum(1 for r in rows if r.get("starting_price_unit")),
        "pricing_confidence": {k: sum(1 for r in rows if r.get("pricing_confidence") == k) for k in ["high", "medium", "low"]},
    }
    print(summary)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default=str(PROJECT_ROOT / "data/providers_seed.csv"))
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    asyncio.run(run(Path(args.csv), args.limit))


if __name__ == "__main__":
    main()
