const log = require('../../log');
const { getIntegrationSdk } = require('../../api-util/integrationSdk');
const { cancelShipment } = require('../../api-util/envia');
const {
  shippingMetadata,
  isUnusedLabel,
  CANCEL_TRANSITIONS,
  LABEL_STATUS,
} = require('../../api-util/shipping');
const createLabelHandler = require('./create-label');
const { createLabelForTransaction, markLabelFailed } = createLabelHandler;

const EVENTS_SECRET = process.env.SHIPPING_EVENTS_SECRET;

const eventTransition = event =>
  event?.attributes?.auditData?.transition ||
  event?.attributes?.resource?.attributes?.lastTransition ||
  event?.attributes?.details?.transition;

module.exports = (req, res) => {
  const provided = req.get('x-shipping-events-secret') || req.body?.secret;
  if (!EVENTS_SECRET || provided !== EVENTS_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const createdAtStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const integrationSdk = getIntegrationSdk();

  integrationSdk.events
    .query({
      eventTypes: 'transaction/transitioned',
      createdAtStart,
      perPage: 100,
    })
    .then(async response => {
      const events = response.data.data || [];
      const summary = { labelsCreated: 0, labelsFailed: 0, labelsCancelled: 0, skipped: 0 };

      for (const event of events) {
        const transition = eventTransition(event);
        const resourceId = event.attributes?.resourceId;
        if (!resourceId) {
          summary.skipped += 1;
          continue;
        }
        let transaction;
        try {
          const txResponse = await integrationSdk.transactions.show({
            id: resourceId,
            include: ['listing'],
          });
          transaction = txResponse.data.data;
        } catch (e) {
          log.error(e, 'shipping-process-events-show-failed', { resourceId });
          continue;
        }

        const deliveryMethod = transaction.attributes?.protectedData?.deliveryMethod;
        if (deliveryMethod !== 'shipping') {
          summary.skipped += 1;
          continue;
        }

        const shipping = shippingMetadata(transaction);
        const state = transaction.attributes?.state;
        const needsLabel =
          state === 'state/purchased' &&
          shipping.labelStatus !== LABEL_STATUS.PURCHASED &&
          shipping.labelStatus !== LABEL_STATUS.CANCELLED;

        if (needsLabel) {
          try {
            await createLabelForTransaction(transaction);
            summary.labelsCreated += 1;
          } catch (e) {
            log.error(e, 'shipping-process-events-create-label-failed', {
              transactionId: transaction.id?.uuid,
            });
            await markLabelFailed(transaction).catch(() => null);
            summary.labelsFailed += 1;
          }
          continue;
        }

        if (CANCEL_TRANSITIONS.includes(transition) && isUnusedLabel(shipping)) {
          try {
            await cancelShipment({
              carrier: shipping.carrier,
              trackingNumber: shipping.trackingNumber,
            });
            await integrationSdk.transactions.updateMetadata({
              id: transaction.id,
              metadata: {
                shipping: {
                  ...shipping,
                  labelStatus: LABEL_STATUS.CANCELLED,
                  cancelledAt: new Date().toISOString(),
                },
              },
            });
            summary.labelsCancelled += 1;
          } catch (e) {
            log.error(e, 'shipping-process-events-cancel-failed', {
              transactionId: transaction.id?.uuid,
            });
          }
        }
      }

      res.status(200).json({ data: summary });
    })
    .catch(e => {
      log.error(e, 'shipping-process-events-failed', {});
      res.status(500).json({ error: e.message });
    });
};
