const log = require('../../log');
const { getSdk, handleError } = require('../../api-util/sdk');
const { getIntegrationSdk } = require('../../api-util/integrationSdk');
const { generateLabel } = require('../../api-util/envia');
const {
  loadListingShippingContext,
  assertShippableListing,
  destinationFromShippingDetails,
  shippingMetadata,
  LABEL_STATUS,
  httpError,
} = require('../../api-util/shipping');

const PURCHASED_TRANSITIONS = ['transition/confirm-payment'];

const ensureCustomerOwnedPurchased = (transaction, currentUserId) => {
  const customerId = transaction?.relationships?.customer?.data?.id?.uuid;
  if (customerId !== currentUserId) {
    throw httpError('You cannot create a label for this order.', 403);
  }
  const lastTransition = transaction?.attributes?.lastTransition;
  const shipping = shippingMetadata(transaction);
  const alreadyPurchased = shipping.labelStatus === LABEL_STATUS.PURCHASED;
  if (alreadyPurchased) {
    return { alreadyPurchased: true };
  }
  if (!PURCHASED_TRANSITIONS.includes(lastTransition) && lastTransition !== 'transition/mark-delivered') {
    // Allow create while purchased (confirm-payment) even if later states; skip canceled.
    const state = transaction?.attributes?.state;
    if (state === 'state/canceled' || state === 'state/payment-expired') {
      throw httpError('This order cannot buy a shipping label.');
    }
  }
  if (transaction?.attributes?.protectedData?.deliveryMethod !== 'shipping') {
    throw httpError('This order is not a shipping order.');
  }
  return { alreadyPurchased: false };
};

const createLabelForTransaction = async transaction => {
  const listingId = transaction.relationships?.listing?.data?.id;
  const protectedData = transaction.attributes?.protectedData || {};
  const destination = destinationFromShippingDetails(protectedData.shippingDetails);
  const carrier = protectedData.shippingCarrier;
  const service = protectedData.shippingService;
  if (!carrier || !service) {
    throw httpError('This order is missing the selected shipping service.');
  }
  const context = await loadListingShippingContext(listingId);
  assertShippableListing(context);
  const label = await generateLabel({
    origin: context.origin,
    destination,
    parcel: context.parcel,
    carrier,
    service,
    comments: `boxlot-tx:${transaction.id.uuid}`,
  });
  const integrationSdk = getIntegrationSdk();
  await integrationSdk.transactions.updateMetadata({
    id: transaction.id,
    metadata: {
      shipping: {
        ...shippingMetadata(transaction),
        carrier: label.carrier,
        service: label.service,
        shipmentId: label.shipmentId,
        trackingNumber: label.trackingNumber,
        trackUrl: label.trackUrl,
        labelUrl: label.labelUrl,
        labelStatus: LABEL_STATUS.PURCHASED,
        enviaPrice: label.totalPrice,
      },
    },
  });
  return label;
};

const markLabelFailed = async transaction => {
  const integrationSdk = getIntegrationSdk();
  await integrationSdk.transactions.updateMetadata({
    id: transaction.id,
    metadata: {
      shipping: {
        ...shippingMetadata(transaction),
        labelStatus: LABEL_STATUS.FAILED,
      },
    },
  });
};

const createLabelHandler = (req, res) => {
  const { transactionId } = req.body || {};
  const sdk = getSdk(req, res);

  Promise.all([
    sdk.currentUser.show(),
    getIntegrationSdk().transactions.show({
      id: transactionId,
      include: ['customer', 'listing'],
    }),
  ])
    .then(([currentUserResponse, txResponse]) => {
      const currentUserId = currentUserResponse.data.data.id.uuid;
      const transaction = txResponse.data.data;
      const check = ensureCustomerOwnedPurchased(transaction, currentUserId);
      if (check.alreadyPurchased) {
        return { skipped: true };
      }
      return createLabelForTransaction(transaction).catch(async e => {
        log.error(e, 'envia-create-label-failed', { transactionId });
        await markLabelFailed(transaction);
        return { failed: true };
      });
    })
    .then(result => {
      res.status(200).json({ data: result || {} });
    })
    .catch(e => {
      handleError(res, e);
    });
};

createLabelHandler.createLabelForTransaction = createLabelForTransaction;
createLabelHandler.markLabelFailed = markLabelFailed;

module.exports = createLabelHandler;
