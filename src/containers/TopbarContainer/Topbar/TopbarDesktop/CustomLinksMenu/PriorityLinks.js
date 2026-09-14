import React, { useEffect, useRef } from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../../../util/reactIntl';

import { ExternalLink, NamedLink } from '../../../../../components';

import css from './PriorityLinks.module.css';

/**
 * Create component that shows only a single "Post a new listing" link.
 *
 * @param {*} props contains customLinksMenuClass
 * @returns div with only one link inside.
 */
export const CreateListingMenuLink = props => {
  return (
    <div className={props.customLinksMenuClass}>
      <NamedLink name="NewListingPage" className={classNames(css.priorityLink, css.highlight)}>
        <span className={css.priorityLinkLabel}>
          <FormattedMessage id="TopbarDesktop.createListing" />
        </span>
      </NamedLink>
    </div>
  );
};

/**
 * True when a measured topbar link has a usable layout width.
 * `0` means the desktop topbar is hidden (`display: none` below --viewportLarge).
 *
 * @param {number} width
 * @returns {boolean}
 */
const hasPositiveWidth = width => typeof width === 'number' && width > 0;

/**
 * Link component that can be used on TopbarDesktop.
 *
 * @param {*} props containing linkConfig including resolved 'route' params for NamedLink.
 * @returns NamedLink or ExternalLink component based on config.
 */
const PriorityLink = ({ linkConfig }) => {
  const { text, type, href, route, highlight } = linkConfig;
  const classes = classNames(css.priorityLink, { [css.highlight]: highlight });
  const id = `priority-link-${text.toLowerCase().replace(/ /g, '-')}`;

  // Note: if the config contains 'route' keyword,
  // then in-app linking config has been resolved already.
  if (type === 'internal' && route) {
    // Internal link
    const { name, params, to } = route || {};
    return (
      <NamedLink name={name} params={params} to={to} className={classes} id={id}>
        <span className={css.priorityLinkLabel}>{text}</span>
      </NamedLink>
    );
  }
  return (
    <ExternalLink href={href} className={classes}>
      <span className={css.priorityLinkLabel}>{text}</span>
    </ExternalLink>
  );
};

/**
 * Create priority links, which are visible on the desktop layout on the Topbar.
 * If space is limited, this doesn't include anything to the Topbar.
 *
 * @param {*} props contains links array and setLinks function
 * @returns list of priority links.
 */
const PriorityLinks = props => {
  const containerRef = useRef(null);

  // Measure link widths before grouping. Skip 0-width results (desktop topbar is
  // `display: none` below --viewportLarge). A 0 width used to look unmeasured and
  // call setLinks forever.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return undefined;
    }

    const measure = () => {
      if (!props.links?.length || hasPositiveWidth(props.links[0]?.width)) {
        return;
      }
      const childElements = [...node.children];
      let cumulatedWidth = 0;
      const linksWithWidths = [];
      for (let i = 0; i < props.links.length; i++) {
        const width = childElements[i]?.offsetWidth;
        if (!hasPositiveWidth(width)) {
          return;
        }
        cumulatedWidth += width;
        linksWithWidths.push({ ...props.links[i], width, cumulatedWidth });
      }
      props.setLinks(linksWithWidths);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [props.links, props.setLinks]);

  const { links, priorityLinks } = props;
  const isMeasured = links?.[0]?.width && (priorityLinks.length === 0 || priorityLinks?.[0]?.width);
  const styleWrapper = !!isMeasured
    ? {}
    : {
        style: {
          position: 'absolute',
          top: '-2000px',
          left: '-2000px',
          width: '100%',
          height: 'var(--topbarHeightDesktop)',
          display: 'flex',
          flexDirection: 'row',
        },
      };
  const linkConfigs = isMeasured ? priorityLinks : links;

  // Always render inline in the Topbar tree so SSR and the initial client render match.
  // (Portaling to document.body caused hydration mismatches.)
  return (
    <ul className={css.priorityLinkWrapper} {...styleWrapper} ref={containerRef}>
      {linkConfigs.map((linkConfig, index) => {
        return (
          <li key={`${linkConfig.text}_${index}`} className={css.priorityLinkItem}>
            <PriorityLink linkConfig={linkConfig} />
          </li>
        );
      })}
    </ul>
  );
};

export default PriorityLinks;
