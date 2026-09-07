const PO_BOX_PATTERN = /\b(?:p\.?\s*o\.?\s*box|post\s*office\s*box)\b/i;

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
  return required.every(key => typeof origin[key] === 'string' && origin[key].trim().length > 0);
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
 * Structured origin fields from a geocoder place.
 *
 * @param {Object} place
 * @returns {{street: string, city: string, state: string, postalCode: string}}
 */
export const originFieldsFromPlace = place => ({
  street: place?.street || (place?.address || '').split(',')[0].trim(),
  city: place?.city || '',
  state: place?.state || '',
  postalCode: place?.postalCode || '',
});

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

export const destinationFromCheckoutValues = values => ({
  name: values.recipientName,
  phone: values.recipientPhoneNumber,
  street: values.recipientAddressLine1,
  line1: values.recipientAddressLine1,
  line2: values.recipientAddressLine2,
  city: values.recipientCity,
  state: values.recipientState,
  postalCode: values.recipientPostal,
  country: values.recipientCountry || 'US',
});

export const isCheckoutDestinationComplete = dest =>
  ['name', 'phone', 'street', 'city', 'state', 'postalCode'].every(
    key => typeof dest?.[key] === 'string' && dest[key].trim().length > 0
  );
