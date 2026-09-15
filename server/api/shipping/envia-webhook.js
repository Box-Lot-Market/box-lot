const log = require('../../log');
const { verifyWebhookSignature } = require('../../api-util/envia');
const { getIntegrationSdk } = require('../../api-util/integrationSdk');
const {
  shippingMetadata,
  isCarrierScanStatus,
  LABEL_STATUS,
  toUuidString,
} = require('../../api-util/shipping');

const findTransactionByTrackingNumber = async trackingNumber => {
  const integrationSdk = getIntegrationSdk();
  const createdAtStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const response = await integrationSdk.transactions.query({
    createdAtStart,
    perPage: 100,
  });
  const rows = response.data.data || [];
  return rows.find(tx => shippingMetadata(tx).trackingNumber === trackingNumber) || null;
};

const handleScan = async payload => {
  const trackingNumber = payload?.data?.tracking_number || payload?.tracking_number;
  const status = payload?.data?.status || payload?.status;
  if (!trackingNumber || !isCarrierScanStatus(status)) {
    return;
  }
  const transaction = await findTransactionByTrackingNumber(trackingNumber);
  if (!transaction) {
    log.error(new Error('No transaction for Envia tracking number'), 'envia-webhook-tx-missing', {
      trackingNumber,
    });
    return;
  }
  const shipping = shippingMetadata(transaction);
  if (shipping.scannedAt) {
    return;
  }
  const integrationSdk = getIntegrationSdk();
  await integrationSdk.transactions.updateMetadata({
    id: toUuidString(transaction.id),
    metadata: {
      shipping: {
        ...shipping,
        labelStatus: LABEL_STATUS.PURCHASED,
        scannedAt: new Date().toISOString(),
        lastCarrierStatus: status,
      },
    },
  });
  const state = transaction.attributes?.state;
  if (state === 'state/purchased') {
    await integrationSdk.transactions.transition({
      id: toUuidString(transaction.id),
      transition: 'transition/operator-mark-delivered',
      params: {},
    });
  }
};

module.exports = (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const valid = verifyWebhookSignature({
    rawBody,
    signatureHeader: req.get('X-Webhook-Signature'),
    timestamp: req.get('X-Webhook-Timestamp'),
    event: req.get('X-Webhook-Event'),
  });
  if (!valid) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  res.status(200).json({ received: true });

  handleScan(req.body).catch(e => {
    log.error(e, 'envia-webhook-failed', {});
  });
};
