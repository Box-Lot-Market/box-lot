import React, { useEffect, useState } from 'react';
import { Field } from 'react-final-form';

import { FormattedMessage } from '../../../util/reactIntl';
import { fetchShippingRates } from '../../../util/api';
import {
  destinationFromCheckoutValues,
  isCheckoutDestinationComplete,
  isPoBoxAddress,
} from '../../../util/shipping';
import { formatMoney } from '../../../util/currency';
import { types as sdkTypes } from '../../../util/sdkLoader';
import { Heading, IconSpinner, ValidationError } from '../../../components';

import css from './ShippingRates.module.css';

const { Money } = sdkTypes;

const rateKey = rate => `${rate.carrier}::${rate.service}`;

/**
 * Fetch Envia rates after the buyer enters a complete US address, then let them pick a service.
 *
 * @component
 */
const ShippingRates = props => {
  const { intl, values, listingId, form } = props;
  const [rates, setRates] = useState([]);
  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState(null);

  const destination = destinationFromCheckoutValues(values || {});
  const complete = isCheckoutDestinationComplete(destination);
  const poBox = complete && isPoBoxAddress(destination);
  const destKey = complete
    ? [destination.street, destination.city, destination.state, destination.postalCode].join('|')
    : '';

  useEffect(() => {
    if (!complete || poBox || !listingId) {
      setRates([]);
      setError(poBox ? 'pobox' : null);
      if (form) {
        form.change('shippingRateKey', undefined);
      }
      return undefined;
    }

    if (form) {
      form.change('shippingRateKey', undefined);
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      setInProgress(true);
      setError(null);
      fetchShippingRates({ listingId, destination })
        .then(response => {
          if (cancelled) {
            return;
          }
          const data = response?.data || response || [];
          setRates(Array.isArray(data) ? data : []);
        })
        .catch(e => {
          if (cancelled) {
            return;
          }
          setRates([]);
          setError(e?.statusText || e?.message || 'error');
        })
        .finally(() => {
          if (!cancelled) {
            setInProgress(false);
          }
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [destKey, complete, poBox, listingId]);

  if (!complete) {
    return (
      <p className={css.hint}>
        <FormattedMessage id="ShippingRates.enterAddress" />
      </p>
    );
  }

  if (poBox) {
    return (
      <p className={css.error}>
        <FormattedMessage id="ShippingRates.poBoxNotAllowed" />
      </p>
    );
  }

  return (
    <div className={css.root}>
      <Heading as="h3" rootClassName={css.heading}>
        <FormattedMessage id="ShippingRates.title" />
      </Heading>
      {inProgress ? (
        <div className={css.spinner}>
          <IconSpinner />
        </div>
      ) : null}
      {error && error !== 'pobox' ? (
        <p className={css.error}>
          <FormattedMessage id="ShippingRates.fetchError" />
        </p>
      ) : null}
      {!inProgress && !error && rates.length === 0 ? (
        <p className={css.error}>
          <FormattedMessage id="ShippingRates.noRates" />
        </p>
      ) : null}
      <Field
        name="shippingRateKey"
        validate={value =>
          value ? undefined : intl.formatMessage({ id: 'ShippingRates.required' })
        }
      >
        {({ input, meta }) => (
          <div>
            {rates.map(rate => {
              const key = rateKey(rate);
              const money = new Money(rate.priceInSubunits, rate.currency || 'USD');
              return (
                <label key={key} className={css.option}>
                  <input
                    className={css.optionRadio}
                    type="radio"
                    name={input.name}
                    value={key}
                    checked={input.value === key}
                    onChange={() => input.onChange(key)}
                  />
                  <span className={css.optionBody}>
                    <span className={css.optionTitle}>
                      {(rate.carrier || '').toUpperCase()} · {rate.serviceDescription}
                    </span>
                    <span className={css.optionMeta}>
                      {formatMoney(intl, money)}
                      {rate.deliveryEstimate ? ` · ${rate.deliveryEstimate}` : ''}
                    </span>
                  </span>
                </label>
              );
            })}
            <ValidationError fieldMeta={meta} />
          </div>
        )}
      </Field>
    </div>
  );
};

export const parseShippingRateKey = key => {
  if (!key || !key.includes('::')) {
    return {};
  }
  const [carrier, service] = key.split('::');
  return { shippingCarrier: carrier, shippingService: service };
};

export default ShippingRates;
