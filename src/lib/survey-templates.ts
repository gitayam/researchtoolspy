/**
 * The built-in survey templates offered when creating a survey drop (SurveyListPage).
 *
 * Kept apart from the page so the tests can load them: a tip filed into a COP is titled
 * from its long-text answer (or a field marked `summary`), never from a short field
 * (functions/api/_shared/cop-ingest.ts tipTitle), and every template here has one.
 */
import type { IntakeFormField } from '@/types/cop'

export interface SurveyTemplate {
  id: string
  name: string
  description: string
  defaultTitle: string
  defaultDescription: string
  fields: IntakeFormField[]
}

// ── Survey templates ────────────────────────────────────────────

// Templates are contributor-facing forms. The survey creator picks a template,
// gives it a title (e.g., "Down Pilot Near Kherson"), and shares the link.
// Contributors fill in these fields. The description on the survey provides context.
export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'tip-line',
    name: 'Tip Line',
    description: 'Anonymous tip collection — share the link publicly',
    defaultTitle: 'Submit a Tip',
    defaultDescription: 'Help us by reporting what you know. All submissions are anonymous. Do not put yourself at risk.',
    fields: [
      { name: 'report', type: 'textarea', label: 'Your report', required: true, placeholder: 'Describe what you know — who, what, where, when' },
      { name: 'source_url', type: 'url', label: 'Source link', required: false, placeholder: 'Link to post, article, or video if applicable' },
      { name: 'location', type: 'geopoint', label: 'Related location', required: false, help_text: 'Paste a Google Maps link, coordinates, or MGRS' },
      { name: 'confidence', type: 'rating', label: 'Confidence', required: false, help_text: '1 = heard a rumor, 5 = witnessed firsthand' },
      { name: 'evidence', type: 'file', label: 'Evidence (photo/screenshot)', required: false, accept: 'image/*', help_text: 'Max 5 MB' },
    ],
  },
  {
    id: 'sighting',
    name: 'Sighting / Incident',
    description: 'Crowdsource reports of incidents, events, or sightings from multiple sources',
    defaultTitle: 'Report a Sighting',
    defaultDescription: 'Submit what you saw, found online, or heard about a reported incident. Include location and time if possible. Links to articles, posts, and channels are just as valuable as firsthand accounts.',
    fields: [
      { name: 'what_happened', type: 'textarea', label: 'What did you see or find?', required: true, placeholder: 'Describe the incident, sighting, or what the source is reporting' },
      { name: 'source_url', type: 'url', label: 'Source link', required: false, placeholder: 'Link to the article, post, channel, or video', help_text: 'Platform auto-detected from the link' },
      { name: 'location', type: 'geopoint', label: 'Location', required: false, help_text: 'Paste a Google Maps link, coordinates, or MGRS' },
      { name: 'when', type: 'datetime', label: 'When did this happen?', required: true },
      { name: 'category', type: 'select', label: 'Type', required: true, options: ['Explosion / Strike', 'Aircraft Down', 'Military Activity', 'Naval Incident', 'Vehicle Movement', 'Protest / Civil Unrest', 'Infrastructure Damage', 'Humanitarian', 'Cyber / Information', 'Other'] },
      { name: 'language', type: 'select', label: 'Language of source', required: false, options: ['English', 'Arabic', 'Farsi / Persian', 'Russian', 'Ukrainian', 'Hebrew', 'Turkish', 'French', 'Chinese', 'Other'] },
      { name: 'confidence', type: 'likert', label: 'Credibility', required: true, options: ['Unknown', 'Questionable', 'Plausible — single source', 'Credible — multiple sources', 'Official or firsthand'] },
      { name: 'evidence', type: 'file', label: 'Screenshot / Photo / Video', required: false, accept: 'image/*,video/*', help_text: 'Screenshot posts before deletion. Max 5 MB.' },
    ],
  },
  {
    id: 'missing-search',
    name: 'Search & Sightings',
    description: 'Collect sighting reports and online mentions for missing persons, aircraft, vehicles, etc.',
    defaultTitle: 'Have You Seen This?',
    defaultDescription: 'We are looking for any information — firsthand sightings, social media posts, news articles, or online discussions. Every link and detail helps build the picture.',
    fields: [
      { name: 'what_you_found', type: 'textarea', label: 'What do you know?', required: true, placeholder: 'Firsthand sighting, social media post, news article, or anything relevant' },
      { name: 'source_url', type: 'url', label: 'Link (if online)', required: false, placeholder: 'Article, post, channel, or discussion thread', help_text: 'Platform auto-detected from the link' },
      { name: 'sighting_location', type: 'geopoint', label: 'Location', required: false, help_text: 'Where was it seen? Paste a map link, coordinates, or MGRS' },
      { name: 'sighting_time', type: 'datetime', label: 'When?', required: false },
      { name: 'info_type', type: 'select', label: 'Type of information', required: true, options: ['Firsthand sighting', 'Social media post', 'News article', 'Photo or video', 'Online discussion', 'Tip from someone', 'Other'] },
      { name: 'photo', type: 'file', label: 'Photo / Screenshot', required: false, accept: 'image/*', help_text: 'Screenshot posts before deletion — max 5 MB' },
      { name: 'confidence', type: 'likert', label: 'How sure are you?', required: true, options: ['Not sure — could be wrong', 'Possible match', 'Probably the right one', 'Definitely a match'] },
      { name: 'contact', type: 'text', label: 'Contact info (optional)', required: false, placeholder: 'Phone or email if you want to be reached', help_text: 'Only shared with the research team' },
    ],
  },
  {
    id: 'infra-recon',
    name: 'Infrastructure Research',
    description: 'Collect network infrastructure indicators from your team',
    defaultTitle: 'Submit Infrastructure Findings',
    defaultDescription: 'Submit IPs, domains, .onion addresses, and service details you have identified. Include screenshots of WHOIS, certificates, or service banners when possible.',
    fields: [
      { name: 'ip_address', type: 'ip_address', label: 'IP Address', required: false, placeholder: '192.168.1.1 or 192.168.1.1:8080' },
      { name: 'onion_address', type: 'onion', label: '.onion Address', required: false, placeholder: 'http://abc...xyz.onion' },
      { name: 'service_url', type: 'url', label: 'URL', required: false, placeholder: 'https:// or http://' },
      { name: 'service_type', type: 'select', label: 'Service type', required: false, options: ['Web Server', 'FTP', 'SSH', 'Mail', 'DNS', 'Database', 'C2 / RAT', 'VPN', 'Proxy', 'Crypto Miner', 'Other'] },
      { name: 'first_seen', type: 'datetime', label: 'First seen', required: false },
      { name: 'screenshot', type: 'file', label: 'Screenshot (WHOIS, cert, banner)', required: false, accept: 'image/*', help_text: 'Max 5 MB' },
      { name: 'notes', type: 'textarea', label: 'Additional details', required: false, placeholder: 'Hosting provider, related domains, certificates, WHOIS info, etc.' },
    ],
  },
  {
    id: 'social-intel',
    name: 'Social Media Collection',
    description: 'Collect social media accounts, posts, channels, and groups',
    defaultTitle: 'Submit Social Media Finds',
    defaultDescription: 'Found a relevant account, post, channel, or group? Submit it here. Screenshot before it gets deleted — content disappears fast.',
    fields: [
      { name: 'profile_url', type: 'url', label: 'Link', required: true, placeholder: 'URL to the profile, post, channel, or group', help_text: 'Platform and handle auto-detected from the link' },
      { name: 'platform', type: 'select', label: 'Platform', required: false, options: ['Twitter/X', 'Telegram', 'Discord', 'Instagram', 'TikTok', 'Reddit', 'Facebook', 'YouTube', 'VKontakte', 'LinkedIn', 'Forum', 'Other'] },
      { name: 'handle', type: 'handle', label: 'Handle / username', required: false, placeholder: '@username or channel name' },
      { name: 'content', type: 'textarea', label: 'What is this about?', required: false, placeholder: 'Copy/paste the post text, or describe what the account/channel covers' },
      { name: 'language', type: 'select', label: 'Language', required: false, options: ['English', 'Arabic', 'Farsi / Persian', 'Russian', 'Ukrainian', 'Hebrew', 'Turkish', 'French', 'Chinese', 'Other'] },
      { name: 'screenshot', type: 'file', label: 'Screenshot', required: false, accept: 'image/*', help_text: 'Archive it before deletion — max 5 MB' },
      { name: 'observed_at', type: 'datetime', label: 'Date found', required: false },
    ],
  },
  {
    id: 'financial-trail',
    name: 'Financial / Crypto',
    description: 'Track wallet addresses and transactions',
    defaultTitle: 'Submit Financial Indicators',
    defaultDescription: 'Submit crypto wallet addresses, transaction links, or financial indicators relevant to the research.',
    fields: [
      { name: 'wallet', type: 'crypto_address', label: 'Wallet address', required: true, placeholder: 'bc1q... (BTC), 0x... (ETH), 4... (XMR)' },
      { name: 'currency', type: 'select', label: 'Currency', required: true, options: ['BTC', 'ETH', 'USDT', 'XMR', 'SOL', 'USDC', 'TRX', 'Other'] },
      { name: 'tx_url', type: 'url', label: 'Transaction link', required: false, placeholder: 'Link to blockchain explorer' },
      { name: 'amount', type: 'number', label: 'Amount', required: false },
      { name: 'related_wallet', type: 'crypto_address', label: 'Connected wallet', required: false, help_text: 'Destination or source if known' },
      { name: 'context', type: 'textarea', label: 'Why is this relevant?', required: false },
    ],
  },
  {
    id: 'source-debrief',
    name: 'Source Debrief',
    description: 'Structured source reporting with NATO reliability scale',
    defaultTitle: 'Submit Source Report',
    defaultDescription: 'Submit information obtained from a source. Rate the source reliability and information credibility.',
    fields: [
      { name: 'intel', type: 'textarea', label: 'Information', required: true, placeholder: 'What was reported? Use exact wording where possible.' },
      { name: 'reliability', type: 'select', label: 'Source reliability', required: true, options: ['A - Completely Reliable', 'B - Usually Reliable', 'C - Fairly Reliable', 'D - Not Usually Reliable', 'E - Unreliable', 'F - Cannot Be Judged'] },
      { name: 'credibility', type: 'rating', label: 'Info credibility (1-5)', required: true, help_text: '1 = Improbable, 3 = Possibly True, 5 = Confirmed' },
      { name: 'country', type: 'country', label: 'Country', required: false },
      { name: 'source_url', type: 'url', label: 'Source link', required: false },
      { name: 'notes', type: 'textarea', label: 'Your notes', required: false, placeholder: 'Your assessment, context, or follow-up needed' },
    ],
  },
  {
    id: 'media-verify',
    name: 'Media Verification',
    description: 'Collect media submissions for geolocation and authenticity checks',
    defaultTitle: 'Submit Media for Verification',
    defaultDescription: 'Found an image or video that needs verification? Submit it here with any context you have about the claim.',
    fields: [
      { name: 'media_url', type: 'url', label: 'Link to the media', required: true, placeholder: 'Direct link to image, video, or post' },
      { name: 'claimed_location', type: 'geopoint', label: 'Claimed location', required: false, help_text: 'Where does the source say this was taken?' },
      { name: 'claimed_date', type: 'datetime', label: 'Claimed date', required: false },
      { name: 'context', type: 'textarea', label: 'What does this claim to show?', required: true, placeholder: 'Describe the narrative or claim attached to this media' },
      { name: 'platform', type: 'select', label: 'Found on', required: true, options: ['Twitter/X', 'Telegram', 'TikTok', 'YouTube', 'Facebook', 'Instagram', 'Reddit', 'News Site', 'Other'] },
      { name: 'red_flags', type: 'multiselect', label: 'Red flags noticed', required: false, options: ['Metadata stripped', 'Cropped/edited', 'Reverse image match', 'Old media recycled', 'AI generated', 'Deepfake', 'None'] },
      { name: 'screenshot', type: 'file', label: 'Screenshot/Archive', required: false, accept: 'image/*', help_text: 'Screenshot the post before deletion — max 5 MB' },
    ],
  },
]
