#!/usr/bin/env python3

import argparse
import asyncio
import csv
import re
from datetime import datetime
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from zoneinfo import ZoneInfo
from urllib.parse import urljoin, urlparse

import httpx


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TODAY = datetime.now(ZoneInfo("Australia/Brisbane")).date().isoformat()

NEW_FIELDS = [
    "pricing_url",
    "docs_url",
    "signup_url",
    "pricing_model",
    "starting_price",
    "free_tier",
    "free_trial",
    "contact_sales_only",
    "deployment_model",
    "open_source",
    "api_available",
    "cli_available",
    "mcp_available",
    "setup_friction",
    "target_customer",
    "program_url",
    "program_type",
    "commission_model",
    "user_discount_available",
    "last_pricing_checked",
    "last_program_checked",
]

PRESERVE_FIELDS = [
    "starting_price_amount",
    "starting_price_currency",
    "starting_price_currency_symbol",
    "starting_price_unit",
    "starting_price_source",
    "pricing_confidence",
    "pricing_notes",
    "pricing_normalized_at",
]

BOOLEAN_PRESERVE_FIELDS = [
    "free_tier",
    "free_trial",
    "contact_sales_only",
    "open_source",
    "api_available",
    "cli_available",
    "mcp_available",
    "user_discount_available",
]

BASE_FIELDS = [
    "slug",
    "name",
    "category",
    "subcategory",
    "website",
    "use_case",
    "self_serve",
    "affiliate_status",
    "referral_status",
    "other_programs",
    "program_notes",
    "source_url",
    "research_status",
    "last_verified",
]

FIELDNAMES = BASE_FIELDS + NEW_FIELDS + PRESERVE_FIELDS

COMMON_PATHS = {
    "pricing": ["/pricing", "/plans"],
    "docs": ["/docs", "/documentation", "/developers", "/developer", "/reference"],
    "signup": ["/signup", "/sign-up", "/register", "/start", "/get-started", "/start-free"],
    "program": ["/affiliate", "/affiliates", "/referral", "/referrals", "/partners", "/partner", "/startup", "/startups", "/ambassador", "/creator"],
}

TEXT_MAX = 250_000


def compact_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def truthy_unknown() -> str:
    return "unknown"


def hostname_root(url: str) -> str:
    host = urlparse(url).hostname or ""
    parts = host.split(".")
    if len(parts) <= 2:
        return host
    special_suffixes = {
        ("co", "uk"),
        ("com", "au"),
        ("co", "jp"),
        ("co", "nz"),
    }
    if tuple(parts[-2:]) in special_suffixes and len(parts) >= 3:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def same_brand(base_url: str, candidate_url: str) -> bool:
    base_host = hostname_root(base_url)
    candidate_host = hostname_root(candidate_url)
    return bool(base_host and candidate_host and base_host == candidate_host)


class AnchorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: List[Dict[str, str]] = []
        self._current_href: Optional[str] = None
        self._current_text: List[str] = []
        self._ignore_depth = 0
        self._text_parts: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        if tag in {"script", "style", "noscript"}:
            self._ignore_depth += 1
            return
        if tag == "a":
            attr_map = dict(attrs)
            self._current_href = attr_map.get("href")
            self._current_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"} and self._ignore_depth:
            self._ignore_depth -= 1
            return
        if tag == "a" and self._current_href:
            self.links.append(
                {
                    "href": self._current_href,
                    "text": compact_space("".join(self._current_text)),
                }
            )
            self._current_href = None
            self._current_text = []

    def handle_data(self, data: str) -> None:
        if self._ignore_depth:
            return
        if self._current_href is not None:
            self._current_text.append(data)
        self._text_parts.append(data)

    @property
    def text(self) -> str:
        return compact_space(" ".join(self._text_parts))[:TEXT_MAX]


@dataclass
class PageData:
    url: str
    text: str
    links: List[Dict[str, str]]


class SiteScanner:
    def __init__(self, concurrency: int = 16, timeout: float = 12.0) -> None:
        self._sem = asyncio.Semaphore(concurrency)
        self._client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; ReferiateBot/1.0; +https://example.com/bot)",
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        self._cache: Dict[str, Optional[PageData]] = {}

    async def close(self) -> None:
        await self._client.aclose()

    async def fetch(self, url: str) -> Optional[PageData]:
        if not url or not url.startswith(("http://", "https://")):
            return None
        if url in self._cache:
            return self._cache[url]
        async with self._sem:
            try:
                resp = await self._client.get(url)
                ctype = resp.headers.get("content-type", "")
                if "html" not in ctype and "text" not in ctype:
                    self._cache[url] = None
                    return None
                parser = AnchorParser()
                parser.feed(resp.text)
                page = PageData(
                    url=str(resp.url),
                    text=parser.text,
                    links=[
                        {
                            "href": urljoin(str(resp.url), link["href"]),
                            "text": link["text"],
                        }
                        for link in parser.links
                        if link.get("href")
                        and not link["href"].startswith(("mailto:", "tel:", "javascript:", "#"))
                    ],
                )
                self._cache[url] = page
                return page
            except Exception:
                self._cache[url] = None
                return None

    async def find_candidate(self, base_url: str, kind: str, homepage: Optional[PageData]) -> Optional[str]:
        keywords = {
            "pricing": ("pricing", "plans", "plan", "billing", "cost"),
            "docs": ("docs", "documentation", "developer", "developers", "reference", "api"),
            "signup": ("sign up", "signup", "register", "create account", "start free", "free trial"),
            "program": ("affiliate", "referral", "partner", "partners", "startup", "ambassador", "creator", "insiders"),
        }[kind]
        excludes = {
            "pricing": ("docs", "blog"),
            "docs": ("pricing", "careers"),
            "signup": ("login", "log in", "sign in", "book demo", "contact sales", "#"),
            "program": ("careers", "blog"),
        }[kind]

        if homepage:
            scored: List[Tuple[int, str]] = []
            for link in homepage.links:
                href = link["href"]
                text = (link.get("text") or "").lower()
                href_l = href.lower()
                if not same_brand(base_url, href):
                    continue
                if any(ex in text or ex in href_l for ex in excludes):
                    continue
                score = 0
                for kw in keywords:
                    if kw in text:
                        score += 4
                    if kw.replace(" ", "") in href_l or kw.replace(" ", "-") in href_l or kw in href_l:
                        score += 3
                if score:
                    scored.append((score, href))
            if scored:
                scored.sort(key=lambda item: (-item[0], len(item[1])))
                return scored[0][1]

        if kind == "program":
            return None

        for path in COMMON_PATHS[kind]:
            candidate = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
            page = await self.fetch(candidate)
            if not page or not same_brand(base_url, page.url):
                continue
            lowered = f"{page.url.lower()} {page.text[:4000].lower()}"
            if any(kw.replace(" ", "") in lowered or kw.replace(" ", "-") in lowered or kw in lowered for kw in keywords):
                return page.url
        return None


def contains_any(text: str, phrases: Iterable[str]) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in phrases)


def infer_pricing_model(text: str) -> str:
    lowered = text.lower()
    if any(phrase in lowered for phrase in ["usage-based", "usage based", "pay as you go", "per request", "per token", "consumption"]):
        return "usage_based"
    if any(phrase in lowered for phrase in ["per seat", "per user", "seat-based", "seat based"]):
        return "seat_based"
    if "contact sales" in lowered and not re.search(r"[$€£]\s?\d", lowered):
        return "contact_sales"
    if any(phrase in lowered for phrase in ["starter", "pro", "business", "enterprise"]) and re.search(r"[$€£]\s?\d", lowered):
        return "tiered"
    return ""


def infer_starting_price(text: str, free_tier: str) -> str:
    lowered = text.lower()
    patterns = [r"(?:starting at|starts at|plans start at)\s*([$€£]\s?\d+(?:[.,]\d{1,2})?)"]
    for pattern in patterns:
        match = re.search(pattern, lowered)
        if match:
            return match.group(1).replace(" ", "")
    if free_tier == "yes":
        return "0"
    return ""


def derive_setup_friction(self_serve: str, signup_url: str, pricing_url: str, docs_url: str, contact_sales_only: str) -> str:
    if contact_sales_only == "yes":
        return "high"
    if self_serve == "yes" and signup_url and (pricing_url or docs_url):
        return "low"
    if self_serve == "yes":
        return "medium"
    if self_serve == "mixed" and (signup_url or pricing_url or docs_url):
        return "medium"
    return "high"


def merge_program_types(row: Dict[str, str], page_text: str, program_url: str) -> str:
    values = set()
    if row.get("affiliate_status") == "available":
        values.add("affiliate")
    if row.get("referral_status") == "available":
        values.add("referral")
    for token in (row.get("other_programs") or "").split("+"):
        token = token.strip()
        if token and token != "unknown" and token != "none":
            values.add(token)
    lowered = f"{program_url.lower()} {(row.get('source_url') or '').lower()}"
    for token in ["affiliate", "referral", "partner", "creator", "ambassador", "startup", "open_source", "insiders"]:
        probe = token.replace("_", " ")
        if probe in lowered or token in lowered:
            values.add(token)
    return "+".join(sorted(values))


def infer_commission_model(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in ["credit", "credits", "referral credit"]):
        return "credits"
    if any(token in lowered for token in ["discount", "coupon", "promo code", "save "]):
        return "discount"
    if "%" in lowered and any(token in lowered for token in ["commission", "revshare", "revenue share", "recurring"]):
        return "percentage_commission"
    if re.search(r"[$€£]\s?\d", lowered) and any(token in lowered for token in ["commission", "bounty", "payout", "reward"]):
        return "flat_bounty"
    return ""


def infer_target_customer(text: str) -> str:
    lowered = text.lower()
    has_enterprise = "enterprise" in lowered
    has_startup = "startup" in lowered or "startups" in lowered
    has_dev = "developer" in lowered or "developers" in lowered or "indie" in lowered
    has_team = "team" in lowered or "teams" in lowered or "businesses" in lowered
    kinds = [name for name, present in [("enterprise", has_enterprise), ("startup", has_startup), ("developer", has_dev), ("teams", has_team)] if present]
    if len(kinds) > 1:
        return "mixed"
    return kinds[0] if kinds else ""


def detect_open_source(text: str) -> str:
    lowered = text.lower()
    strong_phrases = [
        "open-source platform",
        "open source platform",
        "open-source alternative",
        "open source alternative",
        "self-hosted and open-source",
        "self-hosted and open source",
        "open-source project",
        "open source project",
    ]
    support_phrases = ["github", "mit license", "apache 2.0", "self-hosted", "self hosted"]
    if any(phrase in lowered for phrase in strong_phrases) and any(phrase in lowered for phrase in support_phrases):
        return "yes"
    return truthy_unknown()


def detect_mcp(text: str) -> str:
    lowered = text.lower()
    if "model context protocol" in lowered or "mcp server" in lowered or "mcp client" in lowered:
        return "yes"
    return truthy_unknown()


def detect_user_discount(program_text: str) -> str:
    lowered = program_text.lower()
    explicit = [
        "friend gets",
        "referred user gets",
        "new customer gets",
        "referral credit",
        "referred customer",
        "discount for referred",
        "credit for referred",
        "your invitee",
    ]
    if any(phrase in lowered for phrase in explicit):
        return "yes"
    return truthy_unknown()


async def enrich_row(row: Dict[str, str], scanner: SiteScanner) -> Dict[str, str]:
    row = dict(row)
    for field in NEW_FIELDS:
        row.setdefault(field, "")

    homepage = await scanner.fetch(row["website"])
    pricing_url = await scanner.find_candidate(row["website"], "pricing", homepage)
    docs_url = await scanner.find_candidate(row["website"], "docs", homepage)
    signup_url = await scanner.find_candidate(row["website"], "signup", homepage)
    detected_program_url = await scanner.find_candidate(row["website"], "program", homepage)

    pricing_page = await scanner.fetch(pricing_url) if pricing_url else None
    docs_page = await scanner.fetch(docs_url) if docs_url else None
    signup_page = await scanner.fetch(signup_url) if signup_url else None

    program_url = row.get("source_url") or detected_program_url or ""
    program_page = await scanner.fetch(program_url) if program_url else None

    homepage_text = homepage.text if homepage else ""
    pricing_text = pricing_page.text if pricing_page else homepage_text[:50_000]
    docs_text = docs_page.text if docs_page else ""
    signup_text = signup_page.text if signup_page else ""
    program_text = " ".join(filter(None, [row.get("program_notes", ""), program_page.text if program_page else "", homepage_text[:20_000]]))
    combined_text = " ".join(filter(None, [homepage_text, pricing_text, docs_text, signup_text]))

    free_tier = "yes" if contains_any(pricing_text, ["free tier", "free plan", "free forever", "get started for free", "start for free", "free account"]) else truthy_unknown()
    free_trial = "yes" if contains_any(pricing_text, ["free trial", "try free", "14-day trial", "30-day trial", "start free trial"]) else truthy_unknown()

    has_public_price = bool(re.search(r"[$€£]\s?\d", pricing_text))
    has_contact_sales = contains_any(pricing_text, ["contact sales", "talk to sales", "book demo", "request pricing"])
    contact_sales_only = "yes" if has_contact_sales and not has_public_price and free_tier != "yes" and free_trial != "yes" else ("no" if has_public_price or free_tier == "yes" or free_trial == "yes" else truthy_unknown())

    deployment_model = ""
    lowered_combined = combined_text.lower()
    if any(token in lowered_combined for token in ["self-hosted", "self hosted", "on-prem", "on premise"]):
        deployment_model = "hybrid" if any(token in lowered_combined for token in ["cloud", "managed", "hosted"]) else "self_hosted"
    elif detect_open_source(combined_text) == "yes" and any(token in lowered_combined for token in ["cloud", "managed"]):
        deployment_model = "hybrid"
    elif signup_url or pricing_url:
        deployment_model = "hosted"

    open_source = detect_open_source(combined_text)
    api_available = "yes" if contains_any(combined_text, [" api ", "apis", "developer api", "rest api", "graphql", "sdk", "endpoint"]) else truthy_unknown()
    cli_available = "yes" if contains_any(combined_text, [" cli ", "command line", "brew install", "npm install", "curl | sh", "install the cli"]) else truthy_unknown()
    mcp_probe_text = docs_text if docs_text else homepage_text
    mcp_available = detect_mcp(mcp_probe_text)

    pricing_model = infer_pricing_model(pricing_text)
    starting_price = infer_starting_price(pricing_text, free_tier)
    setup_friction = derive_setup_friction(row.get("self_serve", ""), signup_url or "", pricing_url or "", docs_url or "", contact_sales_only)
    target_customer = infer_target_customer(combined_text)

    program_type = merge_program_types(row, program_text, program_url or "")
    commission_model = infer_commission_model(program_text) if ("affiliate" in program_type or "referral" in program_type) else ""
    user_discount_available = detect_user_discount(program_text) if ("affiliate" in program_type or "referral" in program_type) else truthy_unknown()

    updates = {
        "pricing_url": pricing_url or "",
        "docs_url": docs_url or "",
        "signup_url": signup_url or "",
        "pricing_model": pricing_model,
        "starting_price": starting_price,
        "free_tier": free_tier,
        "free_trial": free_trial,
        "contact_sales_only": contact_sales_only,
        "deployment_model": deployment_model,
        "open_source": open_source,
        "api_available": api_available,
        "cli_available": cli_available,
        "mcp_available": mcp_available,
        "setup_friction": setup_friction,
        "target_customer": target_customer,
        "program_url": program_url,
        "program_type": program_type,
        "commission_model": commission_model,
        "user_discount_available": user_discount_available,
        "last_pricing_checked": TODAY if homepage else "",
        "last_program_checked": TODAY if (homepage or program_page) else "",
    }
    for field in BOOLEAN_PRESERVE_FIELDS:
        if row.get(field) in {"yes", "no"} and updates.get(field) == "unknown":
            updates[field] = row[field]
    row.update(updates)
    return row


async def run(path: Path, limit: int = 0) -> None:
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys()) if rows else list(FIELDNAMES)
    for field in FIELDNAMES:
        if field not in fieldnames:
            fieldnames.append(field)

    target_rows = rows[:limit] if limit else rows
    scanner = SiteScanner()
    try:
        enriched = await asyncio.gather(*(enrich_row(row, scanner) for row in target_rows))
    finally:
        await scanner.close()

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
        "pricing_url": sum(1 for row in rows if row.get("pricing_url")),
        "docs_url": sum(1 for row in rows if row.get("docs_url")),
        "signup_url": sum(1 for row in rows if row.get("signup_url")),
        "program_url": sum(1 for row in rows if row.get("program_url")),
        "mcp_available_yes": sum(1 for row in rows if row.get("mcp_available") == "yes"),
        "api_available_yes": sum(1 for row in rows if row.get("api_available") == "yes"),
        "cli_available_yes": sum(1 for row in rows if row.get("cli_available") == "yes"),
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
