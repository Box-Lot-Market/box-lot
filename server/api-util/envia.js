const crypto = require('crypto');
const log = require('../log');

const ENVIA_API_TOKEN = process.env.ENVIA_API_TOKEN;
const ENVIA_API_BASE_URL = process.env.ENVIA_API_BASE_URL || 'https://api-test.envia.com';
const ENVIA_GEOCODES_BASE_URL = process.env.ENVIA_GEOCODES_BASE_URL || 'https://geocodes.envia.com';
const ENVIA_WEBHOOK_SECRET = process.env.ENVIA_WEBHOOK_SECRET;

const CARRIERS = ['usps', 'ups', 'fedex'];

const enviaError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  error.statusText = message;
  error.data = {};
  return error;
};

const requireToken = () => {
  if (!ENVIA_API_TOKEN) {
    throw enviaError('Envia API token is not configured.', 503);
  }
};

const enviaFetch = async (url, options = {}) => {
  requireToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${ENVIA_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let json = null;
  try {
    json = await response.json();
  } catch (e) {
    json = null;
  }
  if (!response.ok) {
    const message = json?.error?.message || json?.message || `Envia request failed (${response.status})`;
    log.error(new Error(message), 'envia-request-failed', { url, status: response.status, json });
    throw enviaError(message, response.status >= 500 ? 502 : 400);
  }
  return json;
};

/**
 * Validate a US ZIP code via Envia Geocodes.
 *
 * @param {string} postalCode
 * @returns {Promise<Object>} geocode payload
 */
const validateUsPostalCode = async postalCode => {
  const zip = encodeURIComponent(String(postalCode || '').trim());
  if (!zip) {
    throw enviaError('Postal code is required.');
  }
  const json = await enviaFetch(`${ENVIA_GEOCODES_BASE_URL}/zipcode/US/${zip}`, { method: 'GET' });
  const data = json?.data || json;
  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw enviaError('This US address could not be validated.');
  }
  return data;
};

const toEnviaAddress = (address, { residential = true } = {}) => {
  const street = [address.street || address.line1, address.line2].filter(Boolean).join(' ').trim();
  return {
    name: address.name,
    company: address.company || '',
    email: address.email || '',
    phone: address.phone || address.phoneNumber,
    street,
    number: address.number || '',
    city: address.city,
    state: address.state,
    country: address.country || 'US',
    postalCode: address.postalCode,
    type: residential ? 2 : 1,
  };
};

const toEnviaPackage = parcel => ({
  type: 'box',
  content: parcel.content || 'Box lot',
  amount: 1,
  declaredValue: parcel.declaredValue,
  weightUnit: 'LB',
  lengthUnit: 'IN',
  weight: parcel.weight,
  dimensions: {
    length: parcel.length,
    width: parcel.width,
    height: parcel.height,
  },
});

const shipmentBody = ({ origin, destination, parcel, carrier, service, extraSettings }) => {
  const shipment = { type: 1, carrier };
  if (service) {
    shipment.service = service;
  }
  return {
    origin: toEnviaAddress(origin),
    destination: toEnviaAddress(destination),
    packages: [toEnviaPackage(parcel)],
    shipment,
    settings: { currency: 'USD', ...(extraSettings || {}) },
  };
};

const normalizeRate = (rate, carrier) => {
  const totalPrice = parseFloat(rate.totalPrice);
  const priceInSubunits = Number.isFinite(totalPrice) ? Math.round(totalPrice * 100) : null;
  if (priceInSubunits == null || priceInSubunits < 0) {
    return null;
  }
  return {
    carrier: rate.carrier || carrier,
    service: rate.service,
    serviceDescription: rate.serviceDescription || rate.service,
    deliveryEstimate: rate.deliveryEstimate || null,
    totalPrice,
    priceInSubunits,
    currency: rate.currency || 'USD',
  };
};

/**
 * Quote USPS, UPS, and FedEx in parallel.
 *
 * @param {Object} params
 * @returns {Promise<Array<Object>>} sorted rates
 */
const quoteRates = async ({ origin, destination, parcel }) => {
  const results = await Promise.all(
    CARRIERS.map(async carrier => {
      try {
        const json = await enviaFetch(`${ENVIA_API_BASE_URL.replace(/\/$/, '')}/ship/rate/`, {
          method: 'POST',
          body: JSON.stringify(shipmentBody({ origin, destination, parcel, carrier })),
        });
        const rows = Array.isArray(json?.data) ? json.data : [];
        return rows.map(row => normalizeRate(row, carrier)).filter(Boolean);
      } catch (e) {
        log.error(e, 'envia-rate-carrier-failed', { carrier });
        return [];
      }
    })
  );
  return results.flat().sort((a, b) => a.priceInSubunits - b.priceInSubunits);
};

/**
 * Re-quote a single carrier/service and return that rate.
 */
const quoteSelectedRate = async ({ origin, destination, parcel, carrier, service }) => {
  const json = await enviaFetch(`${ENVIA_API_BASE_URL.replace(/\/$/, '')}/ship/rate/`, {
    method: 'POST',
    body: JSON.stringify(shipmentBody({ origin, destination, parcel, carrier, service })),
  });
  const rows = Array.isArray(json?.data) ? json.data : [];
  const match =
    rows.map(row => normalizeRate(row, carrier)).find(row => row && row.service === service) ||
    rows.map(row => normalizeRate(row, carrier)).filter(Boolean)[0];
  if (!match) {
    throw enviaError('The selected shipping service is no longer available.');
  }
  return match;
};

/**
 * Purchase a shipping label.
 */
const generateLabel = async ({ origin, destination, parcel, carrier, service, comments }) => {
  const extraSettings = {
    printFormat: 'PDF',
    printSize: 'STOCK_4X6',
    ...(comments ? { comments } : {}),
  };
  const json = await enviaFetch(`${ENVIA_API_BASE_URL.replace(/\/$/, '')}/ship/generate/`, {
    method: 'POST',
    body: JSON.stringify(
      shipmentBody({
        origin,
        destination,
        parcel,
        carrier,
        service,
        extraSettings,
      })
    ),
  });
  const row = Array.isArray(json?.data) ? json.data[0] : json?.data;
  if (!row?.trackingNumber) {
    throw enviaError('Envia did not return a shipping label.', 502);
  }
  return {
    carrier: row.carrier || carrier,
    service: row.service || service,
    shipmentId: row.shipmentId,
    trackingNumber: row.trackingNumber,
    trackUrl: row.trackUrl || null,
    labelUrl: row.label,
    totalPrice: parseFloat(row.totalPrice),
    currency: row.currency || 'USD',
  };
};

/**
 * Cancel an unused Envia label.
 */
const cancelShipment = async ({ carrier, trackingNumber }) => {
  const json = await enviaFetch(`${ENVIA_API_BASE_URL.replace(/\/$/, '')}/ship/cancel/`, {
    method: 'POST',
    body: JSON.stringify({ carrier, trackingNumber }),
  });
  return json?.data || json;
};

/**
 * Verify Envia webhook HMAC when a secret is configured.
 * Signature: v1=HMAC-SHA256(timestamp + "." + event + "." + body, secret)
 *
 * @param {Object} params
 * @param {string} params.rawBody
 * @param {string} params.signatureHeader
 * @param {string} params.timestamp
 * @param {string} params.event
 * @returns {boolean}
 */
const verifyWebhookSignature = ({ rawBody, signatureHeader, timestamp, event }) => {
  if (!ENVIA_WEBHOOK_SECRET) {
    return true;
  }
  if (!signatureHeader || !timestamp || !event || typeof rawBody !== 'string') {
    return false;
  }
  const payload = `${timestamp}.${event}.${rawBody}`;
  const digest = crypto.createHmac('sha256', ENVIA_WEBHOOK_SECRET).update(payload).digest('hex');
  const expected = `v1=${digest}`;
  const given = Buffer.from(signatureHeader);
  const exp = Buffer.from(expected);
  if (given.length !== exp.length) {
    return false;
  }
  return crypto.timingSafeEqual(given, exp);
};

exports.CARRIERS = CARRIERS;
exports.validateUsPostalCode = validateUsPostalCode;
exports.quoteRates = quoteRates;
exports.quoteSelectedRate = quoteSelectedRate;
exports.generateLabel = generateLabel;
exports.cancelShipment = cancelShipment;
exports.verifyWebhookSignature = verifyWebhookSignature;
exports.enviaError = enviaError;
