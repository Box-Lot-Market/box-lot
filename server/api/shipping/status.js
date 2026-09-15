const { getSdk, handleError } = require('../../api-util/sdk');
const { getIntegrationSdk } = require('../../api-util/integrationSdk');
const {
  shippingMetadata,
  trackUrlForShipment,
  LABEL_STATUS,
  httpError,
  toUuidString,
} = require('../../api-util/shipping');

const entityId = entity => entity?.id?.uuid || entity?.data?.id?.uuid;

module.exports = (req, res) => {
  const { transactionId } = req.body || {};
  const sdk = getSdk(req, res);

  Promise.all([
    sdk.currentUser.show(),
    getIntegrationSdk().transactions.show({
      id: toUuidString(transactionId),
      include: ['provider', 'customer'],
    }),
  ])
    .then(([currentUserResponse, txResponse]) => {
      const currentUserId = currentUserResponse.data.data.id.uuid;
      const transaction = txResponse.data.data;
      const providerId = entityId(transaction.relationships?.provider);
      const customerId = entityId(transaction.relationships?.customer);
      const isProvider = providerId === currentUserId;
      const isCustomer = customerId === currentUserId;
      if (!isProvider && !isCustomer) {
        throw httpError('You cannot view shipping status for this order.', 403);
      }

      const shipping = shippingMetadata(transaction);
      const scanned = !!shipping.scannedAt;
      const purchased = shipping.labelStatus === LABEL_STATUS.PURCHASED;
      const payload = {
        labelStatus: shipping.labelStatus || LABEL_STATUS.PENDING,
        carrier: shipping.carrier || transaction.attributes?.protectedData?.shippingCarrier || null,
        service: shipping.service || transaction.attributes?.protectedData?.shippingService || null,
        scanned,
      };

      if (purchased) {
        payload.trackingNumber = shipping.trackingNumber || null;
        payload.trackUrl = trackUrlForShipment(shipping);
        if (isProvider) {
          payload.hasLabel = true;
        }
      }

      res.status(200).json({ data: payload });
    })
    .catch(e => {
      handleError(res, e);
    });
};
