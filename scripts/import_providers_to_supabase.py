#!/usr/bin/env python3

import argparse
import csv
import json
import os
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from urllib import error, parse, request


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = PROJECT_ROOT / "data/providers_seed.csv"
DEFAULT_PLANS_JSON = PROJECT_ROOT / "data/provider_plans_seed.json"
DEFAULT_TABLE = "providers"
DEFAULT_CHUNK_SIZE = 100
SAMPLE_PROFILE_ID = "11111111-1111-4111-8111-111111111111"
SAMPLE_ENTRY_ID = "22222222-2222-4222-8222-222222222222"
LOCAL_SUPABASE_URL = "http://127.0.0.1:54321"

CSV_FIELDS = [
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
    "starting_price_amount",
    "starting_price_currency",
    "starting_price_currency_symbol",
    "starting_price_unit",
    "starting_price_source",
    "pricing_confidence",
    "pricing_notes",
    "pricing_normalized_at",
]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

ENUM_ALLOWED_VALUES = {
    "pricing_model": {"usage_based", "seat_based", "tiered", "contact_sales"},
    "deployment_model": {"hosted", "self_hosted", "hybrid"},
    "setup_friction": {"low", "medium", "high"},
    "pricing_confidence": {"high", "medium", "low"},
}

PLAN_FIELDS = [
    "provider_slug",
    "slug",
    "name",
    "summary",
    "price_label",
    "price_amount",
    "currency",
    "billing_period",
    "plan_type",
    "best_for_tags",
    "official_url",
    "source_url",
    "sort_order",
    "trial_available",
    "contact_sales_only",
    "last_checked",
]

PLAN_ENUM_ALLOWED_VALUES = {
    "billing_period": {"month", "year", "usage", "custom"},
    "plan_type": {"free", "paid", "enterprise"},
}


def env(name: str, fallback: str = "") -> str:
    return os.environ.get(name, fallback).strip()


def normalize_cell(value: str) -> Optional[str]:
    value = (value or "").strip()
    return value or None


def parse_amount(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    cleaned = re.sub(r"[^0-9.,-]", "", value)
    if not cleaned:
        return None
    if cleaned.count(",") and cleaned.count("."):
        cleaned = cleaned.replace(",", "")
    elif cleaned.count(",") and not cleaned.count("."):
        cleaned = cleaned.replace(",", "")
    try:
        amount = Decimal(cleaned)
    except InvalidOperation:
        return None
    if amount == amount.to_integral():
        return int(amount)
    return float(amount)


def parse_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def load_rows(path: Path) -> List[Dict[str, object]]:
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows: List[Dict[str, object]] = []
        for raw_row in reader:
            row: Dict[str, object] = {field: normalize_cell(raw_row.get(field, "")) for field in CSV_FIELDS}
            row["starting_price_amount"] = parse_amount(raw_row.get("starting_price_amount"))
            for field, allowed in ENUM_ALLOWED_VALUES.items():
                value = row.get(field)
                if value not in allowed:
                    row[field] = None
            row["source_row"] = {k: (v.strip() if isinstance(v, str) else v) for k, v in raw_row.items()}
            rows.append(row)
    return rows


def load_plan_rows(path: Path) -> List[Dict[str, object]]:
    if not path.exists():
        return []

    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError(f"plan seed file must be a JSON array: {path}")

    rows: List[Dict[str, object]] = []
    for raw_row in payload:
        if not isinstance(raw_row, dict):
            continue
        row: Dict[str, object] = {field: raw_row.get(field) for field in PLAN_FIELDS}
        row["provider_slug"] = normalize_cell(str(raw_row.get("provider_slug", "")))
        row["slug"] = normalize_cell(str(raw_row.get("slug", "")))
        row["name"] = normalize_cell(str(raw_row.get("name", "")))
        row["summary"] = normalize_cell(str(raw_row.get("summary", "")))
        row["price_label"] = normalize_cell(str(raw_row.get("price_label", "")))
        row["price_amount"] = parse_amount(str(raw_row.get("price_amount", ""))) if raw_row.get("price_amount") is not None else None
        row["currency"] = normalize_cell(str(raw_row.get("currency", "")))
        row["billing_period"] = normalize_cell(str(raw_row.get("billing_period", "")))
        row["plan_type"] = normalize_cell(str(raw_row.get("plan_type", "")))
        row["best_for_tags"] = raw_row.get("best_for_tags") if isinstance(raw_row.get("best_for_tags"), list) else []
        row["official_url"] = normalize_cell(str(raw_row.get("official_url", "")))
        row["source_url"] = normalize_cell(str(raw_row.get("source_url", "")))
        row["sort_order"] = int(raw_row.get("sort_order", 100))
        row["trial_available"] = parse_bool(raw_row.get("trial_available"))
        row["contact_sales_only"] = parse_bool(raw_row.get("contact_sales_only"))
        row["last_checked"] = normalize_cell(str(raw_row.get("last_checked", "")))

        for field, allowed in PLAN_ENUM_ALLOWED_VALUES.items():
            value = row.get(field)
            if value not in allowed:
                row[field] = None

        rows.append(row)

    return rows


def chunked(items: List[Dict[str, object]], size: int) -> Iterable[List[Dict[str, object]]]:
    for index in range(0, len(items), size):
        yield items[index:index + size]


def upsert_batch(
    base_url: str,
    table: str,
    api_key: str,
    rows: List[Dict[str, object]],
    timeout: int,
    on_conflict: str = "slug",
) -> None:
    endpoint = f"{base_url.rstrip('/')}/rest/v1/{parse.quote(table)}"
    query = parse.urlencode({"on_conflict": on_conflict})
    url = f"{endpoint}?{query}"
    body = json.dumps(rows).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            if resp.status not in (200, 201, 204):
                raise RuntimeError(f"unexpected status {resp.status}")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"supabase upsert failed: {exc.code} {exc.reason}: {detail}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"supabase request failed: {exc.reason}") from exc


def fetch_single(base_url: str, table: str, api_key: str, filters: Dict[str, str], columns: str = "*", timeout: int = 30) -> Optional[Dict[str, object]]:
    endpoint = f"{base_url.rstrip('/')}/rest/v1/{parse.quote(table)}"
    query_params = {"select": columns, "limit": "1"}
    query_params.update(filters)
    url = f"{endpoint}?{parse.urlencode(query_params)}"
    req = request.Request(
        url,
        headers={
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        },
    )
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
            if isinstance(payload, list) and payload:
                return payload[0]
            return None
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"supabase fetch failed: {exc.code} {exc.reason}: {detail}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"supabase request failed: {exc.reason}") from exc


def fetch_rows(base_url: str, table: str, api_key: str, columns: str = "*", timeout: int = 30) -> List[Dict[str, object]]:
    endpoint = f"{base_url.rstrip('/')}/rest/v1/{parse.quote(table)}"
    results: List[Dict[str, object]] = []
    page_size = 1000
    offset = 0

    while True:
        url = f"{endpoint}?{parse.urlencode({'select': columns, 'limit': str(page_size), 'offset': str(offset)})}"
        req = request.Request(
            url,
            headers={
                "apikey": api_key,
                "Authorization": f"Bearer {api_key}",
                "Accept": "application/json",
            },
        )
        try:
            with request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                if not isinstance(payload, list):
                    return results
                results.extend(payload)
                if len(payload) < page_size:
                    return results
                offset += page_size
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"supabase fetch failed: {exc.code} {exc.reason}: {detail}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"supabase request failed: {exc.reason}") from exc


def seed_provider_plans(base_url: str, read_api_key: str, write_api_key: str, timeout: int, path: Path) -> int:
    plan_rows = load_plan_rows(path)
    if not plan_rows:
        return 0

    providers = fetch_rows(base_url, "providers", read_api_key, columns="id,slug", timeout=timeout)
    provider_id_by_slug = {
        str(row.get("slug", "")).strip().lower(): row.get("id")
        for row in providers
        if row.get("id") and row.get("slug")
    }

    resolved_rows: List[Dict[str, object]] = []
    for row in plan_rows:
        provider_slug = str(row.get("provider_slug") or "").strip().lower()
        provider_id = provider_id_by_slug.get(provider_slug)
        if not provider_id:
            raise RuntimeError(f"plan seed failed: provider slug `{provider_slug}` was not found")

        resolved_rows.append(
            {
                "provider_id": provider_id,
                "slug": row.get("slug"),
                "name": row.get("name"),
                "summary": row.get("summary"),
                "price_label": row.get("price_label"),
                "price_amount": row.get("price_amount"),
                "currency": row.get("currency") or "USD",
                "billing_period": row.get("billing_period") or "month",
                "plan_type": row.get("plan_type"),
                "best_for_tags": row.get("best_for_tags") or [],
                "official_url": row.get("official_url"),
                "source_url": row.get("source_url"),
                "sort_order": row.get("sort_order") or 100,
                "trial_available": row.get("trial_available") or False,
                "contact_sales_only": row.get("contact_sales_only") or False,
                "last_checked": row.get("last_checked"),
            }
        )

    for batch in chunked(resolved_rows, DEFAULT_CHUNK_SIZE):
        upsert_batch(base_url, "provider_plans", write_api_key, batch, timeout, on_conflict="provider_id,slug")

    return len(resolved_rows)


def seed_sample_referral_profile(base_url: str, read_api_key: str, write_api_key: str, timeout: int) -> None:
    provider = fetch_single(
        base_url,
        "providers",
        read_api_key,
        {"slug": "eq.vercel"},
        columns="id,slug,name,website",
        timeout=timeout,
    )

    if not provider:
        raise RuntimeError("sample seed failed: provider slug `vercel` was not found")

    upsert_batch(
        base_url,
        "referral_profiles",
        write_api_key,
        [
            {
                "id": SAMPLE_PROFILE_ID,
                "slug": "sample-operator",
                "display_name": "Sample Operator",
                "bio": "Public contributor profile used for local Nullcost routing and ownership testing.",
                "website": "https://nullcost.local/profiles/sample-operator",
                "status": "active",
                "metadata": {"seeded": True, "kind": "demo_profile"},
            }
        ],
        timeout,
        on_conflict="id",
    )

    upsert_batch(
        base_url,
        "referral_entries",
        write_api_key,
        [
            {
                "id": SAMPLE_ENTRY_ID,
                "provider_id": provider["id"],
                "profile_id": SAMPLE_PROFILE_ID,
                "status": "active",
                "kind": "referral_link",
                "title": "Sample operator route",
                "destination_url": provider.get("website") or "https://vercel.com/",
                "referral_code": "SAMPLE10",
                "disclosure": "Seeded local demo route for Nullcost profile and router testing.",
                "weight": 1,
                "selection_count": 0,
                "click_count": 0,
                "metadata": {"seeded": True, "kind": "demo_entry"},
            }
        ],
        timeout,
        on_conflict="id",
    )


def main() -> int:
    load_env_file(PROJECT_ROOT / ".env.local")

    parser = argparse.ArgumentParser(description="Import providers_seed.csv into Supabase.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--table", default=DEFAULT_TABLE)
    parser.add_argument("--plans-json", type=Path, default=DEFAULT_PLANS_JSON)
    parser.add_argument("--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE)
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    rows = load_rows(args.csv)
    print(f"Loaded {len(rows)} provider rows from {args.csv}")

    if args.dry_run:
        print("Dry run only; no rows were written.")
        return 0

    supabase_url = env("SUPABASE_URL", LOCAL_SUPABASE_URL)
    supabase_key = env("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_read_key = env("SUPABASE_ANON_KEY", env("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""))
    if not supabase_url or not supabase_key or not supabase_read_key:
        print(
            "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY before importing.",
            file=sys.stderr,
        )
        return 2

    written = 0
    for batch in chunked(rows, max(1, args.chunk_size)):
        upsert_batch(supabase_url, args.table, supabase_key, batch, args.timeout)
        written += len(batch)
        print(f"Upserted {written}/{len(rows)} rows")

    seeded_plan_count = seed_provider_plans(
        supabase_url,
        supabase_read_key,
        supabase_key,
        args.timeout,
        args.plans_json,
    )
    if seeded_plan_count:
        print(f"Upserted {seeded_plan_count} provider plans")

    seed_sample_referral_profile(supabase_url, supabase_read_key, supabase_key, args.timeout)
    print("Seeded sample referral profile and entry")
    print(f"Finished importing {written} rows into {args.table}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
