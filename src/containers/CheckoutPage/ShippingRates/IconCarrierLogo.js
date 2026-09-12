import React from 'react';
import classNames from 'classnames';

import css from './IconCarrierLogo.module.css';

/**
 * Circular carrier mark for a shipping rate row.
 *
 * @param {Object} props
 * @param {string} [props.carrier]
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
const IconCarrierLogo = props => {
  const { carrier, className } = props;
  const key = String(carrier || '')
    .trim()
    .toLowerCase();
  const classes = classNames(css.root, className);

  if (key === 'usps') {
    return <UspsMark className={classes} />;
  }
  if (key === 'ups') {
    return <UpsMark className={classes} />;
  }
  if (key === 'fedex') {
    return <FedexMark className={classes} />;
  }
  return <GenericMark className={classes} />;
};

const UspsMark = ({ className }) => (
  <svg className={className} viewBox="0 0 40 40" role="img" aria-hidden="true">
    <circle cx="20" cy="20" r="20" fill="#004B87" />
    <path
      fill="#fff"
      d="M20 7.5c.4 2.2 1.8 4 3.7 5.1 1.2.7 2.6 1.1 4.1 1.2l-1.5 1.6H23c.2.5.6 1.1 1.2 1.6 1.1.9 2.6 1.4 4.3 1.5-2.4.6-4.3 1.8-5.5 3.4V28c0 .8-.7 1.4-1.5 1.4H18.5c-.8 0-1.5-.6-1.5-1.4v-6.1c-1.2-1.6-3.1-2.8-5.5-3.4 1.7-.1 3.2-.6 4.3-1.5.6-.5 1-1.1 1.2-1.6h-3.3L12.2 13.8c1.5-.1 2.9-.5 4.1-1.2 1.9-1.1 3.3-2.9 3.7-5.1z"
    />
    <path fill="#fff" d="M10.8 30.2h18.4v1.8H10.8z" />
    <path
      fill="#fff"
      d="M8.8 14.8c1.6-.2 3.1.3 4.2 1.3-.9.2-1.8.6-2.5 1.2-1.1-1-1.6-2.5-1.7-2.5zm22.4 0c-1.6-.2-3.1.3-4.2 1.3.9.2 1.8.6 2.5 1.2 1.1-1 1.6-2.5 1.7-2.5z"
    />
  </svg>
);

const UpsMark = ({ className }) => (
  <svg className={className} viewBox="0 0 40 40" role="img" aria-hidden="true">
    <circle cx="20" cy="20" r="20" fill="#351C15" />
    <path
      fill="#FFB500"
      d="M13 8.8h14v16.6c0 2.2-1.5 4.2-3.8 5.2L20 32.2l-3.2-1.6C14.5 29.6 13 27.6 13 25.4V8.8z"
    />
    <path
      fill="#351C15"
      d="M14.8 14.2h2.1l1.5 5.1 1.5-5.1h2.1l-2.7 8.1h-1.8l-2.7-8.1zm8.2 0h3.8v1.6h-1.8v6.5h-2v-6.5h-1.8v-1.6h1.8z"
    />
  </svg>
);

const FedexMark = ({ className }) => (
  <svg className={className} viewBox="0 0 40 40" role="img" aria-hidden="true">
    <circle cx="20" cy="20" r="20" fill="#fff" />
    <circle cx="20" cy="20" r="19" fill="none" stroke="#E5E5EA" strokeWidth="2" />
    <path
      fill="#4D148C"
      d="M6.8 16.2h5.6v1.6H8.6v1.4h3.5v1.6H8.6v2.8H6.8v-7.4zm6.4 0h1.8v7.4h-1.8v-7.4zm2.4 0h3.2c1.7 0 2.7 1 2.7 2.4 0 1.1-.6 1.9-1.6 2.2l1.9 2.8h-2.1l-1.6-2.5h-.7v2.5h-1.8v-7.4zm1.8 1.5v1.8h1.1c.6 0 1-.3 1-.9s-.4-.9-1-.9h-1.1z"
    />
    <path fill="#FF6600" d="M24.2 16.2h1.9l2.4 4.2 2.4-4.2h1.9l-3.5 5.6v1.8h-1.8v-1.8l-3.3-5.6z" />
  </svg>
);

const GenericMark = ({ className }) => (
  <svg className={className} viewBox="0 0 40 40" role="img" aria-hidden="true">
    <circle cx="20" cy="20" r="20" fill="#6B7280" />
    <path
      fill="#fff"
      d="M11 16.4 20 12l9 4.4v11.2L20 32l-9-4.4V16.4zm9 2.2 5.8-2.8L20 13l-5.8 2.8L20 18.6zm-7.2 1.4v8.6L19 32V20.6l-6.2-3zm8.4 10.6 6.2-3v-8.6l-6.2 3V30.6z"
    />
  </svg>
);

export default IconCarrierLogo;
