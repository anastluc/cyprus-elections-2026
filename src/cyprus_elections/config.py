from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = PROJECT_ROOT / "config"


class PartyConfig(BaseModel):
    code: str
    name_gr: str
    name_en: str
    website: str | None = None
    scraper: str
    enabled: bool = True
    seed_urls: list[str] = Field(default_factory=list)
    js_render: bool = False  # Fetch seed_urls with a headless browser (Playwright).


class DistrictConfig(BaseModel):
    code: str
    name_gr: str
    name_en: str
    seats: int


class FetchConfig(BaseModel):
    timeout_seconds: int = 30
    max_retries: int = 3
    per_host_rate_limit_per_second: float = 1.0
    user_agent: str = "cyprus-elections-research/0.1"
    cache_ttl_days: int = 7


class LLMConfig(BaseModel):
    provider: str = "openrouter"
    base_url: str = "https://openrouter.ai/api/v1"
    model_env: str = "OPENROUTER_MODEL"
    api_key_env: str = "OPENROUTER_API_KEY"
    search_model_env: str = "OPENROUTER_SEARCH_MODEL"
    temperature: float = 0.0
    max_calls_per_run: int = 500
    cache_dir: str = "data/raw/enrichment/llm"


class LinkedInConfig(BaseModel):
    enabled: bool = True
    per_host_rate_limit_per_second: float = 0.1
    max_profiles_per_run: int = 200


class ConfidenceConfig(BaseModel):
    source_trust: dict[str, float]
    agreement_boost_step: float = 0.05
    row_weights: dict[str, float]
    low_confidence_threshold: float = 0.6


class AirtableConfig(BaseModel):
    enabled: bool = True
    table_candidates_env: str = "AIRTABLE_TABLE_CANDIDATES"
    table_fields_env: str = "AIRTABLE_TABLE_FIELDS"


class GoogleSheetsConfig(BaseModel):
    enabled: bool = False
    sheet_id: str = ""
    candidates_tab: str = "Candidates"
    service_account_env: str = "GOOGLE_SERVICE_ACCOUNT_JSON"


class PathsConfig(BaseModel):
    raw: str = "data/raw"
    processed: str = "data/processed"
    exports: str = "data/exports"


class DatabaseConfig(BaseModel):
    path: str = "data/candidates.db"


class AppConfig(BaseModel):
    database: DatabaseConfig
    paths: PathsConfig
    fetch: FetchConfig
    llm: LLMConfig
    linkedin: LinkedInConfig
    confidence: ConfidenceConfig
    airtable: AirtableConfig
    google_sheets: GoogleSheetsConfig = Field(default_factory=GoogleSheetsConfig)

    parties: list[PartyConfig] = Field(default_factory=list)
    districts: list[DistrictConfig] = Field(default_factory=list)
    district_aliases: dict[str, str] = Field(default_factory=dict)

    # Resolved paths (absolute)
    root: Path
    db_path: Path
    raw_dir: Path
    processed_dir: Path
    exports_dir: Path

    def env(self, name: str, default: str = "") -> str:
        return os.environ.get(name, default)

    def openrouter_key(self) -> str | None:
        return os.environ.get(self.llm.api_key_env) or None

    def openrouter_model(self) -> str:
        return os.environ.get(self.llm.model_env, "anthropic/claude-sonnet-4.6")

    def openrouter_search_model(self) -> str | None:
        return os.environ.get(self.llm.search_model_env) or None

    def party_by_code(self, code: str) -> PartyConfig | None:
        return next((p for p in self.parties if p.code == code), None)

    def district_code(self, raw: str) -> str | None:
        raw = (raw or "").strip()
        if not raw:
            return None
        if raw in {d.code for d in self.districts}:
            return raw
        return self.district_aliases.get(raw)


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


@lru_cache(maxsize=1)
def load_config() -> AppConfig:
    load_dotenv(PROJECT_ROOT / ".env", override=False)

    main = _load_yaml(CONFIG_DIR / "config.yaml")
    parties = _load_yaml(CONFIG_DIR / "parties.yaml").get("parties", [])
    districts_doc = _load_yaml(CONFIG_DIR / "districts.yaml")

    raw_dir = (PROJECT_ROOT / main["paths"]["raw"]).resolve()
    processed_dir = (PROJECT_ROOT / main["paths"]["processed"]).resolve()
    exports_dir = (PROJECT_ROOT / main["paths"]["exports"]).resolve()
    db_path = (PROJECT_ROOT / main["database"]["path"]).resolve()

    for d in (raw_dir, processed_dir, exports_dir, db_path.parent):
        d.mkdir(parents=True, exist_ok=True)

    return AppConfig(
        database=DatabaseConfig(**main["database"]),
        paths=PathsConfig(**main["paths"]),
        fetch=FetchConfig(**main["fetch"]),
        llm=LLMConfig(**main["llm"]),
        linkedin=LinkedInConfig(**main["linkedin"]),
        confidence=ConfidenceConfig(**main["confidence"]),
        airtable=AirtableConfig(**main["airtable"]),
        google_sheets=GoogleSheetsConfig(**main.get("google_sheets", {})),
        parties=[PartyConfig(**p) for p in parties],
        districts=[DistrictConfig(**d) for d in districts_doc.get("districts", [])],
        district_aliases=districts_doc.get("aliases", {}),
        root=PROJECT_ROOT,
        db_path=db_path,
        raw_dir=raw_dir,
        processed_dir=processed_dir,
        exports_dir=exports_dir,
    )
