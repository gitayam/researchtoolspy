/**
 * @jest-environment jsdom
 */
import { APIClient } from '../api'

// Mock global fetch
global.fetch = jest.fn()

describe('Registration Error Handling', () => {
  let apiClient: APIClient
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()
    localStorage.clear()
    
    // Create new API client instance
    apiClient = new APIClient()
  })
  
  afterEach(() => {
    jest.restoreAllMocks()
  })
  
  describe('registerWithHash', () => {
    it('should handle network errors gracefully', async () => {
      // Mock fetch to simulate network error
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      // Attempt registration
      await expect(apiClient.registerWithHash()).rejects.toThrow()
    })
    
    it('should handle 500 server errors', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Database connection failed' })
      } as Response)
      
      await expect(apiClient.registerWithHash()).rejects.toMatchObject({
        status: 500,
        message: 'Database connection failed'
      })
    })
    
    it('should handle connection refused errors', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      
      await expect(apiClient.registerWithHash()).rejects.toThrow('Failed to fetch')
    })
    
    it('should successfully register when API is available', async () => {
      const mockHash = 'test-hash-12345'
      const mockResponse = {
        account_hash: mockHash,
        message: 'Hash registered successfully',
        warning: 'Save this hash - it cannot be recovered if lost',
        created_at: new Date().toISOString()
      }
      
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse
      } as Response)
      
      const result = await apiClient.registerWithHash()
      
      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/hash/register'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      )
    })
    
    it('should handle CORS errors', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockRejectedValueOnce(new TypeError('CORS error'))
      
      await expect(apiClient.registerWithHash()).rejects.toThrow('CORS error')
    })
    
    it('should handle timeout errors', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      )
      
      await expect(apiClient.registerWithHash()).rejects.toThrow('Request timeout')
    })
  })
  
  describe('Error Recovery', () => {
    it('should allow retry after network failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      await expect(apiClient.registerWithHash()).rejects.toThrow('Network error')
      
      // Second call succeeds
      const mockHash = 'retry-hash-67890'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          account_hash: mockHash,
          message: 'Hash registered successfully',
          warning: 'Save this hash',
          created_at: new Date().toISOString()
        })
      } as Response)
      
      const result = await apiClient.registerWithHash()
      expect(result.account_hash).toBe(mockHash)
    })
    
    it('should handle malformed JSON responses', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => { throw new SyntaxError('Invalid JSON') }
      } as Response)
      
      await expect(apiClient.registerWithHash()).rejects.toThrow()
    })
  })
})