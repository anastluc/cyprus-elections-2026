export interface FieldValue {
  value: string;
  confidence: number;
  source_url: string;
  source_kind: string;
}

export interface Candidate {
  id: number;
  name_en: string;
  name_gr: string;
  party: string;
  district: string | null;
  row_confidence: number;
  fields: Record<string, FieldValue>;
  sources: string[];
  highlights?: string[];
  highlights_source?: string;
  age?: number;
}

export interface CoverageEntry {
  count: number;
  percentage: number;
}

export interface AgeHistogram {
  buckets: { range: string; count: number }[];
  median?: number;
  mean?: number;
  n: number;
}

export interface DigitalFootprint {
  platforms: string[];
  parties: string[];
  matrix: Record<string, Record<string, number>>;
  party_totals: Record<string, number>;
}

export interface RowConfBucket {
  label: string;
  range: string;
  count: number;
}

export interface Stats {
  total_candidates: number;
  coverage: Record<string, CoverageEntry>;
  by_party: Record<string, number>;
  by_district: Record<string, number>;
  by_gender: Record<string, number>;
  by_cluster: Record<string, number>;
  age_histogram: AgeHistogram;
  digital_footprint: DigitalFootprint;
  avg_age_by_party: Record<string, number>;
  district_party_matrix: Record<string, Record<string, number>>;
  source_kinds: Record<string, number>;
  row_confidence_histogram: RowConfBucket[];
}

export interface HistoryRow {
  candidate_id: number | null;
  name_en: string | null;
  name_gr: string | null;
  year: number;
  party_code: string;
  party_label: string | null;
  district_code: string | null;
  votes: number | null;
  elected: boolean;
  source_url: string;
}

export interface Meta {
  generated_at: string;
  total_candidates: number;
  total_sources: number;
  last_ingest_at: string | null;
  disclaimer: string;
  election_date: string;
  field_order: string[];
  party_codes: string[];
  district_codes: string[];
  correction_sheet_url?: string;
}

export interface Dataset {
  candidates: Candidate[];
  stats: Stats;
  history: HistoryRow[];
  meta: Meta;
}
