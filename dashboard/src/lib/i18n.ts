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
  sidebar_kbd_title: 'Keyboard',
  sidebar_kbd_body: 'Use 1–9 to jump between sections.',

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
  sidebar_kbd_title: 'Πληκτρολόγιο',
  sidebar_kbd_body: 'Χρησιμοποιήστε 1–9 για να μεταβείτε μεταξύ των ενοτήτων.',

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
