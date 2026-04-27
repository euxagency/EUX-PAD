/**
 * Structured pickup address (two fields per row, WC country + state dropdowns).
 * Used by single-store Pickup Settings and Multi-Store store cards.
 */

import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { TextControl } from '@wordpress/components';
import RulesCustomSelect from './RulesCustomSelect';

const wpdAdmin = typeof window !== 'undefined' ? window.wpdAdmin || {} : {};

/**
 * @returns {{ value: string, label: string }[]}
 */
export function buildCountrySelectOptions() {
    const c = wpdAdmin.wcCountries;
    if (!c || typeof c !== 'object' || Object.keys(c).length === 0) {
        return [{ value: 'AU', label: __('Australia', 'eux-pad') }];
    }
    const pairs = Object.keys(c).map((code) => ({
        value: code,
        label: `${String(c[code])} (${String(code)})`,
    }));
    pairs.sort((a, b) => a.label.localeCompare(b.label));
    const auIdx = pairs.findIndex((p) => p.value === 'AU');
    if (auIdx > 0) {
        const [au] = pairs.splice(auIdx, 1);
        pairs.unshift(au);
    }
    return pairs;
}

/**
 * @param {string} countryCode
 * @param {string} currentState
 * @returns {{ value: string, label: string }[]|null}
 */
export function buildStateSelectOptions(countryCode, currentState) {
    const cc = String(countryCode || 'AU').toUpperCase();
    const raw = wpdAdmin.wcCountryStates?.[cc];
    const emptyOpt = { value: '', label: __('Select state / province', 'eux-pad') };
    if (raw && typeof raw === 'object') {
        const opts = Object.keys(raw).map((code) => ({
            value: code,
            label: String(raw[code]),
        }));
        opts.sort((a, b) => a.label.localeCompare(b.label));
        const cur = currentState != null ? String(currentState) : '';
        if (cur && !opts.some((o) => String(o.value) === cur)) {
            opts.unshift({ value: cur, label: cur });
        }
        return [emptyOpt, ...opts];
    }
    return null;
}

/**
 * @param {object} props
 * @param {{ street_number?: string, street_name?: string, city?: string, state?: string, postcode?: string, country?: string }} props.values
 * @param {(patch: object) => void} props.onChange
 * @param {string} [props.sectionTitle]
 * @param {string} [props.sectionHelp]
 */
export default function PickupAddressFields({ values, onChange, sectionTitle, sectionHelp }) {
    const v = values || {};
    const countryOptions = useMemo(() => buildCountrySelectOptions(), []);
    const stateOptions = useMemo(
        () => buildStateSelectOptions(v.country, v.state),
        [v.country, v.state]
    );

    const patch = (p) => onChange(p);

    const onCountryChange = (newCountry) => {
        const cc = String(newCountry || 'AU').toUpperCase();
        const nextStates = buildStateSelectOptions(cc, v.state);
        let nextState = v.state != null ? String(v.state) : '';
        if (nextStates) {
            const allowed = new Set(nextStates.map((o) => String(o.value)).filter(Boolean));
            if (!allowed.has(nextState)) {
                nextState = '';
            }
        }
        patch({ country: cc, state: nextState });
    };

    const title = sectionTitle || __('Address', 'eux-pad');
    const help =
        sectionHelp || __('Shown on the pickup page. Used as the pickup location for checkout when applicable.', 'eux-pad');

    return (
        <>
            <div className="wpd-opening-label" style={{ marginTop: 4 }}>
                {title}
            </div>
            <p className="wpd-admin-section__subtitle" style={{ marginTop: 0, marginBottom: 10 }}>
                {help}
            </p>
            <div className="wpd-store-address-grid">
                <div className="wpd-store-address-pair">
                    <TextControl
                        label={__('Street number', 'eux-pad')}
                        value={v.street_number ?? ''}
                        onChange={(x) => patch({ street_number: x })}
                    />
                    <TextControl
                        label={__('Street name', 'eux-pad')}
                        value={v.street_name ?? ''}
                        onChange={(x) => patch({ street_name: x })}
                    />
                </div>
                <div className="wpd-store-address-pair">
                    <TextControl
                        label={__('City', 'eux-pad')}
                        value={v.city ?? ''}
                        onChange={(x) => patch({ city: x })}
                    />
                    <TextControl
                        label={__('Postcode', 'eux-pad')}
                        value={v.postcode ?? ''}
                        onChange={(x) => patch({ postcode: x })}
                    />
                </div>
                <div className="wpd-store-address-pair">
                    {stateOptions ? (
                        <RulesCustomSelect
                            className="wpd-store-address-state-select"
                            label={__('State', 'eux-pad')}
                            value={v.state ?? ''}
                            options={stateOptions}
                            onChange={(x) => patch({ state: x != null ? String(x) : '' })}
                            placeholder={__('Select state / province', 'eux-pad')}
                            portalDropdownClassName="wpd-store-address-dropdown--wide"
                            portalMaxWidth="min(420px, calc(100vw - 24px))"
                        />
                    ) : (
                        <TextControl
                            label={__('State / province', 'eux-pad')}
                            value={v.state ?? ''}
                            onChange={(x) => patch({ state: x })}
                        />
                    )}
                    <RulesCustomSelect
                        className="wpd-store-address-country-select"
                        label={__('Country', 'eux-pad')}
                        value={v.country && String(v.country).length ? String(v.country).toUpperCase() : 'AU'}
                        options={countryOptions}
                        onChange={onCountryChange}
                        placeholder={__('Select country', 'eux-pad')}
                        portalDropdownClassName="wpd-store-address-dropdown--wide"
                        portalMaxWidth="min(480px, calc(100vw - 24px))"
                    />
                </div>
            </div>
        </>
    );
}
