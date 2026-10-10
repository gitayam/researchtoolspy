/**
 * Price and currency parsing for display text ("$1,234.56", "1.234,56 €",
 * "Rp 31.500", "Save 20% now $15.99").
 *
 * The number-extraction and decimal-separator algorithm, the "Free" → 0 rule,
 * the euro-as-decimal-separator case and the currency symbol lists are ported
 * from scrapinghub/price-parser (price_parser/parser.py and _currencies.py,
 * commit 6718bfe), with these changes:
 *   - the number adjacent to a currency symbol wins over the first number
 *     (price-parser's own FIXME), and a leading "Was …/RRP …" segment is
 *     dropped when a later "Now …/Sale …" segment exists;
 *   - a dash directly attached to the number ("-5", "$-5") makes it negative,
 *     which is rejected;
 *   - currencies with three minor digits (KWD, BHD, OMR, JOD, TND, IQD, LYD)
 *     read "1.250" as a decimal;
 *   - symbols are mapped to ISO 4217 codes, with non-unique symbols ($, kr, ¥,
 *     Rs, C$, ريال) flagged as ambiguous and resolved from page hints.
 *
 * Structured numeric fields (JSON-LD, Shopify/Woo/Magento JSON) are `.`-decimal
 * by specification; use {@link parseStructuredPrice} for them so that "1.299"
 * stays 1.299 instead of being read as a thousands-grouped 1299.
 *
 * ---------------------------------------------------------------------------
 * Portions derived from price-parser:
 *
 * Copyright (c) Scrapinghub
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 *     1. Redistributions of source code must retain the above copyright notice,
 *        this list of conditions and the following disclaimer.
 *
 *     2. Redistributions in binary form must reproduce the above copyright
 *        notice, this list of conditions and the following disclaimer in the
 *        documentation and/or other materials provided with the distribution.
 *
 *     3. Neither the name of ScrapingHub nor the names of its contributors may be used
 *        to endorse or promote products derived from this software without
 *        specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * ---------------------------------------------------------------------------
 */
import { decodeHtmlEntities } from './article-extractor'

export interface PriceHint {
  /** The page's decimal separator, from platform data (Magento priceFormat, Woo Store API, Shopify money_format). */
  decimalSeparator?: '.' | ',' | null
  /** ISO code of the price's currency, when known. Three-minor-digit currencies change how "1.250" reads. */
  currency?: string | null
}

export interface CurrencyHint {
  /** An explicit ISO code the page states elsewhere (priceCurrency, Shopify.currency.active, Woo currency_code). */
  code?: string | null
  /** `<html lang>` value, e.g. "en-CA", "nb". */
  lang?: string | null
  /** Page hostname, used only for its country TLD. */
  hostname?: string | null
}

export interface CurrencyInfo {
  /** ISO 4217 code. */
  code: string
  /** The symbol or code as written. */
  raw: string
  /**
   * True when the code came from a symbol shared by several currencies ($, kr, ¥, Rs)
   * and no explicit code on the page confirmed it. A language/TLD guess stays ambiguous.
   */
  ambiguous: boolean
}

const WORD_LIKE_CODES = new Set(['ALL', 'CUP', 'TOP', 'MAD', 'BAM', 'PEN', 'SOS', 'GEL', 'TRY', 'AMD', 'BOB', 'MOP', 'LAK', 'CVE', 'ERN'])

const THREE_MINOR_DIGIT_CURRENCIES = new Set(['KWD', 'BHD', 'OMR', 'JOD', 'TND', 'IQD', 'LYD'])

/** ISO 4217 codes recognised when written in uppercase in free text. */
const ISO_CODES = new Set((
  'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD '
  + 'CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF '
  + 'GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP '
  + 'LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN '
  + 'PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLL SOS SRD SSP SVC SYP SZL THB TJS '
  + 'TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW'
).split(' '))

/**
 * Symbol → ISO code. A list of codes means the symbol is shared; the first is the default.
 * Order matters: longer and more specific symbols come first ("US$" before "$").
 * `word: true` symbols must not touch other letters ("kr" must not match inside "Kraken").
 */
interface SymbolEntry { symbol: string; codes: string[]; word?: boolean }

const CURRENCY_SYMBOLS: SymbolEntry[] = [
  // Prefixed dollars (price-parser SAFE_CURRENCY_SYMBOLS).
  { symbol: 'Bds$', codes: ['BBD'] }, { symbol: 'CUC$', codes: ['CUC'] }, { symbol: 'MOP$', codes: ['MOP'] },
  { symbol: 'US$', codes: ['USD'] }, { symbol: 'AR$', codes: ['ARS'] }, { symbol: 'AU$', codes: ['AUD'] },
  { symbol: 'BN$', codes: ['BND'] }, { symbol: 'BZ$', codes: ['BZD'] }, { symbol: 'CA$', codes: ['CAD'] },
  { symbol: 'CL$', codes: ['CLP'] }, { symbol: 'CO$', codes: ['COP'] }, { symbol: 'CV$', codes: ['CVE'] },
  { symbol: 'HK$', codes: ['HKD'] }, { symbol: 'MX$', codes: ['MXN'] }, { symbol: 'NT$', codes: ['TWD'] },
  { symbol: 'NZ$', codes: ['NZD'] }, { symbol: 'TT$', codes: ['TTD'] }, { symbol: 'RD$', codes: ['DOP'] },
  { symbol: 'WS$', codes: ['WST'] }, { symbol: '$U', codes: ['UYU'] }, { symbol: 'R$', codes: ['BRL'] },
  { symbol: 'S$', codes: ['SGD'] }, { symbol: 'A$', codes: ['AUD'] }, { symbol: 'J$', codes: ['JMD'] },
  { symbol: 'N$', codes: ['NAD'] }, { symbol: 'T$', codes: ['TOP'] }, { symbol: 'Z$', codes: ['ZWL'] },
  { symbol: 'C$', codes: ['CAD', 'NIO'] },
  { symbol: 'SY£', codes: ['SYP'] }, { symbol: 'LB£', codes: ['LBP'] }, { symbol: 'E£', codes: ['EGP'] },
  { symbol: 'CN¥', codes: ['CNY'] }, { symbol: 'GH₵', codes: ['GHS'] },
  // Unique symbols.
  { symbol: '€', codes: ['EUR'] }, { symbol: '£', codes: ['GBP'] }, { symbol: '₹', codes: ['INR'] },
  { symbol: '₩', codes: ['KRW'] }, { symbol: '원', codes: ['KRW'] }, { symbol: '₽', codes: ['RUB'] },
  { symbol: '₪', codes: ['ILS'] }, { symbol: '₫', codes: ['VND'] }, { symbol: '฿', codes: ['THB'] },
  { symbol: '₴', codes: ['UAH'] }, { symbol: '₱', codes: ['PHP'] }, { symbol: '₺', codes: ['TRY'] },
  { symbol: '₦', codes: ['NGN'] }, { symbol: '₸', codes: ['KZT'] }, { symbol: '₼', codes: ['AZN'] },
  { symbol: '֏', codes: ['AMD'] }, { symbol: '₾', codes: ['GEL'] }, { symbol: '₡', codes: ['CRC'] },
  { symbol: '₲', codes: ['PYG'] }, { symbol: '₭', codes: ['LAK'] }, { symbol: '₮', codes: ['MNT'] },
  { symbol: '৳', codes: ['BDT'] }, { symbol: '؋', codes: ['AFN'] }, { symbol: '៛', codes: ['KHR'] },
  { symbol: '₨', codes: ['PKR', 'SCR'] }, { symbol: '円', codes: ['JPY'] }, { symbol: '元', codes: ['CNY'] },
  { symbol: '¥', codes: ['JPY', 'CNY'] }, { symbol: '￥', codes: ['JPY', 'CNY'] },
  { symbol: 'ƒ', codes: ['ANG', 'AWG'] }, { symbol: 'đ', codes: ['VND'] }, { symbol: '﷼', codes: ['IRR'] },
  { symbol: 'र', codes: ['INR'] }, { symbol: 'S/.', codes: ['PEN'] }, { symbol: 'B/.', codes: ['PAB'] },
  { symbol: 'руб', codes: ['RUB'] },
  // Arabic-script abbreviations.
  { symbol: 'د.إ', codes: ['AED'] }, { symbol: 'ر.س', codes: ['SAR'] }, { symbol: 'ر.ق', codes: ['QAR'] },
  { symbol: 'د.ك', codes: ['KWD'] }, { symbol: 'ر.ع', codes: ['OMR'] }, { symbol: 'د.ب', codes: ['BHD'] },
  { symbol: 'د.أ', codes: ['JOD'] }, { symbol: 'ج.م', codes: ['EGP'] }, { symbol: 'تومان', codes: ['IRR'] },
  { symbol: 'ریال', codes: ['IRR'] }, { symbol: 'ريال', codes: ['SAR', 'IRR', 'QAR', 'OMR', 'YER'] },
  { symbol: 'درهم', codes: ['AED', 'MAD'] }, { symbol: 'جنيه', codes: ['EGP', 'SDG'] },
  // Word abbreviations (need letter boundaries).
  { symbol: 'zł', codes: ['PLN'], word: true }, { symbol: 'Zł', codes: ['PLN'], word: true },
  { symbol: 'zl', codes: ['PLN'], word: true }, { symbol: 'pln', codes: ['PLN'], word: true },
  { symbol: 'Kč', codes: ['CZK'], word: true }, { symbol: 'Ft', codes: ['HUF'], word: true },
  { symbol: 'Rp', codes: ['IDR'], word: true }, { symbol: 'lei', codes: ['RON'], word: true },
  { symbol: 'Lei', codes: ['RON'], word: true }, { symbol: 'LEI', codes: ['RON'], word: true },
  { symbol: 'leu', codes: ['RON'], word: true }, { symbol: 'TL', codes: ['TRY'], word: true },
  { symbol: 'RM', codes: ['MYR'], word: true }, { symbol: 'KD', codes: ['KWD'], word: true },
  { symbol: 'Rs', codes: ['INR', 'PKR', 'LKR', 'NPR'], word: true }, { symbol: 'Fr.', codes: ['CHF'], word: true },
  { symbol: 'kr', codes: ['SEK', 'NOK', 'DKK', 'ISK'], word: true },
  { symbol: 'Kr', codes: ['SEK', 'NOK', 'DKK', 'ISK'], word: true },
  { symbol: 'Lek', codes: ['ALL'], word: true }, { symbol: "so'm", codes: ['UZS'], word: true },
  { symbol: 'kn', codes: ['HRK'], word: true }, { symbol: 'euro', codes: ['EUR'], word: true },
  { symbol: 'eur', codes: ['EUR'], word: true },
  { symbol: 'грн', codes: ['UAH'], word: true }, { symbol: 'Br', codes: ['BYN', 'ETB'], word: true },
  { symbol: 'KM', codes: ['BAM'], word: true }, { symbol: 'BD', codes: ['BHD'], word: true },
  { symbol: 'FCFA', codes: ['XAF'], word: true }, { symbol: 'CFA', codes: ['XOF', 'XAF'], word: true },
  { symbol: 'Bs', codes: ['BOB', 'VES'], word: true }, { symbol: 'DT', codes: ['TND'], word: true },
  { symbol: 'Nu.', codes: ['BTN'], word: true }, { symbol: 'LD', codes: ['LYD'], word: true },
  { symbol: 'MK', codes: ['MWK'], word: true }, { symbol: 'TSh', codes: ['TZS'], word: true },
  { symbol: 'USh', codes: ['UGX'], word: true }, { symbol: 'лв', codes: ['BGN'], word: true },
  { symbol: 'дин', codes: ['RSD'], word: true }, { symbol: 'Dinara', codes: ['RSD'], word: true },
  { symbol: 'динар', codes: ['RSD'], word: true }, { symbol: 'тңг', codes: ['KZT'], word: true },
  { symbol: 'ман', codes: ['AZN'], word: true }, { symbol: 'р.', codes: ['RUB'], word: true },
  { symbol: 'Р', codes: ['RUB'], word: true }, { symbol: 'р', codes: ['RUB'], word: true },
  { symbol: '$', codes: ['USD', 'CAD', 'AUD', 'NZD', 'HKD', 'SGD', 'MXN', 'ARS', 'CLP', 'COP'] },
]

const COUNTRY_CURRENCY: Record<string, string> = {
  us: 'USD', ca: 'CAD', au: 'AUD', nz: 'NZD', hk: 'HKD', sg: 'SGD', mx: 'MXN', ar: 'ARS', cl: 'CLP', co: 'COP',
  se: 'SEK', no: 'NOK', dk: 'DKK', is: 'ISK', jp: 'JPY', cn: 'CNY', in: 'INR', pk: 'PKR', lk: 'LKR', np: 'NPR',
  sa: 'SAR', ir: 'IRR', qa: 'QAR', om: 'OMR', ye: 'YER', ae: 'AED', ma: 'MAD', eg: 'EGP', sd: 'SDG', ni: 'NIO',
}
const LANGUAGE_CURRENCY: Record<string, string> = {
  sv: 'SEK', nb: 'NOK', nn: 'NOK', no: 'NOK', da: 'DKK', is: 'ISK', ja: 'JPY', zh: 'CNY', fa: 'IRR',
}

const LETTER = /\p{L}/u
const symbolPatterns = CURRENCY_SYMBOLS.map(entry => ({
  entry,
  pattern: new RegExp(
    entry.word
      ? `(?<!\\p{L})${escapeRegex(entry.symbol)}(?!\\p{L})`
      : escapeRegex(entry.symbol),
    entry.word ? 'gu' : 'g',
  ),
}))

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const text = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
  return text || null
}

interface CurrencyMatch { info: CurrencyInfo; index: number; length: number }

/** Every currency token in `text`, left to right, without overlaps (longer symbols win). */
function currencyMatches(text: string): CurrencyMatch[] {
  const found: CurrencyMatch[] = []
  const taken: Array<[number, number]> = []
  const overlaps = (start: number, end: number) => taken.some(([a, b]) => start < b && end > a)
  // ISO codes first: "NZD $12" is NZD, not the bare "$" (price-parser DOLLAR_CODES priority).
  for (const match of text.matchAll(/(?<![A-Za-z])([A-Z]{3})(?![A-Za-z])/g)) {
    const code = match[1] === 'RMB' ? 'CNY' : match[1]
    if (!ISO_CODES.has(code)) continue
    const index = match.index ?? 0
    // Codes that are also common uppercase words ("ALL PRICES", "TOP SELLER") need a number beside them.
    if (WORD_LIKE_CODES.has(code)
      && !/\d\s?$/.test(text.slice(Math.max(0, index - 2), index))
      && !/^\$?\s?\d/.test(text.slice(index + 3, index + 6))) continue
    // A code glued to "$" ("SGD$123") absorbs the dollar sign.
    const length = text[index + 3] === '$' ? 4 : 3
    found.push({ info: { code, raw: text.slice(index, index + length), ambiguous: false }, index, length })
    taken.push([index, index + length])
  }
  for (const { entry, pattern } of symbolPatterns) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0
      const end = index + match[0].length
      if (overlaps(index, end)) continue
      // Single-letter roubles (Р/р) only count right next to a number.
      if (entry.symbol.length === 1 && LETTER.test(entry.symbol)
        && !/\d\s?$/.test(text.slice(Math.max(0, index - 2), index))
        && !/^\s?\d/.test(text.slice(end, end + 2))) continue
      found.push({
        info: { code: entry.codes[0], raw: match[0], ambiguous: entry.codes.length > 1 },
        index,
        length: match[0].length,
      })
      taken.push([index, end])
    }
  }
  return found.sort((a, b) => a.index - b.index)
}

function resolveAmbiguous(info: CurrencyInfo, hint: CurrencyHint | undefined): CurrencyInfo {
  if (!info.ambiguous) return info
  const entry = CURRENCY_SYMBOLS.find(e => e.symbol === info.raw || e.symbol.toLowerCase() === info.raw.toLowerCase())
  const codes = entry?.codes ?? [info.code]
  const explicit = hint?.code?.toUpperCase()
  if (explicit && codes.includes(explicit)) return { ...info, code: explicit, ambiguous: false }
  const lang = hint?.lang?.toLowerCase().split(/[-_]/) ?? []
  const fromRegion = lang[1] ? COUNTRY_CURRENCY[lang[1]] : undefined
  const fromLanguage = lang[0] ? LANGUAGE_CURRENCY[lang[0]] : undefined
  const tld = hint?.hostname?.toLowerCase().match(/\.([a-z]{2})$/)?.[1]
  const fromTld = tld ? COUNTRY_CURRENCY[tld] ?? (tld === 'uk' ? 'GBP' : undefined) : undefined
  for (const guess of [fromRegion, fromLanguage, fromTld]) {
    if (guess && codes.includes(guess)) return { ...info, code: guess }
  }
  return info
}

/**
 * ISO 4217 currency of a code or display string, with the symbol as written and
 * whether the symbol was ambiguous. A whole-value code is accepted in any case
 * ("eur"); inside longer text only uppercase codes count, so "All prices" is not ALL.
 */
export function detectCurrencyInfo(value: unknown, hint?: CurrencyHint): CurrencyInfo | null {
  const text = cleanText(value)
  if (!text) return null
  const whole = text.toUpperCase()
  if (/^[A-Z]{3}$/.test(whole) && (ISO_CODES.has(whole) || whole === 'RMB')) {
    return { code: whole === 'RMB' ? 'CNY' : whole, raw: text, ambiguous: false }
  }
  const matches = currencyMatches(text)
  const first = matches[0]
  if (!first) return null
  if (first.info.ambiguous) {
    // "$45 CAD", "SGD 5$": an ISO code elsewhere in the text settles a shared symbol.
    const entry = CURRENCY_SYMBOLS.find(e => e.symbol === first.info.raw)
    const code = matches.find(m => !m.info.ambiguous && /^[A-Z]{3}\$?$/.test(m.info.raw) && entry?.codes.includes(m.info.code))
    if (code) return { code: code.info.code, raw: first.info.raw, ambiguous: false }
  }
  return resolveAmbiguous(first.info, hint)
}

/** ISO 4217 code from an explicit code or a currency symbol in free text. */
export function detectCurrency(value: unknown, hint?: CurrencyHint): string | null {
  return detectCurrencyInfo(value, hint)?.code ?? null
}

/* ------------------------------------------------------------------ */
/* Amounts                                                             */
/* ------------------------------------------------------------------ */

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

const STRUCTURED_NUMBER = /^\s*\d+(?:\.\d+)?\s*$/

/**
 * Parse a price from a structured field (JSON-LD, microdata `content`, platform
 * JSON). Numbers and plain `.`-decimal strings are taken literally; anything
 * else (a site that wrote "5,49" or "$12.99" into a structured field) falls
 * back to the display-text parser.
 */
export function parseStructuredPrice(value: unknown, hint?: PriceHint): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? round2(value) : null
  if (typeof value === 'string' && STRUCTURED_NUMBER.test(value)) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? round2(parsed) : null
  }
  // "Free" → 0 is a display-text convention; a structured price field needs digits.
  if (typeof value === 'string' && !/\d/.test(value)) return null
  return parsePrice(value, hint)
}

interface NumberCandidate { text: string; start: number; end: number }

/** Number-looking runs that are not followed by "%" (price-parser `extract_price_text`). */
function numberCandidates(text: string): NumberCandidate[] {
  const out: NumberCandidate[] = []
  for (const match of text.matchAll(/[.]?\d[\d\s.,']*/g)) {
    const start = match.index ?? 0
    const raw = match[0].replace(/[\s.,']+$/, '')
    const end = start + raw.length
    if (/^\s*%/.test(text.slice(end))) continue
    out.push({ text: raw, start, end })
  }
  return out
}

/** The euro-as-decimal-separator form: "35€99", "35€ 99", "1,235€ 99". */
function euroDecimal(text: string): string | null {
  if ((text.match(/€/g) ?? []).length !== 1) return null
  const match = text.match(/[\d\s.,']*?\d\s*?€(?:\s*\d{2}(?!\d)|\d+)/)
  return match ? match[0].replace(/\s/g, '') : null
}

/** price-parser `get_decimal_separator`: the last separator followed by 1–2 or 4+ digits. */
function decimalSeparatorOf(num: string): string | null {
  const match = num.match(/([.,€])(?:\d{1,2}|\d{4,})$/)
  return match ? match[1] : null
}

function parseNumber(raw: string, hint?: PriceHint): number | null {
  let num = raw.replace(/[\s']/g, '')
  if (!num) return null
  if (num.split('.').length !== 2) num = num.replace(/^[,.]+/, '')
  let separator: string | null = hint?.decimalSeparator ?? decimalSeparatorOf(num)
  if (!hint?.decimalSeparator && separator === null && hint?.currency
    && THREE_MINOR_DIGIT_CURRENCIES.has(hint.currency.toUpperCase())) {
    const lone = num.match(/^\d+(?:,\d{3})*\.(\d{3})$/)
    if (lone) separator = '.'
  }
  if (separator === null) num = num.replace(/[.,]/g, '')
  else if (separator === '.') num = num.replace(/,/g, '')
  else if (separator === ',') num = num.replace(/\./g, '').replace(',', '.').replace(/,/g, '')
  else num = num.replace(/[.,]/g, '').replace('€', '.')
  if (!/^\d*\.?\d+$/.test(num) && !/^\d+\.?$/.test(num)) return null
  const parsed = Number(num)
  return Number.isFinite(parsed) && parsed >= 0 ? round2(parsed) : null
}

/** Drop a leading list-price segment when a sale segment follows: "Was $20 Now $15" → "$15". */
function stripListPricePrefix(text: string): string {
  const match = text.match(/\b(?:now|sale(?: price)?|our price|special price|offer price|you pay)\b\s*:?\s*(.*\d.*)$/i)
  if (!match) return text
  const before = text.slice(0, match.index)
  if (!/\b(?:was|rrp|list(?: price)?|msrp|reg(?:ular)?(?: price)?|retail|original)\b[^\d]*\d/i.test(before)) return text
  // A "Now $0.00" sale segment is a broken template more often than a real price.
  return /^\D*0+(?:[.,]0+)?\D*$/.test(match[1]) ? text : match[1]
}

/**
 * Parse a price in major units from a number or display string.
 *
 * "$1,234.56", "1.234,56 €", "1 234,56", "12,5", "1'234.50", "USD 19.99",
 * "Rp 31.500" (31500: a separator followed by exactly three digits groups
 * thousands), ".75 €", "35€ 99", "Free!" (0). A number followed by "%" is never
 * the price, and when several numbers appear the one next to a currency symbol
 * wins. Returns null for anything that is not a finite, non-negative amount.
 */
export function parsePrice(value: unknown, hint?: PriceHint): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? round2(value) : null
  if (typeof value !== 'string') return null
  const original = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
  if (!original) return null
  const text = stripListPricePrefix(original)

  const euro = euroDecimal(text)
  if (euro) {
    const parsed = parseNumber(euro, hint)
    if (parsed !== null) return parsed
  }

  const candidates = numberCandidates(text)
  if (candidates.length === 0) return /free/i.test(text) ? 0 : null

  let chosen = candidates[0]
  if (candidates.length > 1) {
    const currencies = currencyMatches(text)
    const adjacent = candidates.find(candidate => currencies.some(c =>
      (c.index + c.length <= candidate.start && /^\s?-?\s?$/.test(text.slice(c.index + c.length, candidate.start)))
      || (c.index >= candidate.end && /^\s?$/.test(text.slice(candidate.end, c.index)))))
    if (adjacent) chosen = adjacent
    // "From 26 to 50 €", "$10 – $20": the low end of a range, not the end the symbol sits on.
    for (let i = candidates.indexOf(chosen); i > 0; i--) {
      const between = text.slice(candidates[i - 1].end, candidates[i].start)
      if (!/^\s*\D{0,4}?\s*(?:-|–|—|to|bis|à|a|до)\s*\D{0,4}\s*$/i.test(between)) break
      chosen = candidates[i - 1]
    }
  }

  // "-5", "$-5", "-$5" are negative; "Price-$5" (punctuation) and "- $44.99" (decoration) are not.
  if (/(^|[^\p{L}\d])-\S{0,4}$/u.test(text.slice(0, chosen.start))
    && !/\s/.test(text.slice(text.lastIndexOf('-', chosen.start), chosen.start))) return null

  const hintCurrency = hint?.currency ?? (hint?.decimalSeparator ? null : detectCurrency(text))
  return parseNumber(chosen.text, { ...hint, currency: hintCurrency })
}
