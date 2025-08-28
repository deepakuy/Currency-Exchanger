// DOM Elements
const form = document.getElementById('converter-form');
const amountInput = document.getElementById('amount');
const fromCurrencySelect = document.getElementById('from-currency');
const toCurrencySelect = document.getElementById('to-currency');
const swapButton = document.getElementById('swap-currencies');
const resultElement = document.getElementById('result');
const exchangeRateElement = document.getElementById('exchange-rate');

// Sample exchange rates (in a real app, you would fetch these from an API)
const exchangeRates = {
    USD: { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150.25, AUD: 1.52 },
    EUR: { USD: 1.09, EUR: 1, GBP: 0.86, JPY: 163.50, AUD: 1.66 },
    GBP: { USD: 1.27, EUR: 1.16, GBP: 1, JPY: 190.50, AUD: 1.93 },
    JPY: { USD: 0.0067, EUR: 0.0061, GBP: 0.0052, JPY: 1, AUD: 0.0101 },
    AUD: { USD: 0.66, EUR: 0.60, GBP: 0.52, JPY: 99.01, AUD: 1 }
};

// Format currency
function formatCurrency(amount, currency) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Update exchange rate display
function updateExchangeRate() {
    const fromCurrency = fromCurrencySelect.value;
    const toCurrency = toCurrencySelect.value;
    
    if (fromCurrency === toCurrency) {
        exchangeRateElement.textContent = '1.00';
        return '1.00';
    }
    
    const rate = exchangeRates[fromCurrency][toCurrency];
    exchangeRateElement.textContent = rate.toFixed(6);
    return rate;
}

// Convert currency
function convert() {
    const amount = parseFloat(amountInput.value);
    const fromCurrency = fromCurrencySelect.value;
    const toCurrency = toCurrencySelect.value;
    
    if (isNaN(amount) || amount < 0) {
        resultElement.textContent = '-';
        return;
    }
    
    if (fromCurrency === toCurrency) {
        resultElement.textContent = formatCurrency(amount, toCurrency);
        return;
    }
    
    const rate = exchangeRates[fromCurrency][toCurrency];
    const result = amount * rate;
    resultElement.textContent = formatCurrency(result, toCurrency);
    
    // Update exchange rate display
    updateExchangeRate();
}

// Swap currencies
function swapCurrencies() {
    const temp = fromCurrencySelect.value;
    fromCurrencySelect.value = toCurrencySelect.value;
    toCurrencySelect.value = temp;
    convert();
}

// Event Listeners
form.addEventListener('submit', (e) => {
    e.preventDefault();
    convert();
});

amountInput.addEventListener('input', convert);
fromCurrencySelect.addEventListener('change', convert);
toCurrencySelect.addEventListener('change', convert);
swapButton.addEventListener('click', swapCurrencies);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set initial exchange rate
    updateExchangeRate();
    
    // Focus amount input on page load
    amountInput.focus();
});

// Accessibility: Add keyboard navigation for the swap button
swapButton.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        swapCurrencies();
    }
});
