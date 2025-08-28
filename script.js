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

// Fetch exchange rates from API
async function fetchExchangeRates(baseCurrency) {
    try {
        const response = await fetch(`http://data.fixer.io/api/latest?access_key=${FIXER_API_KEY}&base=${baseCurrency}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error?.info || 'Failed to fetch exchange rates');
        }
        
        return data.rates;
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        return FALLBACK_RATES[baseCurrency] || null;
    }
}

// Update exchange rates
async function updateExchangeRates(baseCurrency) {
    const rates = await fetchExchangeRates(baseCurrency);
    if (rates) {
        exchangeRates[baseCurrency] = rates;
    }
    return rates;
}

// Convert currency
function convert() {
    const amount = amountInput.value.trim();
    if (!validateAmount(amount)) {
        resultElement.textContent = '-';
        resultElement.removeAttribute('data-currency');
        return;
    }

    const fromCurrency = fromCurrencySelect.value;
    const toCurrency = toCurrencySelect.value;
    const amountNum = parseFloat(amount);

    if (fromCurrency === toCurrency) {
        updateResultDisplay(amountNum, toCurrency);
        return;
    }

    const rate = exchangeRates[fromCurrency]?.[toCurrency];
    if (!rate) {
        showError('Unable to get exchange rate. Please try again.');
        return;
    }

    const result = amountNum * rate;
    updateResultDisplay(result, toCurrency);
    updateExchangeRateDisplay(rate);
}

// Update the result display
function updateResultDisplay(amount, currency) {
    const formattedAmount = formatCurrency(amount, currency);
    resultElement.textContent = formattedAmount;
    resultElement.setAttribute('data-currency', currency);
    resultElement.setAttribute('aria-live', 'polite');
}

// Update exchange rate display
function updateExchangeRateDisplay(rate) {
    exchangeRateElement.textContent = rate.toFixed(6);
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

// Populate currency dropdowns
async function populateCurrencyDropdowns() {
    try {
        const response = await fetch(FIXER_SYMBOLS_URL);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('Failed to fetch currency symbols');
        }

        const currencies = Object.entries(data.symbols);
        
        // Clear existing options except the first one (if any)
        fromCurrencySelect.innerHTML = '';
        toCurrencySelect.innerHTML = '';

        currencies.forEach(([code, name]) => {
            const option1 = document.createElement('option');
            option1.value = code;
            option1.textContent = `${code} - ${name}`;
            
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
    if (usdOption) usdOption.selected = true;

    // Set EUR as default to currency
    const eurOption = Array.from(toCurrencySelect.options).find(
        option => option.value === 'EUR'
    );
    if (eurOption) eurOption.selected = true;
}

// Initialize the application
async function init() {
    // Populate currency dropdowns
    await populateCurrencyDropdowns();
    
    // Set initial values
    await updateExchangeRates(fromCurrencySelect.value);
    
    // Set up event listeners with debouncing
    let timeoutId;
    amountInput.addEventListener('input', () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(convert, 300); // 300ms debounce
    });

    fromCurrencySelect.addEventListener('change', async (e) => {
        await updateExchangeRates(e.target.value);
        convert();
    });

    toCurrencySelect.addEventListener('change', convert);

    swapButton.addEventListener('click', swapCurrencies);
    swapButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            swapCurrencies();
        }
    });

    // Initial conversion
    convert();
    amountInput.focus();
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);