export const PARTY_COLOURS: Record<string, string> = {
  AKEL: '#d94b4b',
  DISY: '#2b6cb0',
  DIKO: '#d69e2e',
  EDEK: '#ed64a6',
  ELAM: '#1a1a1a',
  KOSP: '#38a169',
  DIPA: '#ed8936',
  VOLT: '#805ad5',
  ALMA: '#0bc5ea',
  ADEM: '#f56565',
  EVROKO: '#4299e1',
  SP: '#718096',
  ALLIL: '#9f7aea',
  IND: '#a0aec0',
  OTHER: '#94a3b8',
};

export const PARTY_LABELS: Record<string, string> = {
  AKEL: 'AKEL',
  DISY: 'DISY',
  DIKO: 'DIKO',
  EDEK: 'EDEK',
  ELAM: 'ELAM',
  KOSP: 'Greens',
  DIPA: 'DIPA',
  VOLT: 'Volt',
  ALMA: 'ALMA',
  ADEM: 'ADEM',
  EVROKO: 'EVROKO',
  SP: 'Sol. Mov.',
  ALLIL: 'Alliance',
  IND: 'Independent',
  OTHER: 'Other',
};

export const PARTY_FULL_NAMES: Record<string, string> = {
  AKEL: 'AKEL – Left – Social Alliance',
  DISY: 'Democratic Rally',
  DIKO: 'Democratic Party',
  EDEK: 'Movement for Social Democracy',
  ELAM: 'National Popular Front',
  KOSP: "Movement of Ecologists – Citizens' Cooperation",
  DIPA: 'Democratic Alignment',
  VOLT: 'Volt Cyprus',
  ALMA: 'ALMA – Citizens for Cyprus',
  ADEM: 'ADEM',
  EVROKO: 'European Party (defunct, 2005–2017)',
  SP: 'Solidarity Movement (defunct)',
  ALLIL: "Citizens' Alliance (defunct)",
  IND: 'Independent candidate',
  OTHER: 'Other parties / independents',
};

export const PARTY_FULL_NAMES_GR: Record<string, string> = {
  AKEL: 'ΑΚΕΛ – Αριστερά – Νέες Δυνάμεις',
  DISY: 'Δημοκρατικός Συναγερμός',
  DIKO: 'Δημοκρατικό Κόμμα',
  EDEK: 'Κίνημα Σοσιαλδημοκρατών ΕΔΕΚ',
  ELAM: 'Εθνικό Λαϊκό Μέτωπο',
  KOSP: 'Κίνημα Οικολόγων – Συνεργασία Πολιτών',
  DIPA: 'Δημοκρατική Παράταξη',
  VOLT: 'Volt Κύπρου',
  ALMA: 'ΑΛΜΑ – Πολίτες για την Κύπρο',
  ADEM: 'Άμεση Δημοκρατία',
  EVROKO: 'Ευρωπαϊκό Κόμμα (ανενεργό, 2005–2017)',
  SP: 'Κίνημα Αλληλεγγύη (ανενεργό)',
  ALLIL: 'Συμμαχία Πολιτών (ανενεργό)',
  IND: 'Ανεξάρτητος υποψήφιος',
  OTHER: 'Άλλα κόμματα / ανεξάρτητοι',
};

export const PARTY_LABELS_GR: Record<string, string> = {
  AKEL: 'ΑΚΕΛ',
  DISY: 'ΔΗΣΥ',
  DIKO: 'ΔΗΚΟ',
  EDEK: 'ΕΔΕΚ',
  ELAM: 'ΕΛΑΜ',
  KOSP: 'Οικολόγοι',
  DIPA: 'ΔΗΠΑ',
  VOLT: 'Volt',
  ALMA: 'ΑΛΜΑ',
  ADEM: 'ΑΝΔΗΜ',
  EVROKO: 'ΕΥΡΩΚΟ',
  SP: 'Αλληλεγγύη',
  ALLIL: 'Συμμαχία',
  IND: 'Ανεξάρτητος',
  OTHER: 'Άλλο',
};

export const PARTY_ORDER = [
  'AKEL',
  'DISY',
  'DIKO',
  'ELAM',
  'KOSP',
  'DIPA',
  'VOLT',
  'ALMA',
  'ADEM',
  'EDEK',
  'EVROKO',
  'SP',
  'ALLIL',
  'IND',
];

// Parties actually contesting the 2026 election (mirrors config/parties.yaml),
// plus an "Other" bucket for independents / smaller parties so the slider
// totals can reach 100 % without forcing users to dump residuals into a real
// party. Used by the Predict page.
export const PREDICT_PARTY_ORDER = [
  'AKEL',
  'DISY',
  'DIKO',
  'ELAM',
  'KOSP',
  'DIPA',
  'VOLT',
  'ALMA',
  'ADEM',
  'EDEK',
  'OTHER',
];

export const DISTRICT_LABELS: Record<string, string> = {
  NIC: 'Nicosia',
  LIM: 'Limassol',
  FAM: 'Famagusta',
  LAR: 'Larnaca',
  PAF: 'Paphos',
  KYR: 'Kyrenia',
};

export const DISTRICT_LABELS_GR: Record<string, string> = {
  NIC: 'Λευκωσία',
  LIM: 'Λεμεσός',
  FAM: 'Αμμόχωστος',
  LAR: 'Λάρνακα',
  PAF: 'Πάφος',
  KYR: 'Κερύνεια',
};

export const DISTRICT_ORDER = ['NIC', 'LIM', 'LAR', 'FAM', 'PAF', 'KYR'];

export const DISTRICT_SEATS: Record<string, number> = {
  NIC: 20,
  LIM: 12,
  LAR: 6,
  FAM: 11,
  PAF: 4,
  KYR: 3,
};

export const CLUSTER_COLOURS: Record<string, string> = {
  Law: '#60a5fa',
  Medicine: '#f87171',
  Engineering: '#fbbf24',
  Education: '#34d399',
  Business: '#a78bfa',
  'Civil society': '#f472b6',
  'Public sector': '#818cf8',
  Media: '#fb923c',
  Agriculture: '#65a30d',
  'Military/Police': '#475569',
  Arts: '#fb7185',
  Research: '#2dd4bf',
  Technology: '#22d3ee',
  Finance: '#eab308',
  Other: '#94a3b8',
};

export const PLATFORM_ICONS: Record<string, string> = {
  facebook: '𝐟',
  twitter: '𝕏',
  instagram: '◎',
  linkedin: 'in',
  website: '◐',
  wikipedia: 'W',
};

export function partyColour(code: string): string {
  return PARTY_COLOURS[code] ?? '#94a3b8';
}

export function partyLabel(code: string, locale: 'en' | 'gr' = 'en'): string {
  if (locale === 'gr') {
    return PARTY_LABELS_GR[code] ?? PARTY_LABELS[code] ?? code;
  }
  return PARTY_LABELS[code] ?? code;
}

export function partyFullName(code: string, locale: 'en' | 'gr' = 'en'): string {
  if (locale === 'gr') {
    return PARTY_FULL_NAMES_GR[code] ?? PARTY_FULL_NAMES[code] ?? partyLabel(code, 'gr');
  }
  return PARTY_FULL_NAMES[code] ?? partyLabel(code, 'en');
}

export function districtLabel(code: string, locale: 'en' | 'gr' = 'en'): string {
  if (locale === 'gr') {
    return DISTRICT_LABELS_GR[code] ?? DISTRICT_LABELS[code] ?? code;
  }
  return DISTRICT_LABELS[code] ?? code;
}

export function clusterColour(name: string): string {
  return CLUSTER_COLOURS[name] ?? '#94a3b8';
}

export const NIVO_THEME = {
  background: 'transparent',
  text: { fill: 'var(--text-300)', fontFamily: 'Inter, sans-serif', fontSize: 12 },
  axis: {
    domain: { line: { stroke: 'var(--surface-border)' } },
    ticks: {
      line: { stroke: 'var(--surface-border)' },
      text: { fill: 'var(--text-400)', fontSize: 11 },
    },
    legend: { text: { fill: 'var(--text-300)', fontSize: 12 } },
  },
  grid: { line: { stroke: 'var(--tint-soft)' } },
  legends: { text: { fill: 'var(--text-300)' } },
  tooltip: {
    container: {
      background: 'var(--tooltip-bg)',
      color: 'var(--tooltip-text)',
      fontSize: 12,
      borderRadius: 10,
      border: '1px solid var(--surface-border)',
      padding: '8px 10px',
    },
  },
};
