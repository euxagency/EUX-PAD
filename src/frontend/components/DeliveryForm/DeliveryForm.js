/**
 * Delivery address form (manual entry only).
 */

import { __ } from '@wordpress/i18n';
import { useState, useRef, useEffect, useMemo, useId } from '@wordpress/element';

function normSuburb(s) {
    return String(s).trim().toLowerCase();
}

/**
 * Searchable single-select; same visual treatment as other `.wpd-form-group input` fields.
 */
function SuburbSearchSelect({ value, onChange, suburbs, hasError }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const blurCloseTimer = useRef(null);
    const listId = useId();

    const cancelBlurClose = () => {
        if (blurCloseTimer.current != null) {
            window.clearTimeout(blurCloseTimer.current);
            blurCloseTimer.current = null;
        }
    };

    const scheduleBlurClose = () => {
        cancelBlurClose();
        blurCloseTimer.current = window.setTimeout(() => {
            blurCloseTimer.current = null;
            setOpen(false);
            setQuery('');
        }, 150);
    };

    const options = useMemo(
        () => [...suburbs].sort((a, b) => String(a).localeCompare(String(b))),
        [suburbs]
    );

    const filtered = useMemo(() => {
        const q = normSuburb(query);
        if (!q) {
            return options;
        }
        return options.filter((s) => normSuburb(s).includes(q));
    }, [options, query]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onDoc = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                cancelBlurClose();
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    useEffect(() => () => cancelBlurClose(), []);

    const openMenu = () => {
        cancelBlurClose();
        setOpen(true);
        setQuery(value || '');
    };

    /** Search text while open; closed shows only the saved choice (never free-typed suburb). */
    const displayValue = open ? query : value || '';

    return (
        <div className="wpd-suburb-combobox" ref={rootRef}>
            <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                aria-autocomplete="list"
                value={displayValue}
                onChange={(e) => {
                    setQuery(e.target.value);
                    if (!open) {
                        setOpen(true);
                    }
                }}
                onFocus={openMenu}
                onBlur={scheduleBlurClose}
                placeholder={__('Search or select suburb', 'eux-pickup-delivery')}
                className={hasError ? 'wpd-field-error' : ''}
            />
            {open && (
                <ul
                    id={listId}
                    className="wpd-suburb-combobox__list"
                    role="listbox"
                    onMouseDown={cancelBlurClose}
                >
                    {filtered.length === 0 ? (
                        <li className="wpd-suburb-combobox__empty">{__('No matches', 'eux-pickup-delivery')}</li>
                    ) : (
                        filtered.map((s) => (
                            <li
                                key={s}
                                role="option"
                                aria-selected={normSuburb(s) === normSuburb(value)}
                                className="wpd-suburb-combobox__option"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    cancelBlurClose();
                                    onChange(s);
                                    setOpen(false);
                                    setQuery('');
                                    inputRef.current?.blur();
                                }}
                            >
                                {s}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}

export default function DeliveryForm({
    form,
    onChange,
    states,
    onGetDays,
    fieldErrors = {},
    deliverySuburbs = [],
}) {
    const useSuburbList = Array.isArray(deliverySuburbs) && deliverySuburbs.length > 0;

    return (
        <div className="wpd-delivery-form">
            <h3>{__('Delivery Address', 'eux-pickup-delivery')}</h3>
            <p></p>

            <div className="wpd-form-group">
                <label>{__('Street Address', 'eux-pickup-delivery')} *</label>
                <input
                    id="wpd-street-address-input"
                    type="text"
                    value={form.streetAddress}
                    onChange={(e) => onChange('streetAddress', e.target.value)}
                    placeholder={__('Enter street address', 'eux-pickup-delivery')}
                    className={fieldErrors.streetAddress ? 'wpd-field-error' : ''}
                    autoComplete="off"
                />
            </div>

            <div className="wpd-manual-address-fields wpd-visible">
                <div className="wpd-form-group">
                    <label>{__('Suburb', 'eux-pickup-delivery')} *</label>
                    {useSuburbList ? (
                        <SuburbSearchSelect
                            value={form.suburb}
                            onChange={(v) => onChange('suburb', v)}
                            suburbs={deliverySuburbs}
                            hasError={!!fieldErrors.suburb}
                        />
                    ) : (
                        <input
                            type="text"
                            value={form.suburb}
                            onChange={(e) => onChange('suburb', e.target.value)}
                            placeholder={__('Enter suburb', 'eux-pickup-delivery')}
                            className={fieldErrors.suburb ? 'wpd-field-error' : ''}
                        />
                    )}
                </div>
                <div className="wpd-form-group">
                    <label>{__('State', 'eux-pickup-delivery')} *</label>
                    <select value={form.state} onChange={(e) => onChange('state', e.target.value)}>
                        {Object.entries(states || {}).map(([code, name]) => (
                            <option key={code} value={code}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="wpd-form-group">
                    <label>{__('Postcode', 'eux-pickup-delivery')} *</label>
                    <input
                        type="text"
                        value={form.postcode}
                        onChange={(e) => onChange('postcode', e.target.value)}
                        placeholder={__('Enter postcode', 'eux-pickup-delivery')}
                        className={fieldErrors.postcode ? 'wpd-field-error' : ''}
                    />
                </div>
            </div>

            <div className="wpd-form-group">
                <label>{__('Delivery Instructions', 'eux-pickup-delivery')}</label>
                <textarea
                    value={form.instructions}
                    onChange={(e) => onChange('instructions', e.target.value)}
                    placeholder={__('Add Comment', 'eux-pickup-delivery')}
                    className={fieldErrors.instructions ? 'wpd-field-error' : ''}
                />
            </div>

            <div className="wpd-form-group">
                <button type="button" className="wpd-get-days-button" onClick={onGetDays}>
                    {__('Check Available Dates', 'eux-pickup-delivery')}
                </button>
            </div>
        </div>
    );
}
