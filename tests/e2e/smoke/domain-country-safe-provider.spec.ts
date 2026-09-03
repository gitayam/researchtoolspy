import { expect, test } from '@playwright/test'
import {
  DomainCountryInputError,
  DomainCountryProviderError,
  lookupDomainCountry,
} from '../../../functions/api/content-intelligence/domain-country'

const providerResolver = async () => ['93.184.216.34']

test.describe('domain country fixed provider @smoke', () => {
  test('@smoke validates DNS, selects one deterministic IP, and labels estimate scope', async () => {
    const calls: string[] = []
    const result = await lookupDomainCountry('https://Example.COM./article?private=query', {
      resolveTargetHostname: async () => ['2001:4860:4860::8888', '8.8.8.8', '1.1.1.1'],
      resolveProviderHostname: providerResolver,
      fetchImpl: async (input) => {
        calls.push(String(input))
        return Response.json({
          ip: '1.1.1.1',
          country: 'AU',
          city: 'South Brisbane',
          subdivision: 'QLD',
          asn: { number: 13335, organization: 'Cloudflare, Inc.' },
        })
      },
    })

    expect(calls).toEqual(['https://api.country.is/1.1.1.1?fields=city%2Csubdivision%2Casn'])
    expect(result).toMatchObject({
      domain: 'example.com',
      ip: '1.1.1.1',
      country: 'Australia',
      countryCode: 'AU',
      scope: 'resolved-ip',
      resolvedAddressCount: 3,
      sampledAddressCount: 1,
    })
    expect(result.caveat).toContain('CDNs')
  })

  test('@smoke rejects private or mixed DNS answers before provider disclosure', async () => {
    let fetchCalls = 0
    await expect(lookupDomainCountry('https://example.com/', {
      resolveTargetHostname: async () => ['93.184.216.34', '127.0.0.1'],
      resolveProviderHostname: providerResolver,
      fetchImpl: async () => {
        fetchCalls += 1
        return Response.json({})
      },
    })).rejects.toBeInstanceOf(DomainCountryInputError)
    expect(fetchCalls).toBe(0)
  })

  test('@smoke rejects a provider response for a different IP or malformed country code', async () => {
    for (const body of [
      { ip: '8.8.4.4', country: 'US' },
      { ip: '8.8.8.8', country: 'USA' },
    ]) {
      await expect(lookupDomainCountry('https://example.com/', {
        resolveTargetHostname: async () => ['8.8.8.8'],
        resolveProviderHostname: providerResolver,
        fetchImpl: async () => Response.json(body),
      })).rejects.toBeInstanceOf(DomainCountryProviderError)
    }
  })

  test('@smoke accepts a public IP literal without target DNS resolution', async () => {
    let targetDnsCalls = 0
    const result = await lookupDomainCountry('https://8.8.8.8/', {
      resolveTargetHostname: async () => {
        targetDnsCalls += 1
        return ['127.0.0.1']
      },
      resolveProviderHostname: providerResolver,
      fetchImpl: async () => Response.json({ ip: '8.8.8.8', country: 'US' }),
    })
    expect(targetDnsCalls).toBe(0)
    expect(result.ip).toBe('8.8.8.8')
  })

  test('@smoke makes pre-aborted lookup terminal before target DNS or provider work', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    let work = 0

    await expect(lookupDomainCountry('https://example.com/', {
      signal: controller.signal,
      resolveTargetHostname: async () => {
        work += 1
        return ['8.8.8.8']
      },
      resolveProviderHostname: providerResolver,
      fetchImpl: async () => {
        work += 1
        return Response.json({ ip: '8.8.8.8', country: 'US' })
      },
    })).rejects.toMatchObject({ code: 'aborted' })
    expect(work).toBe(0)
  })
})
