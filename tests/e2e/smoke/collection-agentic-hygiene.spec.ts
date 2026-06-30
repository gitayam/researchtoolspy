import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'

const CALLBACK_FILE = 'functions/api/collection/callback.ts'
const APPROVE_FILE = 'functions/api/collection/[jobId]/approve.ts'

test('callback.ts — relevanceScore uses ?? not || (falsy-zero fix)', () => {
  const src = readFileSync(CALLBACK_FILE, 'utf8')
  expect(src).not.toMatch(/relevanceScore\s*\|\|\s*0\.5/)
  expect(src).toMatch(/relevanceScore\s*\?\?\s*0\.5/)
})

test('approve.ts — batch-process fetch forwards X-User-Hash auth header', () => {
  const src = readFileSync(APPROVE_FILE, 'utf8')
  expect(src).toMatch(/['"]X-User-Hash['"]/)
})
