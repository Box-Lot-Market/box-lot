const sharetribeIntegrationSdk = require('sharetribe-flex-integration-sdk');

const CLIENT_ID = process.env.SHARETRIBE_INTEGRATION_CLIENT_ID;
const CLIENT_SECRET = process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET;

let instance = null;

/**
 * Create (or reuse) the Sharetribe Integration API client.
 * Used for operator transitions, private origin data, and metadata updates.
 *
 * @returns {Object} Integration SDK instance
 */
const getIntegrationSdk = () => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    const error = new Error('Sharetribe Integration API credentials are not configured.');
    error.status = 503;
    error.statusText = error.message;
    error.data = {};
    throw error;
  }
  if (!instance) {
    instance = sharetribeIntegrationSdk.createInstance({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
  }
  return instance;
};

exports.getIntegrationSdk = getIntegrationSdk;
exports.hasIntegrationSdk = () => !!(CLIENT_ID && CLIENT_SECRET);
