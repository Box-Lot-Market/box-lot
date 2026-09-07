const { getSdk, handleError } = require('../../api-util/sdk');
const { getIntegrationSdk } = require('../../api-util/integrationSdk');
const { shippingMetadata, LABEL_STATUS, httpError } = require('../../api-util/shipping');

const entityId = entity => entity?.id?.uuid || entity?.data?.id?.uuid;

module.exports = (req, res) => {
  const { transactionId } = req.body || {};
  const sdk = getSdk(req, res);

  Promise.all([
    sdk.currentUser.show(),
    getIntegrationSdk().transactions.show({
      id: transactionId,
      include: ['provider', 'customer'],
    }),
  ])
    .then(async ([currentUserResponse, txResponse]) => {
      const currentUserId = currentUserResponse.data.data.id.uuid;
      const transaction = txResponse.data.data;
      const providerId = entityId(transaction.relationships?.provider);
      if (providerId !== currentUserId) {
        throw httpError('Only the seller can download this shipping label.', 403);
      }
      const shipping = shippingMetadata(transaction);
      if (shipping.labelStatus !== LABEL_STATUS.PURCHASED || !shipping.labelUrl) {
        throw httpError('The shipping label is not ready yet.', 404);
      }
      const labelResponse = await fetch(shipping.labelUrl);
      if (!labelResponse.ok) {
        throw httpError('Could not download the shipping label.', 502);
      }
      const buffer = Buffer.from(await labelResponse.arrayBuffer());
      res.set('Content-Type', labelResponse.headers.get('content-type') || 'application/pdf');
      res.set('Content-Disposition', 'attachment; filename="shipping-label.pdf"');
      res.status(200).send(buffer);
    })
    .catch(e => {
      handleError(res, e);
    });
};
