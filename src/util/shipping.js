const PO_BOX_PATTERN = /\b(?:p\.?\s*o\.?\s*box|post\s*office\s*box)\b/i;

export const MIN_SHIPPING_PHONE_ALPHANUMERIC = 10;

/**
 * Envia rejects label buy when a phone has fewer than 10 letters or digits.
 *
 * @param {string} phone
 * @returns {boolean}
 */
export const isValidShippingPhone = phone =>
  String(phone || '').replace(/[^A-Za-z0-9]/g, '').length >= MIN_SHIPPING_PHONE_ALPHANUMERIC;

const US_STATE_CODES = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'AS',
  'GU',
  'MP',
  'PR',
  'VI',
  'AA',
  'AE',
  'AP',
]);

const US_STATE_NAMES = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  'washington dc': 'DC',
  'washington d c': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'american samoa': 'AS',
  guam: 'GU',
  'northern mariana islands': 'MP',
  'puerto rico': 'PR',
  'virgin islands': 'VI',
  'us virgin islands': 'VI',
  'u s virgin islands': 'VI',
  'armed forces americas': 'AA',
  'armed forces europe': 'AE',
  'armed forces pacific': 'AP',
};

/**
 * Map a US state name or common variant to a 2-letter code.
 * Pass through values that are already a valid code.
 *
 * @param {string} state
 * @returns {string}
 */
export const normalizeUsStateCode = state => {
  if (state == null) {
    return '';
  }
  const trimmed = String(state).trim();
  if (!trimmed) {
    return '';
  }
  const upper = trimmed.toUpperCase();
  if (US_STATE_CODES.has(upper)) {
    return upper;
  }
  const compact = upper.replace(/[^A-Z]/g, '');
  if (compact.length === 2 && US_STATE_CODES.has(compact)) {
    return compact;
  }
  const nameKey = trimmed
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return US_STATE_NAMES[nameKey] || trimmed;
};

/**
 * True when Origin address has every field Envia needs.
 *
 * @param {Object} origin
 * @returns {boolean}
 */
export const isOriginComplete = origin => {
  if (!origin) {
    return false;
  }
  const required = ['name', 'phone', 'street', 'city', 'state', 'postalCode'];
  return (
    required.every(key => typeof origin[key] === 'string' && origin[key].trim().length > 0) &&
    isValidShippingPhone(origin.phone)
  );
};

export const originFromCurrentUser = currentUser =>
  currentUser?.attributes?.profile?.privateData?.originAddress || null;

/**
 * True when text looks like a US PO Box.
 *
 * @param {Object} address
 * @returns {boolean}
 */
export const isPoBoxAddress = address => {
  const fields = [address?.street, address?.line1, address?.line2, address?.city]
    .filter(Boolean)
    .join(' ');
  return PO_BOX_PATTERN.test(fields);
};

/**
 * Build a public city, state string from a Mapbox place or formatted address.
 *
 * @param {Object} place
 * @returns {string}
 */
export const publicLocationAddress = place => {
  if (place?.city && place?.state) {
    return `${place.city}, ${place.state}`;
  }
  const formatted = place?.address || '';
  const parts = formatted
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    const maybeCountry = parts[parts.length - 1];
    const stateZip = parts[parts.length - 2];
    const city = parts[parts.length - 3];
    const state = (stateZip.match(/^([A-Za-z]{2})\b/) || stateZip.match(/^([A-Za-z]+)/) || [])[1];
    if (city && state && /united states|usa/i.test(maybeCountry)) {
      return `${city}, ${state}`;
    }
    if (city && state) {
      return `${city}, ${state}`;
    }
  }
  return formatted;
};

export const pickupAddressFromPlace = (place, building) => ({
  street: place?.street || place?.address || '',
  city: place?.city || '',
  state: place?.state || '',
  postalCode: place?.postalCode || '',
  building: building || '',
});

/**
 * Structured address fields from a geocoder place.
 * State is normalized to a US 2-letter code when possible.
 *
 * @param {Object} place
 * @returns {{street: string, city: string, state: string, postalCode: string}}
 */
export const addressFieldsFromPlace = place => ({
  street: place?.street || (place?.address || '').split(',')[0].trim(),
  city: place?.city || '',
  state: normalizeUsStateCode(place?.state),
  postalCode: place?.postalCode || '',
});

/**
 * Structured origin fields from a geocoder place.
 *
 * @param {Object} place
 * @returns {{street: string, city: string, state: string, postalCode: string}}
 */
export const originFieldsFromPlace = addressFieldsFromPlace;

/**
 * Street line from a LocationAutocompleteInput field value.
 *
 * @param {Object|string} location
 * @returns {string}
 */
export const streetFromLocationField = location => {
  if (!location) {
    return '';
  }
  if (typeof location === 'string') {
    return location.trim();
  }
  if (location.selectedPlace?.street) {
    return location.selectedPlace.street.trim();
  }
  return (location.search || '').trim();
};

export const destinationFromCheckoutValues = values => {
  const street =
    (typeof values.recipientAddressLine1 === 'string' && values.recipientAddressLine1.trim()) ||
    streetFromLocationField(values.recipientLocation);
  return {
    name: values.recipientName,
    phone: values.recipientPhoneNumber,
    street,
    line1: street,
    line2: values.recipientAddressLine2,
    city: values.recipientCity,
    state: values.recipientState,
    postalCode: values.recipientPostal,
    country: values.recipientCountry || 'US',
  };
};

export const isCheckoutDestinationComplete = dest =>
  ['name', 'phone', 'street', 'city', 'state', 'postalCode'].every(
    key => typeof dest?.[key] === 'string' && dest[key].trim().length > 0
  ) && isValidShippingPhone(dest.phone);
