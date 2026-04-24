import { useUI } from './store';

export type Locale = 'en' | 'gr';

const EN = {
  // Sidebar
  nav_overview: 'Overview',
  nav_demographics: 'Demographics',
  nav_parties: 'Parties',
  nav_professions: 'Professions',
  nav_education: 'Education',
  nav_digital: 'Digital',
  nav_highlights: 'Highlights',
  nav_timeline: 'Timeline',
  nav_explorer: 'Explorer',
  nav_quality: 'Data quality',
  nav_correction: 'Submit correction',
  sidebar_label: 'Navigate',

  // Header
  header_eyebrow: 'Cyprus · Parliamentary Election',
  header_title_html: 'May 24, 2026 — Candidate Atlas',
  header_countdown: (n: number) => `${n} days to election day`,

  // Footer
  footer_generated: 'Dataset generated',
  footer_counts: (c: number, s: number) => `${c} candidates · ${s} sources`,
  footer_note:
    'Independent visualisation · Not affiliated with any party or the Cyprus Ministry of Interior',

  // Loading / errors
  loading: 'Loading dataset…',
  error_title: 'Could not load dataset',
  error_hint: 'Run',

  // Locale switch
  locale_switch_aria: 'Switch language',

  // Submit correction
  sc_eyebrow: 'Help improve the data',
  sc_title: 'Spotted something wrong? Tell us.',
  sc_subtitle:
    'This site pulls candidate information from many public sources. Some values may be wrong, outdated, or missing. You can suggest a fix in a shared Google Sheet — a human curator will review it and the correction will appear in the next update.',
  sc_button: 'Open the correction sheet',
  sc_button_note:
    "The sheet opens in a new tab. You don't need an account to view it, but you'll need a free Google account to leave a comment.",
  sc_not_ready:
    'The correction sheet is not set up yet. Please check back soon.',
  sc_how_title: 'How to submit a correction',
  sc_step1_title: 'Open the sheet',
  sc_step1_body: 'Click the button above. It opens a Google Sheet that lists every candidate in a table.',
  sc_step2_title: 'Find the candidate and the value you want to fix',
  sc_step2_body:
    "Each row is one candidate. Each column is one piece of information — name, party, age, profession, social-media links, and so on. Scroll or use Google Sheets' search to jump to the cell you care about.",
  sc_step3_title: 'Leave a comment on the cell',
  sc_step3_body:
    'Right-click the cell and choose "Comment". Write what the correct value should be and, if you can, add a link or explanation.',
  sc_step3_example:
    'This should be "Ιωάννης Παπαδόπουλος" — see his party profile: https://…',
  sc_step4_title: "That's it",
  sc_step4_body:
    'A curator will review your comment, decide whether to apply it, and the change will be published in the next nightly update of this site.',
  sc_info1_title: "You can't break anything",
  sc_info1_body:
    "The sheet is shared in read + comment mode. You can leave comments, but you can't change any cell values directly.",
  sc_info2_title: 'A human reviews every comment',
  sc_info2_body:
    "A curator reads each suggestion and decides whether it's correct. Spam, opinions, or unverifiable claims are ignored.",
  sc_info3_title: 'Updates go live overnight',
  sc_info3_body:
    'Approved corrections are applied to the database at night. The dashboard refreshes from that database, so your fix should be visible the next day.',
  sc_contact:
    'Prefer email? Reach out at polismetrics365@gmail.com.',
  sc_footer:
    'This is a community effort. Please keep suggestions factual and — where possible — include a source (official party page, news article, Wikipedia, official MoI results).',

  // Correction CTA component
  cta_card_title: 'Spotted something wrong?',
  cta_card_body:
    'Suggest a correction in our shared Google Sheet — a curator will review it and publish the fix overnight.',
  cta_card_button: 'Suggest a correction',
  cta_inline: 'Suggest a correction',

  // Overview page
  overview_eyebrow: 'Overview',
  overview_title: (candidates: number, parties: number) =>
    `${candidates} candidates. ${parties} parties. One island.`,
  overview_subtitle:
    "Every candidate standing for the 56 parliamentary seats across Cyprus's six districts. Data collected from official party lists, ministry notices, Wikipedia, LinkedIn and AI-assisted enrichment — each value here is traceable to a source.",
  kpi_candidates: 'Candidates',
  kpi_parties: 'Parties',
  kpi_districts: 'Districts',
  kpi_women: 'Women',
  kpi_avg_age: 'Avg. age',
  kpi_avg_age_suffix: 'yrs',
  overview_geo_eyebrow: 'Geography',
  overview_geo_title: 'Candidate density by district',
  overview_geo_hint: 'Click a district to filter',
  overview_party_eyebrow: 'Party mix',
  overview_party_title: 'Candidates per party',
  overview_party_largest: (code: string, n: string) =>
    `Largest slate: ${code} · ${n} candidates`,
  overview_story_women_headline: (p: string) => `${p} women`,
  overview_story_women_body: (total: number) =>
    `Across the full slate of ${total} candidates. Gender balance varies sharply by party — see the Demographics section for the breakdown.`,
  overview_story_prof_headline: (p: number) =>
    `${p}% have a listed profession`,
  overview_story_prof_body:
    'LLM-clustered into 15 categories. Law, Education and Business dominate; the Professions section shows the full treemap.',
  overview_story_twitter_headline: (p: number) =>
    `Only ${p}% have a public X/Twitter handle`,
  overview_story_twitter_body:
    'Digital footprint is patchy — Facebook leads at ~19%, Wikipedia under 3%. Explore the Digital page for per-party heatmap.',

  // Demographics
  demo_eyebrow: 'Demographics',
  demo_title: 'Who is standing?',
  demo_subtitle:
    'Age, gender and geography across all 297 candidates. Age is only recorded for ~⅓ of the slate, so the histogram is indicative.',
  demo_gender_eyebrow: 'Gender',
  demo_gender_headline: (pct: string) => `${pct} women on the combined slate`,
  demo_gender_caption: (women: number, men: number) =>
    `${women} women · ${men} men. Party-level splits vary widely — see "Parties".`,
  demo_age_eyebrow: 'Age distribution',
  demo_age_title: 'Age histogram',
  demo_age_median_suffix: (n: number) => ` · median ${n}yr`,
  demo_age_n: (n: number) => `n = ${n} candidates with published birth year.`,
  demo_geo_eyebrow: 'Geography',
  demo_geo_title: 'Candidates per district',
  demo_age_party_eyebrow: 'Age by party',
  demo_age_party_title: 'Average candidate age per party',
  demo_age_party_caption:
    'Only parties with at least one candidate with a known birth year are shown.',

  // Parties page
  parties_eyebrow: 'Parties',
  parties_title: 'Inside the party slates',
  parties_subtitle:
    'How each party is composed — by gender, age, and where in Cyprus their candidates are standing. Click any party card or bar to jump into the Explorer filtered.',
  parties_candidates_label: 'candidates',
  parties_women_suffix: 'women',
  parties_avg_age: 'avg age',
  parties_click_explore: 'Click to explore →',
  parties_gender_eyebrow: 'Gender balance',
  parties_gender_title: 'Men vs women per party',
  parties_gender_caption:
    'Click a segment to open the Explorer filtered by party + gender.',
  parties_heat_eyebrow: 'Geography × Party',
  parties_heat_title: 'District × party heatmap',
  parties_heat_caption:
    'Click any cell to open the Explorer filtered by that party and district.',
  men_label: 'Men',
  women_label: 'Women',

  // Professions
  prof_eyebrow: 'Professions',
  prof_title: 'What do candidates do for a living?',
  prof_subtitle:
    'Free-text profession titles clustered by LLM into 15 categories. Click any tile, bar, or top-title to open the Explorer filtered.',
  prof_treemap_eyebrow: 'Treemap',
  prof_treemap_title: 'Clustered professions',
  prof_ranking_eyebrow: 'Cluster ranking',
  prof_ranking_title: 'Candidates per category',
  prof_top_eyebrow: 'Top 12 free-text titles',
  prof_top_title: 'Most common backgrounds',

  // Education
  edu_eyebrow: 'Education',
  edu_title: 'Where candidates studied',
  edu_subtitle_prefix: (withEd: number, total: number) =>
    `${withEd} of ${total} candidates have an extracted education field. Highest attained level is inferred from free-text — most common is `,
  edu_subtitle_suffix: '. Click any card to open the Explorer filtered.',
  edu_level_header: 'Level',
  edu_candidates_label: 'candidates',
  edu_filter_explorer: 'Filter Explorer →',
  edu_level_phd: 'PhD / Doctorate',
  edu_level_master: "Master's",
  edu_level_bachelor: "Bachelor's",
  edu_level_diploma: 'Diploma / Other',
  edu_institutions_eyebrow: 'Institutions',
  edu_institutions_title: 'Most-mentioned universities',
  edu_institutions_empty: 'No university mentions extracted yet.',
  edu_coverage_eyebrow: 'Coverage',
  edu_quality_title: 'Data quality',
  edu_quality_body:
    "Education is free text pulled from bios and CV text. Levels and institutions are extracted with simple keyword matching here on the client; totals won't sum to candidate counts because a candidate can hold multiple degrees or list multiple institutions.",
  edu_with_education: 'with education',
  edu_coverage_label: 'coverage',

  // Digital
  digital_eyebrow: 'Digital footprint',
  digital_title: 'Where candidates live online',
  digital_subtitle_part1: 'Roughly ',
  digital_subtitle_part2: (topPct: string, top: string) =>
    `${topPct}% of candidates have a public ${top} — but only `,
  digital_subtitle_part3: (leastPct: string, least: string) =>
    `${leastPct}% maintain ${least}. Coverage skews heavily by party.`,
  digital_coverage_eyebrow: 'Coverage',
  digital_coverage_title: 'Share with a public handle',
  digital_coverage_caption:
    'Click a platform to open the Explorer filtered to candidates with that handle.',
  digital_matrix_eyebrow: 'Party × Platform',
  digital_matrix_title: "Who's on what",
  digital_matrix_caption:
    'Cells = candidates from a party with a known handle on the platform. Click to open the Explorer filtered.',

  // Highlights
  highlights_eyebrow: 'Highlights',
  highlights_title: 'Remarkable mentions',
  highlights_subtitle:
    "AI-extracted summaries of standout facts — published works, awards, past elected roles, founded organisations — from each candidate's bio or CV. Click any card to open the full profile.",
  highlights_all_parties: 'All parties',
  highlights_search_ph: 'Search name or highlight…',
  highlights_showing: (shown: number, total: number) =>
    `Showing ${shown} of ${total}. Refine filters or search to see more.`,
  highlights_empty: 'No highlights match your filter.',
  highlights_from_bio: 'from bio',
  highlights_from_bio_source: (host: string) => `from bio · ${host}`,

  // Timeline
  timeline_eyebrow: 'Historical timeline',
  timeline_title: (n: number) => `${n} returning candidates`,
  timeline_subtitle_1:
    'Each row is a person currently on a 2026 slate who also appeared in a past parliamentary election. ✓ = elected; ✗ = ran but lost. Cell colour maps to the party they stood with ',
  timeline_subtitle_2_em: 'that year',
  timeline_subtitle_3:
    ' (parties rebrand and merge). Hover for vote counts and sources.',
  timeline_sort: 'Sort:',
  timeline_sort_first_year: 'First year running',
  timeline_sort_party: 'Party',
  timeline_sort_votes: 'Total historical votes',
  timeline_sort_name: 'Name',
  timeline_footer:
    'Pre-2016 historical data is drawn from the Wikipedia records of each parliamentary election — it is limited to elected MPs and occasional high-profile candidates. The Cyprus Ministry of Interior results portal provides per-candidate vote counts for 2016 and 2021 when available. Cells left empty mean we do not have a record — not that the candidate did not run.',
  timeline_dev_banner:
    '🚧 This section is still under development — historical coverage is incomplete and names may not yet be matched across past elections.',

  // Explorer
  explorer_eyebrow: 'Explorer',
  explorer_title: 'Every candidate, every field',
  explorer_subtitle:
    'Click any row to open the full profile. Filters mirror the ones applied from other tabs.',
  explorer_clear_filters: 'Clear filters',
  explorer_search_ph: 'Search name / profession / education…',
  explorer_all_parties: 'All parties',
  explorer_all_districts: 'All districts',
  explorer_any_gender: 'Any gender',
  explorer_any_cluster: 'Any cluster',
  explorer_any_platform: 'Any platform',
  explorer_has_platform: (platform: string) => `Has ${platform}`,
  explorer_profession_ph: 'Profession contains…',
  explorer_education_ph: 'Education contains (e.g. Harvard, Νομική, PhD)…',
  explorer_filter_party: (label: string) => `Party: ${label}`,
  explorer_filter_district: (label: string) => `District: ${label}`,
  explorer_filter_gender: (label: string) => `Gender: ${label}`,
  explorer_filter_cluster: (label: string) => `Cluster: ${label}`,
  explorer_filter_profession: (label: string) => `Profession: ${label}`,
  explorer_filter_education: (label: string) => `Education: ${label}`,
  explorer_filter_platform: (platform: string) => `Has ${platform}`,
  explorer_showing: (shown: number, total: number) =>
    `Showing ${shown} of ${total} candidates.`,
  explorer_col_name: 'Name',
  explorer_col_party: 'Party',
  explorer_col_district: 'District',
  explorer_col_gender: 'Gender',
  explorer_col_age: 'Age',
  explorer_col_cluster: 'Cluster',
  explorer_col_conf: 'Conf.',
  gender_female: 'Female',
  gender_male: 'Male',

  // Data quality
  dq_eyebrow: 'Data quality',
  dq_title: 'How confident are we?',
  dq_subtitle_1:
    'Every value carries a ',
  dq_subtitle_em: 'confidence',
  dq_subtitle_2:
    ' score between 0 and 1, and every row carries an aggregate. ',
  dq_subtitle_3:
    ' rows are below the 0.6 threshold — treat those with extra care.',
  dq_conf_eyebrow: 'Row confidence distribution',
  dq_conf_title: 'How many rows at each confidence band',
  dq_source_eyebrow: 'Source taxonomy',
  dq_source_title: 'Where values come from',
  dq_coverage_eyebrow: 'Coverage per field',
  dq_coverage_title: "Which fields we have, which we don't",
};

const GR: typeof EN = {
  nav_overview: 'Επισκόπηση',
  nav_demographics: 'Δημογραφικά',
  nav_parties: 'Κόμματα',
  nav_professions: 'Επαγγέλματα',
  nav_education: 'Εκπαίδευση',
  nav_digital: 'Ψηφιακή παρουσία',
  nav_highlights: 'Σημεία',
  nav_timeline: 'Χρονολόγιο',
  nav_explorer: 'Εξερεύνηση',
  nav_quality: 'Ποιότητα δεδομένων',
  nav_correction: 'Υποβολή διόρθωσης',
  sidebar_label: 'Πλοήγηση',

  header_eyebrow: 'Κύπρος · Βουλευτικές Εκλογές',
  header_title_html: '24 Μαΐου 2026 — Άτλας Υποψηφίων',
  header_countdown: (n: number) => `${n} ημέρες μέχρι τις εκλογές`,

  footer_generated: 'Το σύνολο δεδομένων δημιουργήθηκε στις',
  footer_counts: (c: number, s: number) => `${c} υποψήφιοι · ${s} πηγές`,
  footer_note:
    'Ανεξάρτητη οπτικοποίηση · Δεν σχετίζεται με κανένα κόμμα ή το Υπουργείο Εσωτερικών της Κύπρου',

  loading: 'Φόρτωση δεδομένων…',
  error_title: 'Δεν ήταν δυνατή η φόρτωση των δεδομένων',
  error_hint: 'Τρέξτε',

  locale_switch_aria: 'Αλλαγή γλώσσας',

  sc_eyebrow: 'Βοηθήστε να βελτιωθούν τα δεδομένα',
  sc_title: 'Εντοπίσατε κάτι λάθος; Πείτε μας.',
  sc_subtitle:
    'Ο ιστότοπος συγκεντρώνει πληροφορίες υποψηφίων από πολλές δημόσιες πηγές. Κάποιες τιμές μπορεί να είναι λανθασμένες, παλιές ή να λείπουν. Μπορείτε να προτείνετε διόρθωση σε ένα κοινόχρηστο Google Sheet — κάποιος επιμελητής θα το εξετάσει και η διόρθωση θα εμφανιστεί στην επόμενη ενημέρωση.',
  sc_button: 'Άνοιγμα του φύλλου διορθώσεων',
  sc_button_note:
    'Το φύλλο ανοίγει σε νέα καρτέλα. Δεν χρειάζεστε λογαριασμό για να το δείτε, αλλά θα χρειαστείτε δωρεάν λογαριασμό Google για να αφήσετε σχόλιο.',
  sc_not_ready:
    'Το φύλλο διορθώσεων δεν έχει ρυθμιστεί ακόμα. Παρακαλώ δοκιμάστε ξανά αργότερα.',
  sc_how_title: 'Πώς να υποβάλετε διόρθωση',
  sc_step1_title: 'Ανοίξτε το φύλλο',
  sc_step1_body:
    'Πατήστε το κουμπί πιο πάνω. Ανοίγει ένα Google Sheet με πίνακα όλων των υποψηφίων.',
  sc_step2_title: 'Βρείτε τον υποψήφιο και την τιμή που θέλετε να διορθώσετε',
  sc_step2_body:
    'Κάθε γραμμή είναι ένας υποψήφιος. Κάθε στήλη είναι ένα στοιχείο — όνομα, κόμμα, ηλικία, επάγγελμα, συνδέσμους κοινωνικών δικτύων, κ.λπ. Κάντε scroll ή χρησιμοποιήστε την αναζήτηση του Google Sheets για να βρείτε το κελί.',
  sc_step3_title: 'Αφήστε σχόλιο στο κελί',
  sc_step3_body:
    'Κάντε δεξί κλικ στο κελί και επιλέξτε "Σχόλιο". Γράψτε ποια πρέπει να είναι η σωστή τιμή και, αν μπορείτε, προσθέστε σύνδεσμο ή εξήγηση.',
  sc_step3_example:
    'Το σωστό είναι "Ιωάννης Παπαδόπουλος" — δείτε το προφίλ του στο κόμμα: https://…',
  sc_step4_title: 'Αυτό ήταν',
  sc_step4_body:
    'Ένας επιμελητής θα διαβάσει το σχόλιό σας, θα αποφασίσει αν θα εφαρμοστεί, και η αλλαγή θα δημοσιευτεί στην επόμενη νυχτερινή ενημέρωση.',
  sc_info1_title: 'Δεν μπορείτε να χαλάσετε τίποτα',
  sc_info1_body:
    'Το φύλλο μοιράζεται σε λειτουργία ανάγνωσης + σχολίων. Μπορείτε να αφήνετε σχόλια αλλά όχι να αλλάζετε τιμές κελιών.',
  sc_info2_title: 'Κάθε σχόλιο ελέγχεται από άνθρωπο',
  sc_info2_body:
    'Ένας επιμελητής διαβάζει κάθε πρόταση και αποφασίζει αν είναι σωστή. Spam, απόψεις ή μη επαληθεύσιμοι ισχυρισμοί αγνοούνται.',
  sc_info3_title: 'Οι αλλαγές εφαρμόζονται τη νύχτα',
  sc_info3_body:
    'Οι εγκεκριμένες διορθώσεις εφαρμόζονται στη βάση δεδομένων τη νύχτα. Ο πίνακας ανανεώνεται από εκεί, οπότε η αλλαγή θα φαίνεται την επόμενη μέρα.',
  sc_contact:
    'Προτιμάτε email; Επικοινωνήστε στο polismetrics365@gmail.com.',
  sc_footer:
    'Αυτή είναι κοινοτική προσπάθεια. Παρακαλώ κρατήστε τις προτάσεις τεκμηριωμένες και — όπου γίνεται — προσθέστε πηγή (επίσημη σελίδα κόμματος, άρθρο, Wikipedia, επίσημα αποτελέσματα ΥΠ.ΕΣ.).',

  cta_card_title: 'Εντοπίσατε κάτι λάθος;',
  cta_card_body:
    'Προτείνετε μια διόρθωση στο κοινόχρηστο Google Sheet — θα εξεταστεί από επιμελητή και θα εφαρμοστεί τη νύχτα.',
  cta_card_button: 'Πρόταση διόρθωσης',
  cta_inline: 'Πρόταση διόρθωσης',

  overview_eyebrow: 'Επισκόπηση',
  overview_title: (candidates: number, parties: number) =>
    `${candidates} υποψήφιοι. ${parties} κόμματα. Ένα νησί.`,
  overview_subtitle:
    'Όλοι οι υποψήφιοι που διεκδικούν τις 56 βουλευτικές έδρες στις έξι επαρχίες της Κύπρου. Τα δεδομένα συλλέγονται από επίσημες λίστες κομμάτων, ανακοινώσεις υπουργείου, Wikipedia, LinkedIn και εμπλουτισμό με βοήθεια AI — κάθε τιμή εδώ είναι ανιχνεύσιμη σε πηγή.',
  kpi_candidates: 'Υποψήφιοι',
  kpi_parties: 'Κόμματα',
  kpi_districts: 'Επαρχίες',
  kpi_women: 'Γυναίκες',
  kpi_avg_age: 'Μέση ηλικία',
  kpi_avg_age_suffix: 'ετών',
  overview_geo_eyebrow: 'Γεωγραφία',
  overview_geo_title: 'Πυκνότητα υποψηφίων ανά επαρχία',
  overview_geo_hint: 'Πατήστε μια επαρχία για φιλτράρισμα',
  overview_party_eyebrow: 'Κατανομή κομμάτων',
  overview_party_title: 'Υποψήφιοι ανά κόμμα',
  overview_party_largest: (code: string, n: string) =>
    `Μεγαλύτερο ψηφοδέλτιο: ${code} · ${n} υποψήφιοι`,
  overview_story_women_headline: (p: string) => `${p} γυναίκες`,
  overview_story_women_body: (total: number) =>
    `Στο σύνολο των ${total} υποψηφίων. Η ισορροπία φύλων διαφέρει σημαντικά ανά κόμμα — δείτε την ενότητα «Δημογραφικά» για την πλήρη ανάλυση.`,
  overview_story_prof_headline: (p: number) =>
    `${p}% έχουν καταγεγραμμένο επάγγελμα`,
  overview_story_prof_body:
    'Ομαδοποιημένα με LLM σε 15 κατηγορίες. Νομικά, Εκπαίδευση και Επιχειρήσεις κυριαρχούν· η ενότητα «Επαγγέλματα» δείχνει το πλήρες treemap.',
  overview_story_twitter_headline: (p: number) =>
    `Μόνο ${p}% έχουν δημόσιο λογαριασμό X/Twitter`,
  overview_story_twitter_body:
    'Η ψηφιακή παρουσία είναι ασταθής — το Facebook προηγείται με ~19%, το Wikipedia κάτω από 3%. Εξερευνήστε την ενότητα «Ψηφιακή παρουσία» για heatmap ανά κόμμα.',

  demo_eyebrow: 'Δημογραφικά',
  demo_title: 'Ποιοι διεκδικούν;',
  demo_subtitle:
    'Ηλικία, φύλο και γεωγραφία για όλους τους 297 υποψηφίους. Η ηλικία είναι καταγεγραμμένη μόνο για περίπου το ⅓ των υποψηφίων, οπότε το ιστόγραμμα είναι ενδεικτικό.',
  demo_gender_eyebrow: 'Φύλο',
  demo_gender_headline: (pct: string) => `${pct} γυναίκες στο συνολικό ψηφοδέλτιο`,
  demo_gender_caption: (women: number, men: number) =>
    `${women} γυναίκες · ${men} άνδρες. Οι αναλογίες ανά κόμμα διαφέρουν σημαντικά — δείτε την ενότητα «Κόμματα».`,
  demo_age_eyebrow: 'Κατανομή ηλικιών',
  demo_age_title: 'Ιστόγραμμα ηλικιών',
  demo_age_median_suffix: (n: number) => ` · διάμεσος ${n} έτη`,
  demo_age_n: (n: number) => `n = ${n} υποψήφιοι με δημοσιευμένο έτος γέννησης.`,
  demo_geo_eyebrow: 'Γεωγραφία',
  demo_geo_title: 'Υποψήφιοι ανά επαρχία',
  demo_age_party_eyebrow: 'Ηλικία ανά κόμμα',
  demo_age_party_title: 'Μέση ηλικία υποψηφίου ανά κόμμα',
  demo_age_party_caption:
    'Εμφανίζονται μόνο κόμματα με τουλάχιστον έναν υποψήφιο γνωστού έτους γέννησης.',

  parties_eyebrow: 'Κόμματα',
  parties_title: 'Μέσα στα ψηφοδέλτια',
  parties_subtitle:
    'Πώς συντίθεται κάθε κόμμα — ανά φύλο, ηλικία, και πού στην Κύπρο διεκδικούν. Πατήστε μια κάρτα κόμματος ή μια μπάρα για να μεταβείτε στην «Εξερεύνηση» με φίλτρο.',
  parties_candidates_label: 'υποψήφιοι',
  parties_women_suffix: 'γυναίκες',
  parties_avg_age: 'μέση ηλικία',
  parties_click_explore: 'Πατήστε για εξερεύνηση →',
  parties_gender_eyebrow: 'Ισορροπία φύλων',
  parties_gender_title: 'Άνδρες vs γυναίκες ανά κόμμα',
  parties_gender_caption:
    'Πατήστε ένα τμήμα για να ανοίξετε την «Εξερεύνηση» με φίλτρο κόμμα + φύλο.',
  parties_heat_eyebrow: 'Γεωγραφία × Κόμμα',
  parties_heat_title: 'Επαρχία × κόμμα heatmap',
  parties_heat_caption:
    'Πατήστε ένα κελί για «Εξερεύνηση» με φίλτρο κόμμα + επαρχία.',
  men_label: 'Άνδρες',
  women_label: 'Γυναίκες',

  prof_eyebrow: 'Επαγγέλματα',
  prof_title: 'Τι κάνουν οι υποψήφιοι επαγγελματικά;',
  prof_subtitle:
    'Ελεύθερα κειμενικά επαγγέλματα ομαδοποιημένα από LLM σε 15 κατηγορίες. Πατήστε ένα πλακίδιο, μπάρα ή τίτλο για να ανοίξετε την «Εξερεύνηση» με φίλτρο.',
  prof_treemap_eyebrow: 'Treemap',
  prof_treemap_title: 'Ομαδοποιημένα επαγγέλματα',
  prof_ranking_eyebrow: 'Κατάταξη κατηγοριών',
  prof_ranking_title: 'Υποψήφιοι ανά κατηγορία',
  prof_top_eyebrow: 'Top 12 τίτλοι',
  prof_top_title: 'Συχνότερα επαγγελματικά υπόβαθρα',

  edu_eyebrow: 'Εκπαίδευση',
  edu_title: 'Πού σπούδασαν οι υποψήφιοι',
  edu_subtitle_prefix: (withEd: number, total: number) =>
    `${withEd} από ${total} υποψηφίους έχουν εξαχθέν πεδίο εκπαίδευσης. Το ανώτατο επίπεδο εξάγεται από ελεύθερο κείμενο — συχνότερο είναι το `,
  edu_subtitle_suffix: '. Πατήστε μια κάρτα για «Εξερεύνηση» με φίλτρο.',
  edu_level_header: 'Επίπεδο',
  edu_candidates_label: 'υποψήφιοι',
  edu_filter_explorer: 'Φιλτράρισμα «Εξερεύνηση» →',
  edu_level_phd: 'Διδακτορικό',
  edu_level_master: 'Μεταπτυχιακό',
  edu_level_bachelor: 'Πτυχίο',
  edu_level_diploma: 'Δίπλωμα / Άλλο',
  edu_institutions_eyebrow: 'Ιδρύματα',
  edu_institutions_title: 'Πιο συχνά αναφερόμενα πανεπιστήμια',
  edu_institutions_empty: 'Δεν έχουν εξαχθεί αναφορές σε πανεπιστήμια.',
  edu_coverage_eyebrow: 'Κάλυψη',
  edu_quality_title: 'Ποιότητα δεδομένων',
  edu_quality_body:
    'Η εκπαίδευση είναι ελεύθερο κείμενο από βιογραφικά και CV. Τα επίπεδα και τα ιδρύματα εξάγονται με απλή αναζήτηση λέξεων-κλειδιών στον client· τα σύνολα δεν αθροίζουν στον αριθμό υποψηφίων, γιατί ένας υποψήφιος μπορεί να έχει πολλαπλά πτυχία ή ιδρύματα.',
  edu_with_education: 'με εκπαίδευση',
  edu_coverage_label: 'κάλυψη',

  digital_eyebrow: 'Ψηφιακή παρουσία',
  digital_title: 'Πού βρίσκονται online οι υποψήφιοι',
  digital_subtitle_part1: 'Περίπου ',
  digital_subtitle_part2: (topPct: string, top: string) =>
    `${topPct}% των υποψηφίων έχουν δημόσιο ${top} — αλλά μόνο `,
  digital_subtitle_part3: (leastPct: string, least: string) =>
    `${leastPct}% διατηρούν ${least}. Η κάλυψη διαφέρει σημαντικά ανά κόμμα.`,
  digital_coverage_eyebrow: 'Κάλυψη',
  digital_coverage_title: 'Ποσοστό με δημόσιο λογαριασμό',
  digital_coverage_caption:
    'Πατήστε μια πλατφόρμα για «Εξερεύνηση» φιλτραρισμένη σε υποψηφίους με λογαριασμό εκεί.',
  digital_matrix_eyebrow: 'Κόμμα × Πλατφόρμα',
  digital_matrix_title: 'Ποιος είναι πού',
  digital_matrix_caption:
    'Κελιά = υποψήφιοι κόμματος με γνωστό λογαριασμό στην πλατφόρμα. Πατήστε για «Εξερεύνηση» με φίλτρο.',

  highlights_eyebrow: 'Σημεία',
  highlights_title: 'Αξιοσημείωτες αναφορές',
  highlights_subtitle:
    'Περιλήψεις εξαγμένες από AI με ξεχωριστά στοιχεία — δημοσιεύσεις, βραβεία, προηγούμενα εκλεγμένα αξιώματα, οργανισμοί που ιδρύθηκαν — από το βιογραφικό κάθε υποψηφίου. Πατήστε μια κάρτα για το πλήρες προφίλ.',
  highlights_all_parties: 'Όλα τα κόμματα',
  highlights_search_ph: 'Αναζήτηση ονόματος ή σημείου…',
  highlights_showing: (shown: number, total: number) =>
    `Εμφανίζονται ${shown} από ${total}. Φιλτράρετε ή αναζητήστε για περισσότερα.`,
  highlights_empty: 'Δεν υπάρχουν σημεία που να ταιριάζουν με το φίλτρο.',
  highlights_from_bio: 'από βιογραφικό',
  highlights_from_bio_source: (host: string) => `από βιογραφικό · ${host}`,

  timeline_eyebrow: 'Ιστορικό',
  timeline_title: (n: number) => `${n} επιστρέφοντες υποψήφιοι`,
  timeline_subtitle_1:
    'Κάθε γραμμή είναι ένα πρόσωπο που βρίσκεται στο ψηφοδέλτιο του 2026 και έχει εμφανιστεί και σε παλαιότερες βουλευτικές εκλογές. ✓ = εκλεγμένος/η· ✗ = κατέβηκε αλλά δεν εκλέχθηκε. Το χρώμα κελιού αντιστοιχεί στο κόμμα με το οποίο κατέβηκε ',
  timeline_subtitle_2_em: 'εκείνη τη χρονιά',
  timeline_subtitle_3:
    ' (κόμματα μετονομάζονται και συγχωνεύονται). Κρατήστε το ποντίκι για αριθμούς ψήφων και πηγές.',
  timeline_sort: 'Ταξινόμηση:',
  timeline_sort_first_year: 'Πρώτο έτος υποψηφιότητας',
  timeline_sort_party: 'Κόμμα',
  timeline_sort_votes: 'Συνολικές ιστορικές ψήφοι',
  timeline_sort_name: 'Όνομα',
  timeline_footer:
    'Τα ιστορικά δεδομένα πριν το 2016 προέρχονται από τα αρχεία της Wikipedia για κάθε βουλευτική εκλογή — περιορίζονται σε εκλεγμένους βουλευτές και περιστασιακά σε υποψηφίους υψηλού προφίλ. Η πύλη αποτελεσμάτων του Υπ. Εσωτερικών Κύπρου παρέχει αριθμούς ψήφων ανά υποψήφιο για 2016 και 2021 όπου διατίθεται. Κενά κελιά σημαίνουν ότι δεν έχουμε καταγραφή — όχι ότι ο υποψήφιος δεν κατέβηκε.',
  timeline_dev_banner:
    '🚧 Αυτή η ενότητα είναι υπό ανάπτυξη — η ιστορική κάλυψη είναι ελλιπής και τα ονόματα ενδέχεται να μην έχουν ακόμη αντιστοιχιστεί μεταξύ παλαιότερων εκλογών.',

  explorer_eyebrow: 'Εξερεύνηση',
  explorer_title: 'Κάθε υποψήφιος, κάθε πεδίο',
  explorer_subtitle:
    'Πατήστε μια γραμμή για το πλήρες προφίλ. Τα φίλτρα αντικατοπτρίζουν όσα έχουν εφαρμοστεί από άλλες καρτέλες.',
  explorer_clear_filters: 'Εκκαθάριση φίλτρων',
  explorer_search_ph: 'Αναζήτηση όνομα / επάγγελμα / εκπαίδευση…',
  explorer_all_parties: 'Όλα τα κόμματα',
  explorer_all_districts: 'Όλες οι επαρχίες',
  explorer_any_gender: 'Οποιοδήποτε φύλο',
  explorer_any_cluster: 'Οποιαδήποτε κατηγορία',
  explorer_any_platform: 'Οποιαδήποτε πλατφόρμα',
  explorer_has_platform: (platform: string) => `Έχει ${platform}`,
  explorer_profession_ph: 'Το επάγγελμα περιέχει…',
  explorer_education_ph: 'Η εκπαίδευση περιέχει (π.χ. Harvard, Νομική, PhD)…',
  explorer_filter_party: (label: string) => `Κόμμα: ${label}`,
  explorer_filter_district: (label: string) => `Επαρχία: ${label}`,
  explorer_filter_gender: (label: string) => `Φύλο: ${label}`,
  explorer_filter_cluster: (label: string) => `Κατηγορία: ${label}`,
  explorer_filter_profession: (label: string) => `Επάγγελμα: ${label}`,
  explorer_filter_education: (label: string) => `Εκπαίδευση: ${label}`,
  explorer_filter_platform: (platform: string) => `Έχει ${platform}`,
  explorer_showing: (shown: number, total: number) =>
    `Εμφανίζονται ${shown} από ${total} υποψηφίους.`,
  explorer_col_name: 'Όνομα',
  explorer_col_party: 'Κόμμα',
  explorer_col_district: 'Επαρχία',
  explorer_col_gender: 'Φύλο',
  explorer_col_age: 'Ηλικία',
  explorer_col_cluster: 'Κατηγορία',
  explorer_col_conf: 'Εμπ.',
  gender_female: 'Γυναίκα',
  gender_male: 'Άνδρας',

  dq_eyebrow: 'Ποιότητα δεδομένων',
  dq_title: 'Πόσο σίγουροι είμαστε;',
  dq_subtitle_1: 'Κάθε τιμή φέρει ένα σκορ ',
  dq_subtitle_em: 'εμπιστοσύνης',
  dq_subtitle_2:
    ' μεταξύ 0 και 1, και κάθε γραμμή φέρει ένα συγκεντρωτικό σκορ. ',
  dq_subtitle_3:
    ' γραμμές είναι κάτω από το κατώφλι 0,6 — αντιμετωπίστε τις με προσοχή.',
  dq_conf_eyebrow: 'Κατανομή εμπιστοσύνης γραμμών',
  dq_conf_title: 'Πόσες γραμμές σε κάθε ζώνη εμπιστοσύνης',
  dq_source_eyebrow: 'Ταξινομία πηγών',
  dq_source_title: 'Από πού προέρχονται οι τιμές',
  dq_coverage_eyebrow: 'Κάλυψη ανά πεδίο',
  dq_coverage_title: 'Ποια πεδία έχουμε, ποια όχι',
};

const DICT: Record<Locale, typeof EN> = { en: EN, gr: GR };

export type TKey = keyof typeof EN;

export function useT() {
  const locale = useUI((s) => s.locale);
  return function t<K extends TKey>(key: K): typeof EN[K] {
    return DICT[locale][key] ?? EN[key];
  };
}

export function translateName(
  locale: Locale,
  name_en: string | null | undefined,
  name_gr: string | null | undefined,
): string {
  if (locale === 'gr') return name_gr || name_en || '';
  return name_en || name_gr || '';
}
