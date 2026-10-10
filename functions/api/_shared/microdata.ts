/**
 * A small W3C microdata reader that runs on Workers (no DOM).
 *
 * It builds the item tree from `itemscope`/`itemprop`/`itemtype` with a
 * forgiving tag tokenizer: nested items become nested values, every
 * `itemprop="offers" itemscope` is its own item, and a property without a
 * value attribute takes the element's text content. `itemref` is not followed.
 *
 * The property-value rules (meta@content, a|area|link@href, img|…@src,
 * object@data, data|meter@value, time@datetime, any @content, else text) follow
 * scrapinghub/extruct `w3cmicrodata.py` (`_extract_property_value`, commit
 * dc3bf7d), re-implemented here over a regex tokenizer.
 *
 * ---------------------------------------------------------------------------
 * Portions derived from extruct:
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
 *     3. Neither the name of extruct nor the names of its contributors may be used
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

export interface MicrodataItem {
  /** Lower-cased schema.org type names without the URL prefix ("product", "offer"). */
  types: string[]
  properties: Map<string, MicrodataValue[]>
}
export type MicrodataValue = string | MicrodataItem

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])
const MAX_ITEMS = 500
const MAX_TEXT = 2_000

interface OpenElement {
  tag: string
  /** The item this element opens (itemscope). */
  item: MicrodataItem | null
  /** A text-content property being captured on this element. */
  capture: { names: string[]; owner: MicrodataItem | null; text: string } | null
}

function attributesOf(tag: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of tag.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const name = match[1].toLowerCase()
    if (name.startsWith('<')) continue
    if (!(name in result)) result[name] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return result
}

function attributeValue(tag: string, attrs: Record<string, string>): string | null {
  if (tag === 'meta') return attrs.content ?? ''
  if (['audio', 'embed', 'iframe', 'img', 'source', 'track', 'video'].includes(tag)) return attrs.src ?? ''
  if (['a', 'area', 'link'].includes(tag)) return attrs.href ?? ''
  if (tag === 'object') return attrs.data ?? ''
  if (tag === 'data' || tag === 'meter') return attrs.value ?? ''
  if (tag === 'time' && attrs.datetime !== undefined) return attrs.datetime
  if (attrs.content) return attrs.content
  return null
}

function addProperty(owner: MicrodataItem | null, names: string[], value: MicrodataValue): void {
  if (!owner) return
  for (const name of names) {
    const list = owner.properties.get(name)
    if (list) list.push(value)
    else owner.properties.set(name, [value])
  }
}

function itemTypes(value: string | undefined): string[] {
  return (value ?? '').split(/\s+/).filter(Boolean)
    .map(type => type.replace(/^https?:\/\/schema\.org\//i, '').replace(/\/+$/, '').toLowerCase())
}

/** Top-level microdata items in document order. Never throws on malformed markup. */
export function parseMicrodata(html: string): MicrodataItem[] {
  const top: MicrodataItem[] = []
  if (!html || !/\bitemscope\b|\bitemprop\b/i.test(html)) return top
  const stack: OpenElement[] = []
  let itemCount = 0
  const currentItem = (): MicrodataItem | null => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].item) return stack[i].item
    return null
  }
  const appendText = (text: string) => {
    if (!text) return
    for (const entry of stack) {
      if (entry.capture && entry.capture.text.length < MAX_TEXT) entry.capture.text += text
    }
  }
  const finish = (entry: OpenElement) => {
    if (!entry.capture) return
    const text = decodeHtmlEntities(entry.capture.text).replace(/\s+/g, ' ').trim()
    addProperty(entry.capture.owner, entry.capture.names, text)
  }

  const token = /<!--[\s\S]*?-->|<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g
  let last = 0
  for (const match of html.matchAll(token)) {
    const index = match.index ?? 0
    if (index > last) appendText(html.slice(last, index))
    last = index + match[0].length
    if (match[1] || match[0].startsWith('<!--')) continue

    if (match[2]) {
      const tag = match[2].toLowerCase()
      let at = stack.length - 1
      while (at >= 0 && stack[at].tag !== tag) at--
      if (at < 0) continue
      while (stack.length > at) finish(stack.pop()!)
      continue
    }

    const tag = match[3].toLowerCase()
    const raw = match[4] ?? ''
    if (!/itemscope|itemprop/i.test(raw)) {
      if (!VOID_TAGS.has(tag) && !raw.trimEnd().endsWith('/')) stack.push({ tag, item: null, capture: null })
      continue
    }
    const attrs = attributesOf(raw)
    const names = (attrs.itemprop ?? '').split(/\s+/).filter(Boolean).map(name => name.toLowerCase())
    const parent = currentItem()
    const isVoid = VOID_TAGS.has(tag) || raw.trimEnd().endsWith('/')

    if ('itemscope' in attrs && itemCount < MAX_ITEMS) {
      itemCount++
      const item: MicrodataItem = { types: itemTypes(attrs.itemtype), properties: new Map() }
      if (names.length > 0 && parent) addProperty(parent, names, item)
      else top.push(item)
      if (!isVoid) stack.push({ tag, item, capture: null })
      continue
    }
    if (names.length === 0) {
      if (!isVoid) stack.push({ tag, item: null, capture: null })
      continue
    }
    const value = attributeValue(tag, attrs)
    if (value !== null || isVoid) {
      addProperty(parent, names, (value ?? '').trim())
      if (!isVoid) stack.push({ tag, item: null, capture: null })
      continue
    }
    stack.push({ tag, item: null, capture: { names, owner: parent, text: '' } })
  }
  if (last < html.length) appendText(html.slice(last))
  while (stack.length > 0) finish(stack.pop()!)
  return top
}

/** First string value of a property, or null. */
export function microdataText(item: MicrodataItem, name: string): string | null {
  for (const value of item.properties.get(name) ?? []) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/** Every nested item of a property. */
export function microdataItems(item: MicrodataItem, name: string): MicrodataItem[] {
  return (item.properties.get(name) ?? []).filter((v): v is MicrodataItem => typeof v !== 'string')
}

/** Items of the given types anywhere in the tree, outermost first. */
export function findMicrodataItems(items: MicrodataItem[], type: string, depth = 0): MicrodataItem[] {
  const out: MicrodataItem[] = []
  if (depth > 12) return out
  for (const item of items) {
    if (item.types.includes(type)) {
      out.push(item)
      continue
    }
    for (const values of item.properties.values()) {
      out.push(...findMicrodataItems(values.filter((v): v is MicrodataItem => typeof v !== 'string'), type, depth + 1))
    }
  }
  return out
}
