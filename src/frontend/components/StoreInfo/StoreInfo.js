/**
 * Store / pickup address and map block.
 */

import { __ } from '@wordpress/i18n';
import LocationIcon from '../icons/LocationIcon';
import PhoneIcon from '../icons/PhoneIcon';
import ClockIcon from '../icons/ClockIcon';

/**
 * When `p.address` is empty but multi-store structured fields exist on localized pickup settings.
 *
 * @param {Record<string, unknown>} p
 * @returns {string}
 */
function formatAddressFromStructuredParts(p) {
    const sn = String(p.street_number ?? '').trim();
    const st = String(p.street_name ?? '').trim();
    const city = String(p.city ?? '').trim();
    const state = String(p.state ?? '').trim();
    const pc = String(p.postcode ?? '').trim();
    const country = String(p.country ?? '').trim();
    const line1 = [sn, st].filter(Boolean).join(' ').trim();
    const lines = [];
    if (line1) {
        lines.push(line1);
    }
    if (city) {
        lines.push(city);
    }
    const tail = [state, pc, country].filter(Boolean);
    if (tail.length) {
        lines.push(tail.join(' '));
    }
    return lines.join('\n');
}

export default function StoreInfo({ address, pickupSettings, heading, hideTitle = false }) {
    const a = address || {};
    const p = pickupSettings || {};
    const fromParts = formatAddressFromStructuredParts(p).trim();
    const addressText =
        p.address && String(p.address).trim().length
            ? String(p.address).trim()
            : fromParts ||
              `${[a.name, a.address].filter(Boolean).join(', ')}\n${[a.suburb, a.state, a.postcode].filter(Boolean).join(' ')}`;
    const phone = p.phone || a.phone || '1300 477 024';

    const openingLines =
        Array.isArray(p.opening_hours) && p.opening_hours.length
            ? p.opening_hours.map((row) => {
                  if (!row.day || !row.start || !row.end) return null;
                  const day = row.day;
                  const start = row.start;
                  const end = row.end;
                  return `${day}: ${start} – ${end}`;
              }).filter(Boolean)
            : null;

    const hours =
        openingLines && openingLines.length
            ? openingLines.join('\n')
            : a.hours || 'Monday – Friday : 6:30am – 4:00pm';
    const mapIframe = p.map_iframe || '';
    const title =
        typeof heading === 'string' && heading.trim().length > 0 ? heading.trim() : __('Pickup Address', 'eux-pickup-delivery');

    return (
        <div className="wpd-store-info">
            {!hideTitle ? <h3>{title}</h3> : null}
            <div className="wpd-store-details">
                <div className="wpd-store-detail-item">
                    <div className="wpd-store-icon">
                        <LocationIcon />
                    </div>
                    <div className="wpd-store-detail-content">
                        <div className="wpd-store-address-text" style={{ whiteSpace: 'pre-line' }}>
                            {addressText}
                        </div>
                    </div>
                </div>
                <div className="wpd-store-detail-item">
                    <div className="wpd-store-icon">
                        <PhoneIcon />
                    </div>
                    <div className="wpd-store-detail-content">
                        <div className="wpd-store-detail-label">{__('Phone', 'eux-pickup-delivery')}</div>
                        <div className="wpd-store-detail-value">{phone}</div>
                    </div>
                </div>
                <div className="wpd-store-detail-item">
                    <div className="wpd-store-icon">
                        <ClockIcon />
                    </div>
                    <div className="wpd-store-detail-content">
                        <div className="wpd-store-detail-label">{__('Opening Hours', 'eux-pickup-delivery')}</div>
                        <div className="wpd-store-detail-value" style={{ whiteSpace: 'pre-line' }}>
                            {hours}
                        </div>
                    </div>
                </div>
            </div>
            <div className="wpd-store-map">
                {mapIframe ? (
                    <div dangerouslySetInnerHTML={{ __html: mapIframe }} />
                ) : null}
            </div>
        </div>
    );
}
