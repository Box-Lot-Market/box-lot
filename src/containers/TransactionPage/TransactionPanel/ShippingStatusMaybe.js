import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../util/reactIntl';
import { downloadShippingLabel, fetchShippingStatus } from '../../../util/api';
import { Heading, SecondaryButton } from '../../../components';

import css from './TransactionPanel.module.css';

/**
 * Show shipping label (seller) and tracking (after carrier scan for the buyer).
 *
 * @component
 */
const ShippingStatusMaybe = props => {
  const { className, rootClassName, transactionId, deliveryMethod, isProvider, isCustomer } = props;
  const [status, setStatus] = useState(null);
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  useEffect(() => {
    if (deliveryMethod !== 'shipping' || !transactionId) {
      return undefined;
    }
    let cancelled = false;
    fetchShippingStatus({ transactionId })
      .then(response => {
        if (!cancelled) {
          setStatus(response?.data || response || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryMethod, transactionId]);

  if (deliveryMethod !== 'shipping') {
    return null;
  }

  const classes = classNames(rootClassName || css.deliveryInfoContainer, className);
  const labelStatus = status?.labelStatus;
  const scanned = !!status?.scanned;
  const trackingNumber = status?.trackingNumber;
  const trackUrl = status?.trackUrl;

  const handleDownload = () => {
    setDownloadInProgress(true);
    setDownloadError(false);
    downloadShippingLabel({ transactionId })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = 'shipping-label.pdf';
        window.document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => {
        setDownloadError(true);
      })
      .finally(() => {
        setDownloadInProgress(false);
      });
  };

  return (
    <div className={classes}>
      <Heading as="h3" rootClassName={css.sectionHeading}>
        <FormattedMessage id="TransactionPanel.shippingStatusHeading" />
      </Heading>
      <div className={css.shippingStatusContent}>
        {isProvider && labelStatus === 'failed' ? (
          <p>
            <FormattedMessage id="TransactionPanel.shippingLabelFailed" />
          </p>
        ) : null}
        {isProvider && (!labelStatus || labelStatus === 'pending') ? (
          <p>
            <FormattedMessage id="TransactionPanel.shippingLabelPending" />
          </p>
        ) : null}
        {isProvider && status?.hasLabel ? (
          <SecondaryButton type="button" inProgress={downloadInProgress} onClick={handleDownload}>
            <FormattedMessage id="TransactionPanel.downloadShippingLabel" />
          </SecondaryButton>
        ) : null}
        {downloadError ? (
          <p className={css.genericError}>
            <FormattedMessage id="TransactionPanel.shippingLabelDownloadFailed" />
          </p>
        ) : null}
        {isProvider && trackingNumber ? (
          <p>
            <FormattedMessage
              id="TransactionPanel.shippingTracking"
              values={{
                carrier: (status.carrier || '').toUpperCase(),
                trackingNumber,
              }}
            />
          </p>
        ) : null}
        {isCustomer && !scanned ? (
          <p>
            <FormattedMessage id="TransactionPanel.shippingTrackingAfterScan" />
          </p>
        ) : null}
        {isCustomer && scanned && trackingNumber ? (
          <p>
            <FormattedMessage
              id="TransactionPanel.shippingTracking"
              values={{
                carrier: (status.carrier || '').toUpperCase(),
                trackingNumber,
              }}
            />
          </p>
        ) : null}
        {trackUrl && ((isProvider && trackingNumber) || (isCustomer && scanned)) ? (
          <p>
            <a href={trackUrl} target="_blank" rel="noreferrer">
              <FormattedMessage id="TransactionPanel.shippingTrackLink" />
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default ShippingStatusMaybe;
