/**
 * Convert currency code to symbol.
 *
 * @param {string} currencyCode - The ISO 4217 currency code.
 * @return {string} - The currency symbol.
 */
function currencyToSymbol(currencyCode) {
    // Define the currency symbols mapping
    const currencySymbols = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥',
        'CAD': 'C$',
        'AUD': 'A$',
        'CNY': '¥',
        'HKD': 'HK$',
        'NZD': 'NZ$'
    };

    // Convert currency code to uppercase to match the keys in the dictionary
    currencyCode = currencyCode.toUpperCase();

    // Return the currency symbol if it exists in the object, otherwise return the original code
    return currencySymbols[currencyCode] || currencyCode;
}
