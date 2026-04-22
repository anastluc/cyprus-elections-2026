from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

CandidateField = Literal[
    "name_gr",
    "name_en",
    "party",
    "district",
    "gender",
    "age",
    "date_of_birth",
    "education",
    "career_previous",
    "profession",
    "sector",
    "cv_text",
    "cv_url",
    "facebook",
    "twitter",
    "instagram",
    "linkedin",
    "website",
    "wikipedia",
    "wikidata_qid",
    "photo_url",
    "profession_cluster",
    "highlights",
]

SourceKind = Literal[
    "official",
    "party_site",
    "news",
    "wikipedia",
    "wikidata",
    "linkedin",
    "linkedin_snippet",
    "search_snippet",
    "llm_from_bio",
    "heuristic",
    "cv_doc",
    "historical_moi",
    "historical_wiki",
]


class RawCandidate(BaseModel):
    """What a scraper yields for one candidate appearance in one source."""

    source_kind: SourceKind
    source_url: str
    party_code: str
    district_code: str | None = None
    name_gr: str | None = None
    name_en: str | None = None
    fields: dict[str, Any] = Field(default_factory=dict)
    bio_text: str | None = None
    fetched_at: datetime = Field(default_factory=datetime.utcnow)

    def key(self) -> str:
        """Stable dedupe key for the same appearance."""
        name = (self.name_gr or self.name_en or "").strip().lower()
        return f"{self.source_kind}|{self.source_url}|{self.party_code}|{name}"


class Candidate(BaseModel):
    id: int | None = None
    canonical_name_gr: str | None = None
    canonical_name_en: str | None = None
    party_code: str
    district_code: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class FieldValue(BaseModel):
    candidate_id: int
    field: str
    value: str
    source_id: int
    extracted_at: datetime
    confidence: float


class CurrentField(BaseModel):
    candidate_id: int
    field: str
    best_value: str
    best_source_id: int
    field_confidence: float
