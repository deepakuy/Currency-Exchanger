// Mock the fetch API and localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

global.localStorage = mockLocalStorage;
global.fetch = jest.fn();

// Import the functions we want to test
const { 
  formatCurrency, 
  validateAmount, 
  convert, 
  fetchExchangeRates,
  RATES_CACHE_PREFIX,
  RATES_TIMESTAMP_PREFIX,
  CACHE_DURATION
} = require('./script');

describe('Currency Converter', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('formatCurrency', () => {
    test('formats numbers with 2 decimal places', () => {
      expect(formatCurrency(100, 'USD')).toBe('100.00');
      expect(formatCurrency(1234.5, 'USD')).toBe('1,234.50');
      expect(formatCurrency(0.1 + 0.2, 'USD')).toBe('0.30'); // Testing floating point
    });
  });

  describe('validateAmount', () => {
    test('validates positive numbers', () => {
      expect(validateAmount('100')).toBe(true);
      expect(validateAmount('0.01')).toBe(true);
      expect(validateAmount('1000000')).toBe(true);
    });

    test('rejects invalid inputs', () => {
      expect(validateAmount('')).toBe(false);
      expect(validateAmount('abc')).toBe(false);
      expect(validateAmount('0')).toBe(false);
      expect(validateAmount('-10')).toBe(false);
      expect(validateAmount('1000000001')).toBe(false); // Above MAX_AMOUNT
    });
  });

  describe('fetchExchangeRates', () => {
    const mockRates = { USD: 1, EUR: 0.92, GBP: 0.79 };
    const mockResponse = {
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
      base: 'USD',
      rates: mockRates
    };

    test('fetches rates from API when not in cache', async () => {
      fetch.mockResolvedValueOnce({
        json: async () => mockResponse
      });

      const rates = await fetchExchangeRates('USD');
      expect(rates).toEqual(mockRates);
      expect(localStorage.setItem).toHaveBeenCalledTimes(2);
    });

    test('uses cached rates when available and fresh', async () => {
      // Set up cached data
      const cachedTimestamp = Date.now();
      localStorage.setItem(`${RATES_CACHE_PREFIX}USD`, JSON.stringify(mockRates));
      localStorage.setItem(`${RATES_TIMESTAMP_PREFIX}USD`, cachedTimestamp.toString());

      const rates = await fetchExchangeRates('USD');
      expect(rates).toEqual(mockRates);
      expect(fetch).not.toHaveBeenCalled();
    });

    test('falls back to API when cache is stale', async () => {
      // Set up stale cached data (older than CACHE_DURATION)
      const oldTimestamp = Date.now() - (CACHE_DURATION + 1000);
      localStorage.setItem(`${RATES_CACHE_PREFIX}USD`, JSON.stringify({ USD: 1, EUR: 0.9 }));
      localStorage.setItem(`${RATES_TIMESTAMP_PREFIX}USD`, oldTimestamp.toString());

      fetch.mockResolvedValueOnce({
        json: async () => mockResponse
      });

      const rates = await fetchExchangeRates('USD');
      expect(rates).toEqual(mockRates);
      expect(fetch).toHaveBeenCalled();
    });

    test('falls back to expired cache when API fails', async () => {
      const staleRates = { USD: 1, EUR: 0.9 };
      const oldTimestamp = Date.now() - (CACHE_DURATION + 1000);
      localStorage.setItem(`${RATES_CACHE_PREFIX}USD`, JSON.stringify(staleRates));
      localStorage.setItem(`${RATES_TIMESTAMP_PREFIX}USD`, oldTimestamp.toString());

      fetch.mockRejectedOnce(new Error('API Error'));

      const rates = await fetchExchangeRates('USD');
      expect(rates).toEqual(staleRates);
    });
  });

  describe('convert', () => {
    // Mock the required DOM elements and functions
    beforeEach(() => {
      document.body.innerHTML = `
        <input id="amount" value="100">
        <select id="from-currency"><option value="USD">USD</option></select>
        <select id="to-currency"><option value="EUR">EUR</option></select>
        <div id="result"></div>
        <div id="exchange-rate"></div>
      `;
      
      // Mock the global functions used in convert()
      global.showError = jest.fn();
    });

    test('performs currency conversion correctly', async () => {
      const mockRates = { USD: 1, EUR: 0.92 };
      fetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          rates: mockRates
        })
      });

      await convert();
      expect(document.getElementById('result').textContent).toBe('92.00');
      expect(document.getElementById('exchange-rate').textContent).toContain('1 USD = 0.9200 EUR');
    });

    test('shows error for invalid amount', async () => {
      document.getElementById('amount').value = 'abc';
      await convert();
      expect(showError).toHaveBeenCalled();
    });
  });
});
