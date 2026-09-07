import React, { useEffect } from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

// Import configs and util modules
import appSettings from '../../../../config/settings';
import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { propTypes } from '../../../../util/types';
import { displayDeliveryPickup, displayDeliveryShipping } from '../../../../util/configHelpers';
import {
  autocompleteSearchRequired,
  autocompletePlaceSelected,
  composeValidators,
  required,
  numberAtLeast,
} from '../../../../util/validators';
import { isOriginComplete, originFromCurrentUser } from '../../../../util/shipping';

// Import shared components
import {
  Form,
  FieldLocationAutocompleteInput,
  Button,
  FieldCurrencyInput,
  FieldTextInput,
  FieldCheckbox,
  NamedLink,
} from '../../../../components';

// Import modules from this directory
import css from './EditListingDeliveryForm.module.css';

const identity = v => v;

/**
 * The EditListingDeliveryForm component.
 *
 * @component
 * @param {Object} props - The component props
 * @param {string} props.formId - The form ID
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {Function} props.onSubmit - The submit function
 * @param {string} props.saveActionMsg - The save action message
 * @param {Object} props.selectedPlace - The selected place
 * @param {string} props.marketplaceCurrency - The marketplace currency
 * @param {boolean} props.hasStockInUse - Whether the stock is in use
 * @param {boolean} props.disabled - Whether the form is disabled
 * @param {boolean} props.ready - Whether the form is ready
 * @param {boolean} props.updated - Whether the form is updated
 * @param {boolean} props.updateInProgress - Whether the form is in progress
 * @param {Object} props.fetchErrors - The fetch errors
 * @param {propTypes.error} [props.fetchErrors.showListingsError] - The show listings error
 * @param {propTypes.error} [props.fetchErrors.updateListingError] - The update listing error
 * @param {boolean} props.autoFocus - Whether the form is auto focused
 * @returns {JSX.Element} The EditListingDeliveryForm component
 */
export const EditListingDeliveryForm = props => (
  <FinalForm
    {...props}
    render={formRenderProps => {
      const {
        formId = 'EditListingDeliveryForm',
        form,
        autoFocus,
        className,
        disabled,
        ready,
        handleSubmit,
        pristine,
        invalid,
        listingTypeConfig,
        marketplaceCurrency,
        allowOrdersOfMultipleItems = false,
        currentUser,
        saveActionMsg,
        updated,
        updateInProgress,
        fetchErrors,
        values,
      } = formRenderProps;
      const intl = useIntl();

      // This is a bug fix for Final Form.
      // Without this, React will return a warning:
      //   "Cannot update a component (`ForwardRef(Field)`)
      //   while rendering a different component (`ForwardRef(Field)`)"
      // This seems to happen because validation calls listeneres and
      // that causes state to change inside final-form.
      // https://github.com/final-form/react-final-form/issues/751
      //
      // TODO: it might not be worth the trouble to show these fields as disabled,
      // if this fix causes trouble in future dependency updates.
      const { pauseValidation, resumeValidation } = form;
      pauseValidation(false);
      useEffect(() => resumeValidation(), [values]);

      const displayShipping = displayDeliveryShipping(listingTypeConfig);
      const displayPickup = displayDeliveryPickup(listingTypeConfig);
      const displayMultipleDelivery = displayShipping && displayPickup;
      const shippingEnabled = displayShipping && values.deliveryOptions?.includes('shipping');
      const pickupEnabled = displayPickup && values.deliveryOptions?.includes('pickup');

      const addressRequiredMessage = intl.formatMessage({
        id: 'EditListingDeliveryForm.addressRequired',
      });
      const addressNotRecognizedMessage = intl.formatMessage({
        id: 'EditListingDeliveryForm.addressNotRecognized',
      });

      const optionalText = intl.formatMessage({
        id: 'EditListingDeliveryForm.optionalText',
      });

      const { updateListingError, showListingsError } = fetchErrors || {};

      const classes = classNames(css.root, className);
      const submitReady = (updated && pristine) || ready;
      const submitInProgress = updateInProgress;
      const originComplete = isOriginComplete(originFromCurrentUser(currentUser));
      const shippingDisabled = !originComplete;
      const submitDisabled =
        invalid ||
        disabled ||
        submitInProgress ||
        (!shippingEnabled && !pickupEnabled) ||
        (shippingEnabled && shippingDisabled);

      const shippingLabel = intl.formatMessage({ id: 'EditListingDeliveryForm.shippingLabel' });
      const pickupLabel = intl.formatMessage({ id: 'EditListingDeliveryForm.pickupLabel' });

      const pickupClasses = classNames({
        [css.deliveryOption]: displayMultipleDelivery,
        [css.disabled]: !pickupEnabled,
        [css.hidden]: !displayPickup,
      });
      const shippingClasses = classNames({
        [css.deliveryOption]: displayMultipleDelivery,
        [css.disabled]: !shippingEnabled,
        [css.hidden]: !displayShipping,
      });
      const currencyConfig = appSettings.getCurrencyFormatting(marketplaceCurrency);

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          <FieldCheckbox
            id={formId ? `${formId}.pickup` : 'pickup'}
            className={classNames(css.deliveryCheckbox, { [css.hidden]: !displayMultipleDelivery })}
            name="deliveryOptions"
            label={pickupLabel}
            value="pickup"
          />
          <div className={pickupClasses}>
            {updateListingError ? (
              <p className={css.error}>
                <FormattedMessage id="EditListingDeliveryForm.updateFailed" />
              </p>
            ) : null}

            {showListingsError ? (
              <p className={css.error}>
                <FormattedMessage id="EditListingDeliveryForm.showListingFailed" />
              </p>
            ) : null}

            <FieldLocationAutocompleteInput
              disabled={!pickupEnabled}
              rootClassName={css.input}
              inputClassName={css.locationAutocompleteInput}
              iconClassName={css.locationAutocompleteInputIcon}
              predictionsClassName={css.predictionsRoot}
              validClassName={css.validLocation}
              autoFocus={autoFocus}
              name="location"
              id={`${formId}.location`}
              label={intl.formatMessage({ id: 'EditListingDeliveryForm.address' })}
              placeholder={intl.formatMessage({
                id: 'EditListingDeliveryForm.addressPlaceholder',
              })}
              useDefaultPredictions={false}
              format={identity}
              valueFromForm={values.location}
              validate={
                pickupEnabled
                  ? composeValidators(
                      autocompleteSearchRequired(addressRequiredMessage),
                      autocompletePlaceSelected(addressNotRecognizedMessage)
                    )
                  : () => {}
              }
              hideErrorMessage={!pickupEnabled}
              // Whatever parameters are being used to calculate
              // the validation function need to be combined in such
              // a way that, when they change, this key prop
              // changes, thus reregistering this field (and its
              // validation function) with Final Form.
              // See example: https://codesandbox.io/s/changing-field-level-validators-zc8ei
              key={pickupEnabled ? 'locationValidation' : 'noLocationValidation'}
            />

            <FieldTextInput
              className={css.input}
              type="text"
              name="building"
              id={formId ? `${formId}.building` : 'building'}
              label={intl.formatMessage(
                { id: 'EditListingDeliveryForm.building' },
                { optionalText }
              )}
              placeholder={intl.formatMessage({
                id: 'EditListingDeliveryForm.buildingPlaceholder',
              })}
              disabled={!pickupEnabled}
            />
          </div>

          <FieldCheckbox
            id={formId ? `${formId}.shipping` : 'shipping'}
            className={classNames(css.deliveryCheckbox, { [css.hidden]: !displayMultipleDelivery })}
            name="deliveryOptions"
            label={shippingLabel}
            value="shipping"
            disabled={shippingDisabled && !shippingEnabled}
          />
          {shippingDisabled ? (
            <p className={css.originHint}>
              <FormattedMessage
                id="EditListingDeliveryForm.originRequired"
                values={{
                  profileSettingsLink: (
                    <NamedLink name="ProfileSettingsPage">
                      <FormattedMessage id="EditListingDeliveryForm.originRequiredLink" />
                    </NamedLink>
                  ),
                }}
              />
            </p>
          ) : null}

          <div className={shippingClasses}>
            <FieldTextInput
              id={`${formId}.parcelWeightLb`}
              name="parcelWeightLb"
              className={css.input}
              type="number"
              min="0.1"
              step="0.1"
              label={intl.formatMessage({ id: 'EditListingDeliveryForm.parcelWeightLabel' })}
              placeholder={intl.formatMessage({
                id: 'EditListingDeliveryForm.parcelWeightPlaceholder',
              })}
              disabled={!shippingEnabled}
              validate={
                shippingEnabled
                  ? composeValidators(
                      required(
                        intl.formatMessage({ id: 'EditListingDeliveryForm.parcelWeightRequired' })
                      ),
                      numberAtLeast(
                        intl.formatMessage({ id: 'EditListingDeliveryForm.parcelWeightRequired' }),
                        1
                      )
                    )
                  : null
              }
              hideErrorMessage={!shippingEnabled}
              key={shippingEnabled ? 'weightValidation' : 'noWeightValidation'}
            />
            <div className={css.dimensionRow}>
              <FieldTextInput
                id={`${formId}.parcelLengthIn`}
                name="parcelLengthIn"
                className={css.dimensionField}
                type="number"
                min="1"
                step="1"
                label={intl.formatMessage({ id: 'EditListingDeliveryForm.parcelLengthLabel' })}
                disabled={!shippingEnabled}
                validate={
                  shippingEnabled
                    ? required(
                        intl.formatMessage({ id: 'EditListingDeliveryForm.parcelDimensionRequired' })
                      )
                    : null
                }
                hideErrorMessage={!shippingEnabled}
                key={shippingEnabled ? 'lengthValidation' : 'noLengthValidation'}
              />
              <FieldTextInput
                id={`${formId}.parcelWidthIn`}
                name="parcelWidthIn"
                className={css.dimensionField}
                type="number"
                min="1"
                step="1"
                label={intl.formatMessage({ id: 'EditListingDeliveryForm.parcelWidthLabel' })}
                disabled={!shippingEnabled}
                validate={
                  shippingEnabled
                    ? required(
                        intl.formatMessage({ id: 'EditListingDeliveryForm.parcelDimensionRequired' })
                      )
                    : null
                }
                hideErrorMessage={!shippingEnabled}
                key={shippingEnabled ? 'widthValidation' : 'noWidthValidation'}
              />
              <FieldTextInput
                id={`${formId}.parcelHeightIn`}
                name="parcelHeightIn"
                className={css.dimensionField}
                type="number"
                min="1"
                step="1"
                label={intl.formatMessage({ id: 'EditListingDeliveryForm.parcelHeightLabel' })}
                disabled={!shippingEnabled}
                validate={
                  shippingEnabled
                    ? required(
                        intl.formatMessage({ id: 'EditListingDeliveryForm.parcelDimensionRequired' })
                      )
                    : null
                }
                hideErrorMessage={!shippingEnabled}
                key={shippingEnabled ? 'heightValidation' : 'noHeightValidation'}
              />
            </div>
            <FieldCurrencyInput
              id={`${formId}.parcelDeclaredValue`}
              name="parcelDeclaredValue"
              className={css.input}
              label={intl.formatMessage({
                id: 'EditListingDeliveryForm.parcelDeclaredValueLabel',
              })}
              placeholder={intl.formatMessage({
                id: 'EditListingDeliveryForm.parcelDeclaredValuePlaceholder',
              })}
              currencyConfig={currencyConfig}
              disabled={!shippingEnabled}
              validate={
                shippingEnabled
                  ? required(
                      intl.formatMessage({
                        id: 'EditListingDeliveryForm.parcelDeclaredValueRequired',
                      })
                    )
                  : null
              }
              hideErrorMessage={!shippingEnabled}
              key={shippingEnabled ? 'declaredValidation' : 'noDeclaredValidation'}
            />
          </div>

          <Button
            className={css.submitButton}
            type="submit"
            inProgress={submitInProgress}
            disabled={submitDisabled}
            ready={submitReady}
          >
            {saveActionMsg}
          </Button>
        </Form>
      );
    }}
  />
);

export default EditListingDeliveryForm;
