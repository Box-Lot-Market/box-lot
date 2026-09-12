import React, { useEffect, useRef } from 'react';
import classNames from 'classnames';

import { useConfiguration } from '../../../context/configurationContext';
import { FormattedMessage, intlShape } from '../../../util/reactIntl';
import * as validators from '../../../util/validators';
import { addressFieldsFromPlace, streetFromLocationField } from '../../../util/shipping';
import getCountryCodes from '../../../translations/countryCodes';

import {
  FieldLocationAutocompleteInput,
  FieldSelect,
  FieldTextInput,
  Heading,
} from '../../../components';

import css from './ShippingDetails.module.css';

const DEFAULT_COUNTRY_CODE = 'US';
const identity = v => v;
const SEARCH_VALUE_FROM_PLACE = place => place.street || place.address || '';

/**
 * A component that displays the shipping details form on the checkout page.
 *
 * @component
 * @param {Object} props
 * @param {string} props.rootClassName - The root class name for the shipping details
 * @param {string} props.className - The class name for the shipping details
 * @param {string} props.locale - The locale
 * @param {intlShape} props.intl - The intl object
 * @param {boolean} props.disabled - Whether the form is disabled
 * @param {Object} props.formApi - The form API from React Final Form
 * @param {Object} [props.values] - Current Final Form values
 * @param {string} props.fieldId - The field ID
 */
const ShippingDetails = props => {
  const { rootClassName, className, locale, intl, disabled, formApi, values = {}, fieldId } = props;
  const config = useConfiguration();
  const classes = classNames(rootClassName || css.root, className);
  const prevPlaceKeyRef = useRef(null);
  const selectedPlace = values.recipientLocation?.selectedPlace;
  const placeKey = selectedPlace
    ? [
        selectedPlace.street,
        selectedPlace.city,
        selectedPlace.state,
        selectedPlace.postalCode,
      ].join('|')
    : '';
  const street = streetFromLocationField(values.recipientLocation);

  // This marketplace only ships within the US, so the country is fixed to 'US'.
  useEffect(() => {
    formApi.change('recipientCountry', DEFAULT_COUNTRY_CODE);
    return () => {
      formApi.change('recipientLocation', undefined);
      formApi.change('recipientAddressLine1', undefined);
    };
  }, []);

  // Keep recipientAddressLine1 in sync for rates fetch and billing copy.
  useEffect(() => {
    const current =
      typeof values.recipientAddressLine1 === 'string' ? values.recipientAddressLine1 : '';
    if (street !== current) {
      formApi.change('recipientAddressLine1', street || undefined);
    }
  }, [street]);

  useEffect(() => {
    if (!placeKey) {
      prevPlaceKeyRef.current = placeKey;
      return;
    }
    if (prevPlaceKeyRef.current === placeKey) {
      return;
    }
    prevPlaceKeyRef.current = placeKey;

    const fields = addressFieldsFromPlace(selectedPlace);
    formApi.batch(() => {
      if (fields.street) {
        formApi.change('recipientAddressLine1', fields.street);
      }
      if (fields.city) {
        formApi.change('recipientCity', fields.city);
      }
      if (fields.state) {
        formApi.change('recipientState', fields.state);
      }
      if (fields.postalCode) {
        formApi.change('recipientPostal', fields.postalCode);
      }
    });
  }, [placeKey]);

  const optionalText = intl.formatMessage({
    id: 'ShippingDetails.optionalText',
  });

  // Use the language set in config.localization.locale to get the correct translations of the country names
  const countryCodes = getCountryCodes(locale);
  const isGoogleMaps = config.maps?.mapProvider === 'googleMaps';
  const searchTypes = isGoogleMaps ? ['street_address', 'premise'] : ['address'];

  return (
    <div className={classes}>
      <Heading as="h3" rootClassName={css.heading}>
        <FormattedMessage id="ShippingDetails.title" />
      </Heading>
      <FieldTextInput
        id={`${fieldId}.recipientName`}
        name="recipientName"
        disabled={disabled}
        className={css.fieldFullWidth}
        type="text"
        autoComplete="shipping name"
        label={intl.formatMessage({ id: 'ShippingDetails.recipientNameLabel' })}
        placeholder={intl.formatMessage({
          id: 'ShippingDetails.recipientNamePlaceholder',
        })}
        validate={validators.required(
          intl.formatMessage({ id: 'ShippingDetails.recipientNameRequired' })
        )}
        onUnmount={() => formApi.change('recipientName', undefined)}
      />
      <FieldTextInput
        id={`${fieldId}.recipientPhoneNumber`}
        name="recipientPhoneNumber"
        disabled={disabled}
        className={css.fieldFullWidth}
        type="text"
        autoComplete="shipping phoneNumber"
        label={intl.formatMessage({ id: 'ShippingDetails.recipientPhoneNumberLabel' })}
        placeholder={intl.formatMessage({
          id: 'ShippingDetails.recipientPhoneNumberPlaceholder',
        })}
        validate={validators.required(
          intl.formatMessage({ id: 'ShippingDetails.recipientPhoneNumberRequired' })
        )}
        onUnmount={() => formApi.change('recipientPhoneNumber', undefined)}
      />
      <FieldLocationAutocompleteInput
        rootClassName={css.locationField}
        inputClassName={css.locationInput}
        iconClassName={css.locationIcon}
        predictionsClassName={css.locationPredictions}
        name="recipientLocation"
        id={`${fieldId}.recipientAddressLine1`}
        disabled={disabled}
        label={intl.formatMessage({ id: 'ShippingDetails.addressLine1Label' })}
        placeholder={intl.formatMessage({
          id: 'ShippingDetails.addressLine1Placeholder',
        })}
        useDefaultPredictions={false}
        closeOnBlur
        countryLimit={['US']}
        searchTypes={searchTypes}
        searchValueFromPlace={SEARCH_VALUE_FROM_PLACE}
        format={identity}
        valueFromForm={values.recipientLocation}
        validate={validators.autocompleteSearchRequired(
          intl.formatMessage({ id: 'ShippingDetails.addressLine1Required' })
        )}
      />
      <FieldTextInput
        id={`${fieldId}.recipientAddressLine2`}
        name="recipientAddressLine2"
        disabled={disabled}
        className={css.fieldFullWidth}
        type="text"
        autoComplete="shipping address-line2"
        label={intl.formatMessage(
          { id: 'ShippingDetails.addressLine2Label' },
          { optionalText: optionalText }
        )}
        placeholder={intl.formatMessage({
          id: 'ShippingDetails.addressLine2Placeholder',
        })}
        onUnmount={() => formApi.change('recipientAddressLine2', undefined)}
      />
      <div className={css.formRow}>
        <FieldTextInput
          id={`${fieldId}.recipientPostalCode`}
          name="recipientPostal"
          disabled={disabled}
          className={css.field}
          type="text"
          autoComplete="shipping postal-code"
          label={intl.formatMessage({ id: 'ShippingDetails.postalCodeLabel' })}
          placeholder={intl.formatMessage({
            id: 'ShippingDetails.postalCodePlaceholder',
          })}
          validate={validators.required(
            intl.formatMessage({ id: 'ShippingDetails.postalCodeRequired' })
          )}
          onUnmount={() => formApi.change('recipientPostal', undefined)}
        />

        <FieldTextInput
          id={`${fieldId}.recipientCity`}
          name="recipientCity"
          disabled={disabled}
          className={css.field}
          type="text"
          autoComplete="shipping address-level2"
          label={intl.formatMessage({ id: 'ShippingDetails.cityLabel' })}
          placeholder={intl.formatMessage({ id: 'ShippingDetails.cityPlaceholder' })}
          validate={validators.required(intl.formatMessage({ id: 'ShippingDetails.cityRequired' }))}
          onUnmount={() => formApi.change('recipientCity', undefined)}
        />
      </div>
      <div className={css.formRow}>
        <FieldTextInput
          id={`${fieldId}.recipientState`}
          name="recipientState"
          disabled={disabled}
          className={css.field}
          type="text"
          autoComplete="shipping address-level1"
          label={intl.formatMessage({ id: 'ShippingDetails.stateLabel' })}
          placeholder={intl.formatMessage({ id: 'ShippingDetails.statePlaceholder' })}
          validate={validators.required(
            intl.formatMessage({ id: 'ShippingDetails.stateRequired' })
          )}
          onUnmount={() => formApi.change('recipientState', undefined)}
        />

        <FieldSelect
          id={`${fieldId}.recipientCountry`}
          name="recipientCountry"
          disabled
          className={css.field}
          label={intl.formatMessage({ id: 'ShippingDetails.countryLabel' })}
          validate={validators.required(
            intl.formatMessage({ id: 'ShippingDetails.countryRequired' })
          )}
        >
          <option disabled value="">
            {intl.formatMessage({ id: 'ShippingDetails.countryPlaceholder' })}
          </option>
          {countryCodes.map(country => {
            return (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            );
          })}
        </FieldSelect>
      </div>
    </div>
  );
};

export default ShippingDetails;
