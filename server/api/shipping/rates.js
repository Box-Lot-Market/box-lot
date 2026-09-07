const { getSdk, handleError } = require('../../api-util/sdk');
const { validateUsPostalCode, quoteRates } = require('../../api-util/envia');
const {
  loadListingShippingContext,
  assertShippableListing,
  assertUsDestination,
} = require('../../api-util/shipping');

module.exports = (req, res) => {
  const { listingId, destination } = req.body || {};
  const sdk = getSdk(req, res);

  sdk
    .currentUser.show()
    .then(() => {
      if (!listingId) {
        const error = new Error('listingId is required.');
        error.status = 400;
        error.statusText = error.message;
        error.data = {};
        throw error;
      }
      assertUsDestination(destination || {});
      return Promise.all([
        validateUsPostalCode(destination.postalCode),
        loadListingShippingContext(listingId),
      ]);
    })
    .then(([, context]) => {
      assertShippableListing(context);
      return quoteRates({
        origin: context.origin,
        destination,
        parcel: context.parcel,
      });
    })
    .then(rates => {
      res.status(200).json({ data: rates });
    })
    .catch(e => {
      handleError(res, e);
    });
};
