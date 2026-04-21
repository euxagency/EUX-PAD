/**
 * Store / pickup address and map block.
 */

import { __ } from '@wordpress/i18n';
import LocationIcon from '../icons/LocationIcon';
import PhoneIcon from '../icons/PhoneIcon';
import ClockIcon from '../icons/ClockIcon';

export default function StoreInfo({ address, pickupSettings }) {
    const a = address || {};
    const p = pickupSettings || {};
    const addressText =
        p.address && p.address.trim().length
            ? p.address
            : `${[a.name, a.address].filter(Boolean).join(', ')}\n${[a.suburb, a.state, a.postcode].filter(Boolean).join(' ')}`;
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
    return (
        <div className="wpd-store-info">
            <h3>{__('Pickup Address', 'eux-pad')}</h3>
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
                {/* <div className="wpd-store-detail-divider" /> */}
                <div className="wpd-store-detail-item">
                    <div className="wpd-store-icon">
                        <PhoneIcon />
                    </div>
                    <div className="wpd-store-detail-content">
                        <div className="wpd-store-detail-label">{__('Phone', 'eux-pad')}</div>
                        <div className="wpd-store-detail-value">{phone}</div>
                    </div>
                </div>
                <div className="wpd-store-detail-item">
                    <div className="wpd-store-icon">
                        <ClockIcon />
                    </div>
                    <div className="wpd-store-detail-content">
                        <div className="wpd-store-detail-label">{__('Opening Hours', 'eux-pad')}</div>
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
