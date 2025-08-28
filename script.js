// DOM Elements
const form = document.getElementById('converter-form');
const amountInput = document.getElementById('amount');
const fromCurrencySelect = document.getElementById('from-currency');
const toCurrencySelect = document.getElementById('to-currency');
const swapButton = document.getElementById('swap-currencies');
const resultElement = document.getElementById('result');
const exchangeRateElement = document.getElementById('exchange-rate');
const errorElement = document.createElement('div');
errorElement.className = 'error-message';
form.appendChild(errorElement);

// Constants
const MAX_AMOUNT = 1000000000; // 1 billion
const FIXER_API_KEY = '030a65b091dfe1fd61ccf911557a91f5';
const FIXER_SYMBOLS_URL = `http://data.fixer.io/api/symbols?access_key=${FIXER_API_KEY}`;
const EXCHANGERATE_API_URL = 'https://api.exchangerate-api.com/v4/latest/';

// Fallback exchange rates (will be used if API fails)
const FALLBACK_RATES = {
    USD: { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150.25, AUD: 1.52 },
    EUR: { USD: 1.09, EUR: 1, GBP: 0.86, JPY: 163.50, AUD: 1.66 },
    GBP: { USD: 1.27, EUR: 1.16, GBP: 1, JPY: 190.50, AUD: 1.93 },
    JPY: { USD: 0.0067, EUR: 0.0061, GBP: 0.0052, JPY: 1, AUD: 0.0101 },
    AUD: { USD: 0.66, EUR: 0.60, GBP: 0.52, JPY: 99.01, AUD: 1 }
};

let exchangeRates = { ...FALLBACK_RATES };
let isLoading = false;

// Format currency with proper symbol and formatting
function formatCurrency(amount, currency) {
    return new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Show error message to user
function showError(message) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

// Validate input amount
function validateAmount(amount) {
    if (amount === '') {
        showError('Please enter an amount');
        return false;
    }
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
        showError('Please enter a valid number');
        return false;
    }
    
    if (numAmount <= 0) {
        showError('Amount must be greater than zero');
        return false;
    }
    
    if (numAmount > MAX_AMOUNT) {
        showError(`Amount must be less than ${MAX_AMOUNT.toLocaleString()}`);
        return false;
    }
    
    return true;
}

// LocalStorage keys
const RATES_CACHE_PREFIX = 'exchange_rates_';
const RATES_TIMESTAMP_PREFIX = 'rates_timestamp_';
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

// Save rates to localStorage
function saveRatesToCache(baseCurrency, rates) {
    try {
        const timestamp = Date.now();
        localStorage.setItem(`${RATES_CACHE_PREFIX}${baseCurrency}`, JSON.stringify(rates));
        localStorage.setItem(`${RATES_TIMESTAMP_PREFIX}${baseCurrency}`, timestamp.toString());
    } catch (error) {
        console.error('Error saving to cache:', error);
    }
}

// Get rates from cache if valid
function getRatesFromCache(baseCurrency) {
    try {
        const cachedRates = localStorage.getItem(`${RATES_CACHE_PREFIX}${baseCurrency}`);
        const cachedTimestamp = localStorage.getItem(`${RATES_TIMESTAMP_PREFIX}${baseCurrency}`);
        
        if (!cachedRates || !cachedTimestamp) return null;
        
        const now = Date.now();
        const cacheAge = now - parseInt(cachedTimestamp, 10);
        
        if (cacheAge > CACHE_DURATION) return null;
        
        return JSON.parse(cachedRates);
    } catch (error) {
        console.error('Error reading from cache:', error);
        return null;
    }
}

// Fetch exchange rates from API with caching
async function fetchExchangeRates(baseCurrency) {
    // Try to get rates from cache first
    const cachedRates = getRatesFromCache(baseCurrency);
    if (cachedRates) {
        console.log('Using cached exchange rates');
        return cachedRates;
    }
    
    console.log('Fetching fresh exchange rates from API');
    
    try {
        const response = await fetch(`http://data.fixer.io/api/latest?access_key=${FIXER_API_KEY}&base=${baseCurrency}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error?.info || 'Failed to fetch exchange rates');
        }
        
        // Save to cache before returning
        saveRatesToCache(baseCurrency, data.rates);
        return data.rates;
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        // Try to return cached data even if expired when API fails
        const expiredRates = getRatesFromCache(baseCurrency);
        if (expiredRates) {
            console.log('API failed, using expired cached rates');
            return expiredRates;
        }
        return FALLBACK_RATES[baseCurrency] || null;
    }
}

// Update exchange rates
async function updateExchangeRates(baseCurrency) {
    try {
        const rates = await fetchExchangeRates(baseCurrency);
        if (rates) {
            exchangeRates[baseCurrency] = rates;
            return rates;
        }
        throw new Error('Failed to update exchange rates');
    } catch (error) {
        console.error('Error updating exchange rates:', error);
        // Return cached rates if available
        return exchangeRates[baseCurrency] || null;
    }
}

// Convert currency
async function convert() {
    const amount = amountInput.value.trim();
    if (!validateAmount(amount)) {
        resultElement.textContent = '-';
        exchangeRateElement.textContent = '-';
        resultElement.removeAttribute('data-currency');
        return;
    }

    const fromCurrency = fromCurrencySelect.value;
    const toCurrency = toCurrencySelect.value;
    const amountNum = parseFloat(amount);

    if (fromCurrency === toCurrency) {
        updateResultDisplay(amountNum, toCurrency);
        updateExchangeRateDisplay(1);
        return;
    }

    try {
        // Show loading state
        resultElement.textContent = '...';
        exchangeRateElement.textContent = '...';
        
        // Ensure we have the latest rates
        const rates = await fetchExchangeRates(fromCurrency);
        if (!rates || !rates[toCurrency]) {
            throw new Error('Unable to get exchange rate. Please try again.');
        }
        
        const rate = rates[toCurrency];
        const result = amountNum * rate;
        
        // Update the display
        updateResultDisplay(result, toCurrency);
        updateExchangeRateDisplay(rate);
        
    } catch (error) {
        console.error('Conversion error:', error);
        showError(error.message || 'An error occurred during conversion');
        resultElement.textContent = '-';
        exchangeRateElement.textContent = '-';
    }
}

// Update the result display
function updateResultDisplay(amount, currency) {
    const formattedAmount = formatCurrency(amount, currency);
    resultElement.textContent = formattedAmount;
    resultElement.setAttribute('data-currency', currency);
    resultElement.setAttribute('aria-live', 'polite');
}

// Update exchange rate display with formatted rate
function updateExchangeRateDisplay(rate) {
    const fromCurrency = fromCurrencySelect.value;
    const toCurrency = toCurrencySelect.value;
    const formattedRate = rate.toFixed(4);
    exchangeRateElement.innerHTML = `1 ${fromCurrency} = ${formattedRate} ${toCurrency}`;
    exchangeRateElement.setAttribute('aria-live', 'polite');
}

// Swap currencies
async function swapCurrencies() {
    const temp = fromCurrencySelect.value;
    fromCurrencySelect.value = toCurrencySelect.value;
    toCurrencySelect.value = temp;
    
    // Update rates for the new base currency
    await updateExchangeRates(fromCurrencySelect.value);
    convert();
}

// Country code to flag emoji mapping
const CURRENCY_TO_FLAG = {
    'USD': '🇺🇸', // United States
    'EUR': '🇪🇺', // European Union
    'GBP': '🇬🇧', // United Kingdom
    'JPY': '🇯🇵', // Japan
    'AUD': '🇦🇺', // Australia
    'CAD': '🇨🇦', // Canada
    'CHF': '🇨🇭', // Switzerland
    'CNY': '🇨🇳', // China
    'HKD': '🇭🇰', // Hong Kong
    'NZD': '🇳🇿', // New Zealand
    'SEK': '🇸🇪', // Sweden
    'KRW': '🇰🇷', // South Korea
    'SGD': '🇸🇬', // Singapore
    'NOK': '🇳🇴', // Norway
    'MXN': '🇲🇽', // Mexico
    'INR': '🇮🇳', // India
    'BRL': '🇧🇷', // Brazil
    'RUB': '🇷🇺', // Russia
    'ZAR': '🇿🇦', // South Africa
    'TRY': '🇹🇷'  // Turkey
    // Add more mappings as needed
};

// Function to get flag emoji for a currency code
function getFlagEmoji(currencyCode) {
    return CURRENCY_TO_FLAG[currencyCode] || '🏳️';
}

// Populate currency dropdowns with flags
async function populateCurrencyDropdowns() {
    try {
        const response = await fetch(FIXER_SYMBOLS_URL);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('Failed to fetch currency symbols');
        }

        const currencies = Object.entries(data.symbols);
        
        // Clear existing options
        fromCurrencySelect.innerHTML = '';
        toCurrencySelect.innerHTML = '';

        currencies.forEach(([code, name]) => {
            const flag = getFlagEmoji(code);
            const option1 = document.createElement('option');
            option1.value = code;
            option1.textContent = `${flag} ${code} - ${name}`;
            
            const option2 = option1.cloneNode(true);
            
            fromCurrencySelect.appendChild(option1);
            toCurrencySelect.appendChild(option2);
        });

        // Set default values
        setDefaultCurrencies();
        
    } catch (error) {
        console.error('Error fetching currency symbols:', error);
        // Fallback to default currencies if API fails
        setDefaultCurrencies();
    }
}

// Set default currency selections
function setDefaultCurrencies() {
    // Set USD as default from currency
    const usdOption = Array.from(fromCurrencySelect.options).find(
        option => option.value === 'USD'
    );
    if (usdOption) {
        usdOption.selected = true;
        fromCurrencySelect.innerHTML = ''; // Clear and rebuild to ensure proper display
        fromCurrencySelect.appendChild(usdOption);
    }

    // Set EUR as default to currency
    const eurOption = Array.from(toCurrencySelect.options).find(
        option => option.value === 'EUR'
    );
    if (eurOption) {
        eurOption.selected = true;
        toCurrencySelect.innerHTML = ''; // Clear and rebuild to ensure proper display
        toCurrencySelect.appendChild(eurOption);
    }
    
    // If no options were found, add default options
    if (fromCurrencySelect.options.length === 0) {
        const defaultCurrencies = [
            { code: 'USD', name: 'US Dollar' },
            { code: 'EUR', name: 'Euro' },
            { code: 'GBP', name: 'British Pound' },
            { code: 'JPY', name: 'Japanese Yen' },
            { code: 'AUD', name: 'Australian Dollar' }
        ];
        
        defaultCurrencies.forEach(currency => {
            const flag = getFlagEmoji(currency.code);
            const option1 = document.createElement('option');
            option1.value = currency.code;
            option1.textContent = `${flag} ${currency.code} - ${currency.name}`;
            
            const option2 = option1.cloneNode(true);
            
            fromCurrencySelect.appendChild(option1);
            toCurrencySelect.appendChild(option2);
        });
        
        // Set defaults again after populating
        if (fromCurrencySelect.options.length > 0) fromCurrencySelect.options[0].selected = true;
        if (toCurrencySelect.options.length > 1) toCurrencySelect.options[1].selected = true;
    }
}

// Initialize the application
async function init() {
    try {
        // Show loading state
        resultElement.textContent = 'Loading...';
        exchangeRateElement.textContent = '...';
        
        // Populate currency dropdowns
        await populateCurrencyDropdowns();
        
        // Set initial values
        const rates = await updateExchangeRates(fromCurrencySelect.value);
        if (!rates) {
            throw new Error('Failed to load initial exchange rates');
        }
        
        // Set up form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            convert();
        });
        
        // Set up event listeners with debouncing
        let timeoutId;
        amountInput.addEventListener('input', () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                if (amountInput.value.trim() !== '') {
                    convert();
                } else {
                    resultElement.textContent = '-';
                    exchangeRateElement.textContent = '-';
                }
            }, 300);
        });
        
        fromCurrencySelect.addEventListener('change', async (e) => {
            await updateExchangeRates(e.target.value);
            if (amountInput.value.trim() !== '') {
                convert();
            }
        });
        
        toCurrencySelect.addEventListener('change', () => {
            if (amountInput.value.trim() !== '') {
                convert();
            }
        });
        
        swapButton.addEventListener('click', swapCurrencies);
        swapButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                swapCurrencies();
            }
        });
        
        // Initial conversion if there's an amount
        if (amountInput.value.trim() !== '') {
            await convert();
        } else {
            resultElement.textContent = '-';
            exchangeRateElement.textContent = '-';
        }
        
        amountInput.focus();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the application. Please refresh the page.');
    }
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);