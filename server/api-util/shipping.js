const { types } = require('sharetribe-flex-sdk');
const { Money } = types;
const { getIntegrationSdk } = require('./integrationSdk');
const { quoteSelectedRate, enviaError } = require('./envia');

const PO_BOX_PATTERN = /\b(?:p\.?\s*o\.?\s*box|post\s*office\s*box)\b/i;

const LABEL_STATUS = {
  PENDING: 'pending',
  PURCHASED: 'purchased',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const PRE_SCAN_STATUSES = [
  'pending',
  'label created',
  'pre-transit',
  'information received',
  'not yet in system',
  'shipping information received',
];

const CANCEL_TRANSITIONS = [
  'transition/cancel',
  'transition/auto-cancel',
  'transition/cancel-from-disputed',
  'transition/auto-cancel-from-disputed',
];

const httpError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  error.statusText = message;
  error.data = {};
  return error;
};

/**
 * True when the destination looks like a US PO Box.
 *
 * @param {Object} address
 * @returns {boolean}
 */
const isPoBoxAddress = address => {
  const fields = [address?.street, address?.line1, address?.line2, address?.city]
    .filter(Boolean)
    .join(' ');
  return PO_BOX_PATTERN.test(fields);
};

const isOriginComplete = origin => {
  if (!origin) {
    return false;
  }
  const required = ['name', 'phone', 'street', 'city', 'state', 'postalCode'];
  return required.every(key => typeof origin[key] === 'string' && origin[key].trim().length > 0);
};

const parcelFromListing = listing => {
  const publicData = listing?.attributes?.publicData || {};
  const price = listing?.attributes?.price;
  const weight = Number(publicData.parcelWeightLb);
  const length = Number(publicData.parcelLengthIn);
  const width = Number(publicData.parcelWidthIn);
  const height = Number(publicData.parcelHeightIn);
  const declaredValueSubunits =
    publicData.parcelDeclaredValueSubunits != null
      ? Number(publicData.parcelDeclaredValueSubunits)
      : price?.amount;
  const complete = [weight, length, width, height].every(n => Number.isFinite(n) && n > 0);
  if (!complete) {
    return null;
  }
  return {
    weight,
    length,
    width,
    height,
    declaredValue: Number.isFinite(declaredValueSubunits) ? declaredValueSubunits / 100 : 0,
    content: listing?.attributes?.title || 'Box lot',
  };
};

const originFromUser = user => {
  const origin = user?.attributes?.profile?.privateData?.originAddress;
  if (!isOriginComplete(origin)) {
    return null;
  }
  return {
    name: origin.name.trim(),
    phone: origin.phone.trim(),
    street: origin.street.trim(),
    city: origin.city.trim(),
    state: origin.state.trim(),
    postalCode: origin.postalCode.trim(),
    country: 'US',
  };
};

const destinationFromShippingDetails = shippingDetails => {
  const address = shippingDetails?.address || {};
  return {
    name: shippingDetails?.name,
    phone: shippingDetails?.phoneNumber,
    street: address.line1,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country || 'US',
  };
};

/**
 * Load listing (with private pickup address) and provider origin.
 *
 * @param {string|Object} listingId
 * @returns {Promise<{listing: Object, origin: Object|null, parcel: Object|null}>}
 */
const loadListingShippingContext = async listingId => {
  const integrationSdk = getIntegrationSdk();
  const id = typeof listingId === 'string' ? listingId : listingId?.uuid;
  const listingResponse = await integrationSdk.listings.show({
    id,
    include: ['author'],
  });
  const listing = listingResponse.data.data;
  const authorRef = listing?.relationships?.author?.data;
  const included = listingResponse.data.included || [];
  const authorFromInclude = included.find(
    entity => entity.type === 'user' && entity.id?.uuid === authorRef?.id?.uuid
  );
  const authorId = authorRef?.id?.uuid || authorFromInclude?.id?.uuid;
  if (!authorId) {
    throw httpError('Listing author was not found.', 404);
  }
  const userResponse = await integrationSdk.users.show({ id: authorId });
  const origin = originFromUser(userResponse.data.data);
  return {
    listing,
    origin,
    parcel: parcelFromListing(listing),
    authorId,
  };
};

const assertShippableListing = ({ origin, parcel, listing }) => {
  if (!listing?.attributes?.publicData?.shippingEnabled) {
    throw httpError('This listing does not offer shipping.');
  }
  if (!origin) {
    throw httpError('The seller has not added a complete ship-from address.');
  }
  if (!parcel) {
    throw httpError('This listing is missing parcel weight and size.');
  }
};

const assertUsDestination = destination => {
  const country = (destination.country || 'US').toUpperCase();
  if (country !== 'US') {
    throw httpError('This marketplace only ships within the US.');
  }
  if (isPoBoxAddress(destination)) {
    throw httpError('Shipping to a PO Box is not supported.');
  }
  const required = ['name', 'phone', 'street', 'city', 'state', 'postalCode'];
  const missing = required.filter(key => !String(destination[key] || '').trim());
  if (missing.length) {
    throw httpError('Enter a complete US shipping address.');
  }
};

/**
 * Re-quote the selected Envia service and return a Money shipping fee.
 *
 * @returns {Promise<{rate: Object, shippingFee: Money}>}
 */
const quoteShippingFee = async ({ listingId, destination, carrier, service, currency }) => {
  const context = await loadListingShippingContext(listingId);
  assertShippableListing(context);
  assertUsDestination(destination);
  if (!carrier || !service) {
    throw httpError('Select a shipping service.');
  }
  const rate = await quoteSelectedRate({
    origin: context.origin,
    destination,
    parcel: context.parcel,
    carrier,
    service,
  });
  return {
    rate,
    shippingFee: new Money(rate.priceInSubunits, currency || 'USD'),
    context,
  };
};

const maybeQuoteShippingOrderData = async (listingId, orderData, currency) => {
  if (orderData?.deliveryMethod !== 'shipping') {
    return orderData;
  }
  const protectedData = orderData.protectedData || {};
  const shippingCarrier = orderData.shippingCarrier || protectedData.shippingCarrier;
  const shippingService = orderData.shippingService || protectedData.shippingService;
  const shippingDetails = orderData.shippingDetails || protectedData.shippingDetails;
  if (!shippingCarrier || !shippingService || !shippingDetails) {
    return orderData;
  }
  const destination = destinationFromShippingDetails(shippingDetails);
  const { rate } = await quoteShippingFee({
    listingId,
    destination,
    carrier: shippingCarrier,
    service: shippingService,
    currency,
  });
  return {
    ...orderData,
    shippingFeeInSubunits: rate.priceInSubunits,
    shippingCarrier: rate.carrier,
    shippingService: rate.service,
    shippingDetails,
  };
};

const pickupAddressFromListing = listing => listing?.attributes?.privateData?.pickupAddress || null;

const shippingMetadata = transaction => transaction?.attributes?.metadata?.shipping || {};

const isUnusedLabel = shipping =>
  shipping?.labelStatus === LABEL_STATUS.PURCHASED && !shipping?.scannedAt;

const isCarrierScanStatus = status => {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return false;
  }
  return !PRE_SCAN_STATUSES.includes(normalized);
};

exports.PO_BOX_PATTERN = PO_BOX_PATTERN;
exports.LABEL_STATUS = LABEL_STATUS;
exports.CANCEL_TRANSITIONS = CANCEL_TRANSITIONS;
exports.isPoBoxAddress = isPoBoxAddress;
exports.isOriginComplete = isOriginComplete;
exports.parcelFromListing = parcelFromListing;
exports.originFromUser = originFromUser;
exports.destinationFromShippingDetails = destinationFromShippingDetails;
exports.loadListingShippingContext = loadListingShippingContext;
exports.assertShippableListing = assertShippableListing;
exports.assertUsDestination = assertUsDestination;
exports.quoteShippingFee = quoteShippingFee;
exports.maybeQuoteShippingOrderData = maybeQuoteShippingOrderData;
exports.pickupAddressFromListing = pickupAddressFromListing;
exports.shippingMetadata = shippingMetadata;
exports.isUnusedLabel = isUnusedLabel;
exports.isCarrierScanStatus = isCarrierScanStatus;
exports.httpError = httpError;
exports.enviaError = enviaError;
