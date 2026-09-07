import React, { useState } from 'react';
import classNames from 'classnames';

// Import configs and util modules
import { FormattedMessage } from '../../../../util/reactIntl';
import {
  LISTING_STATE_DRAFT,
  STOCK_INFINITE_MULTIPLE_ITEMS,
  STOCK_MULTIPLE_ITEMS,
  propTypes,
} from '../../../../util/types';
import { displayDeliveryPickup, displayDeliveryShipping } from '../../../../util/configHelpers';
import { types as sdkTypes } from '../../../../util/sdkLoader';
import { publicLocationAddress, pickupAddressFromPlace } from '../../../../util/shipping';

// Import shared components
import { H3, ListingLink } from '../../../../components';

// Import modules from this directory
import EditListingDeliveryForm from './EditListingDeliveryForm';
import css from './EditListingDeliveryPanel.module.css';

const { Money } = sdkTypes;

const getInitialValues = props => {
  const { listing, listingTypes, marketplaceCurrency } = props;
  const { geolocation, publicData, price } = listing?.attributes || {};

  const listingType = listing?.attributes?.publicData?.listingType;
  const listingTypeConfig = listingTypes.find(conf => conf.listingType === listingType);
  const displayShipping = displayDeliveryShipping(listingTypeConfig);
  const displayPickup = displayDeliveryPickup(listingTypeConfig);
  const displayMultipleDelivery = displayShipping && displayPickup;

  // Only render current search if full place object is available in the URL params
  // TODO bounds are missing - those need to be queried directly from Google Places
  const locationFieldsPresent = publicData?.location?.address && geolocation;
  const location = publicData?.location || {};
  const { address, building } = location;
  const {
    shippingEnabled,
    pickupEnabled,
    parcelWeightLb,
    parcelLengthIn,
    parcelWidthIn,
    parcelHeightIn,
    parcelDeclaredValueSubunits,
  } = publicData;
  const pickupAddress = listing?.attributes?.privateData?.pickupAddress;
  const deliveryOptions = [];

  if (shippingEnabled || (!displayMultipleDelivery && displayShipping)) {
    deliveryOptions.push('shipping');
  }
  if (pickupEnabled || (!displayMultipleDelivery && displayPickup)) {
    deliveryOptions.push('pickup');
  }

  const currency = price?.currency || marketplaceCurrency;
  const declaredValueAsMoney =
    parcelDeclaredValueSubunits != null
      ? new Money(parcelDeclaredValueSubunits, currency)
      : price
      ? new Money(price.amount, currency)
      : null;

  const locationAddress = pickupAddress?.street || address;

  // Initial values for the form
  return {
    building: pickupAddress?.building || building,
    location: locationFieldsPresent
      ? {
          search: locationAddress,
          selectedPlace: {
            address: locationAddress,
            origin: geolocation,
            city: pickupAddress?.city,
            state: pickupAddress?.state,
            postalCode: pickupAddress?.postalCode,
          },
        }
      : { search: undefined, selectedPlace: undefined },
    deliveryOptions,
    parcelWeightLb: parcelWeightLb != null ? String(parcelWeightLb) : undefined,
    parcelLengthIn: parcelLengthIn != null ? String(parcelLengthIn) : undefined,
    parcelWidthIn: parcelWidthIn != null ? String(parcelWidthIn) : undefined,
    parcelHeightIn: parcelHeightIn != null ? String(parcelHeightIn) : undefined,
    parcelDeclaredValue: declaredValueAsMoney,
  };
};

/**
 * The EditListingDeliveryPanel component.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} [props.rootClassName] - Custom class that overrides the default class for the root element
 * @param {propTypes.ownListing} props.listing - The listing object
 * @param {Array<Object>} props.listingTypes - The active listing types configs
 * @param {string} props.marketplaceCurrency - The marketplace currency (e.g. 'USD')
 * @param {boolean} props.disabled - Whether the form is disabled
 * @param {boolean} props.ready - Whether the form is ready
 * @param {Function} props.onSubmit - The submit function
 * @param {string} props.submitButtonText - The submit button text
 * @param {boolean} props.panelUpdated - Whether the panel is updated
 * @param {boolean} props.updateInProgress - Whether the update is in progress
 * @param {Object} props.errors - The errors object
 * @returns {JSX.Element}
 */
const EditListingDeliveryPanel = props => {
  // State is needed since LocationAutocompleteInput doesn't have internal state
  // and therefore re-rendering would overwrite the values during XHR call.
  const [state, setState] = useState({ initialValues: getInitialValues(props) });

  const {
    className,
    rootClassName,
    listing,
    listingTypes,
    marketplaceCurrency,
    disabled,
    ready,
    onSubmit,
    submitButtonText,
    panelUpdated,
    updateInProgress,
    errors,
    updatePageTitle: UpdatePageTitle,
    intl,
  } = props;

  const classes = classNames(rootClassName || css.root, className);
  const isPublished = listing?.id && listing?.attributes.state !== LISTING_STATE_DRAFT;
  const priceCurrencyValid = listing?.attributes?.price?.currency === marketplaceCurrency;
  const listingType = listing?.attributes?.publicData?.listingType;
  const listingTypeConfig = listingTypes.find(conf => conf.listingType === listingType);
  const allowOrdersOfMultipleItems = [STOCK_MULTIPLE_ITEMS, STOCK_INFINITE_MULTIPLE_ITEMS].includes(
    listingTypeConfig?.stockType
  );

  const panelHeadingProps = isPublished
    ? {
        id: 'EditListingDeliveryPanel.title',
        values: { listingTitle: <ListingLink listing={listing} />, lineBreak: <br /> },
        messageProps: { listingTitle: listing.attributes.title },
      }
    : {
        id: 'EditListingDeliveryPanel.createListingTitle',
        values: { lineBreak: <br /> },
        messageProps: {},
      };

  return (
    <main className={classes}>
      <UpdatePageTitle
        panelHeading={intl.formatMessage(
          { id: panelHeadingProps.id },
          { ...panelHeadingProps.messageProps }
        )}
      />
      <H3 as="h1">
        <FormattedMessage id={panelHeadingProps.id} values={{ ...panelHeadingProps.values }} />
      </H3>
      {priceCurrencyValid ? (
        <EditListingDeliveryForm
          className={css.form}
          initialValues={state.initialValues}
          currentUser={props.currentUser}
          onSubmit={values => {
            const {
              building = '',
              location,
              deliveryOptions,
              parcelWeightLb,
              parcelLengthIn,
              parcelWidthIn,
              parcelHeightIn,
              parcelDeclaredValue,
            } = values;

            const shippingEnabled = deliveryOptions.includes('shipping');
            const pickupEnabled = deliveryOptions.includes('pickup');
            const selectedPlace = location?.selectedPlace;
            const origin = selectedPlace?.origin || null;
            const fullStreet = selectedPlace?.address || null;
            const coarseAddress = publicLocationAddress(selectedPlace);

            const pickupDataMaybe =
              pickupEnabled && fullStreet
                ? { location: { address: coarseAddress || fullStreet, building: '' } }
                : { location: null };

            const shippingDataMaybe = shippingEnabled
              ? {
                  parcelWeightLb: Number(parcelWeightLb),
                  parcelLengthIn: Number(parcelLengthIn),
                  parcelWidthIn: Number(parcelWidthIn),
                  parcelHeightIn: Number(parcelHeightIn),
                  parcelDeclaredValueSubunits: parcelDeclaredValue?.amount,
                  shippingPriceInSubunitsOneItem: null,
                  shippingPriceInSubunitsAdditionalItems: null,
                }
              : {
                  parcelWeightLb: null,
                  parcelLengthIn: null,
                  parcelWidthIn: null,
                  parcelHeightIn: null,
                  parcelDeclaredValueSubunits: null,
                };

            const updateValues = {
              geolocation: origin,
              publicData: {
                pickupEnabled,
                ...pickupDataMaybe,
                shippingEnabled,
                ...shippingDataMaybe,
              },
              privateData: {
                pickupAddress:
                  pickupEnabled && fullStreet
                    ? pickupAddressFromPlace(selectedPlace, building)
                    : null,
              },
            };

            setState({
              initialValues: {
                building,
                location: {
                  search: fullStreet,
                  selectedPlace: { ...selectedPlace, address: fullStreet, origin },
                },
                deliveryOptions,
                parcelWeightLb,
                parcelLengthIn,
                parcelWidthIn,
                parcelHeightIn,
                parcelDeclaredValue,
              },
            });
            onSubmit(updateValues);
          }}
          listingTypeConfig={listingTypeConfig}
          marketplaceCurrency={marketplaceCurrency}
          allowOrdersOfMultipleItems={allowOrdersOfMultipleItems}
          saveActionMsg={submitButtonText}
          disabled={disabled}
          ready={ready}
          updated={panelUpdated}
          updateInProgress={updateInProgress}
          fetchErrors={errors}
          autoFocus
        />
      ) : (
        <div className={css.priceCurrencyInvalid}>
          <FormattedMessage
            id="EditListingPricingPanel.listingPriceCurrencyInvalid"
            values={{ marketplaceCurrency }}
          />
        </div>
      )}
    </main>
  );
};

export default EditListingDeliveryPanel;
