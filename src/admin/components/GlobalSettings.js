import { __, sprintf } from '@wordpress/i18n';
import { useEffect, useMemo, useState, useId } from '@wordpress/element';
import {
    Card,
    CardBody,
    ColorPicker,
    Dropdown,
    Flex,
    TextControl,
    ToggleControl,
    Notice,
    Spinner,
} from '@wordpress/components';
import AdminPageLayout from './AdminPageLayout';
import { setApiDefaults } from '../utils/api';

const apiFetch = window.wp?.apiFetch;

const DEFAULTS = {
    pad_page_id: 0,
    show_checkout_progress_bar: true,
    show_date_refresh_timer: true,
    date_refresh_timer_seconds: 300,
    labels: {
        continue_button_text: 'Continue',
    },
    icons: {
        pickup_icon_id: 0,
        pickup_icon_url: '',
        delivery_icon_id: 0,
        delivery_icon_url: '',
    },
    colors: {
        tab_hover_bg: '#FFFFFF',
        tab_selected_bg: '#111111',
        tab_selected_text: '#335CFF',
        tab_text: '#2E5F2A',
        day_name: '#F5F5F5',
        day_number: '#111111',
        day_name_selected: '#F5F5F5',
        day_number_selected: '#111111',
        day_selector_bg: '#335CFF',
        day_selector_bg_selected: '#335CFF',
        time_selector_bg: '#F5F5F5',
        time_selector_text: '#111111',
        time_selector_bg_selected: '#335CFF',
        time_selector_text_selected: '#F5F5F5',
        continue_button_bg: '#F5F5F5',
        continue_button_text: '#111111',
        continue_button_bg_hover: '#335CFF',
        continue_button_text_hover: '#335CFF',
    },
    days_displayed: 15,
};

function clamp255(n) {
    const x = Math.round(Number(n));
    return Math.min(255, Math.max(0, Number.isFinite(x) ? x : 0));
}

function clamp01(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) {
        return 1;
    }
    return Math.min(1, Math.max(0, x));
}

function parseColorValue(str) {
    const fallback = { r: 0, g: 0, b: 0, a: 1 };
    if (!str || typeof str !== 'string') {
        return fallback;
    }
    const s = str.trim();
    const rgbaM = s.match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)\s*$/i);
    if (rgbaM) {
        return {
            r: clamp255(rgbaM[1]),
            g: clamp255(rgbaM[2]),
            b: clamp255(rgbaM[3]),
            a: clamp01(parseFloat(rgbaM[4])),
        };
    }
    const rgbM = s.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*$/i);
    if (rgbM) {
        return {
            r: clamp255(rgbM[1]),
            g: clamp255(rgbM[2]),
            b: clamp255(rgbM[3]),
            a: 1,
        };
    }
    let hex = s.startsWith('#') ? s.slice(1) : s;
    if (hex.length === 3) {
        hex = hex
            .split('')
            .map((c) => c + c)
            .join('');
    }
    if (hex.length === 6) {
        const n = parseInt(hex, 16);
        if (!Number.isFinite(n)) {
            return fallback;
        }
        return {
            r: (n >> 16) & 255,
            g: (n >> 8) & 255,
            b: n & 255,
            a: 1,
        };
    }
    if (hex.length === 8) {
        const n = parseInt(hex.slice(0, 6), 16);
        const aByte = parseInt(hex.slice(6, 8), 16);
        if (!Number.isFinite(n) || !Number.isFinite(aByte)) {
            return fallback;
        }
        return {
            r: (n >> 16) & 255,
            g: (n >> 8) & 255,
            b: n & 255,
            a: clamp01(aByte / 255),
        };
    }
    return fallback;
}

function formatColorValue({ r, g, b, a }) {
    r = clamp255(r);
    g = clamp255(g);
    b = clamp255(b);
    a = clamp01(a);
    if (a >= 0.999) {
        return `#${[r, g, b]
            .map((x) => x.toString(16).padStart(2, '0'))
            .join('')}`;
    }
    const aRounded = Math.round(a * 1000) / 1000;
    return `rgba(${r}, ${g}, ${b}, ${aRounded})`;
}

/** Hex8 string (#RRGGBBAA) for @wordpress/components ColorPicker when enableAlpha is on. */
function toHex8String(parsed) {
    const r = clamp255(parsed.r);
    const g = clamp255(parsed.g);
    const b = clamp255(parsed.b);
    const alphaByte = Math.round(clamp01(parsed.a) * 255);
    return `#${[r, g, b, alphaByte]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('')}`;
}

function colorHelpImageUrl(filename) {
    const base = typeof window !== 'undefined' ? window.wpdAdmin?.colorHelpImageBase : '';
    if (!base || !filename) {
        return '';
    }
    const normalized = String(base).replace(/\/?$/, '/');
    return normalized + String(filename).replace(/^\//, '');
}

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {function} props.onChange
 * @param {string} [props.tooltip] Help copy; opens in a small panel with optional diagram.
 * @param {string} [props.tooltipDiagram] Filename under assets/img/color-help/ (e.g. tabs.svg).
 */
function ColorField({ label, value, onChange, tooltip, tooltipDiagram }) {
    const parsed = parseColorValue(value || '#000000');
    const pickerColor = toHex8String(parsed);
    const diagramSrc = tooltipDiagram ? colorHelpImageUrl(tooltipDiagram) : '';
    const helpFlyoutId = useId();

    return (
        <div className="wpd-color-field">
            <div className="wpd-color-label-row">
                <div className="wpd-color-label">{label}</div>
                {tooltip ? (
                    <div className="wpd-color-help-hover">
                        <button
                            type="button"
                            className="wpd-color-field__tooltip-trigger"
                            aria-describedby={helpFlyoutId}
                            aria-label={__('Where this color is used (hover for diagram)', 'eux-pad')}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4M12 8h.01" />
                            </svg>
                        </button>
                        <div id={helpFlyoutId} className="wpd-color-help-flyout" role="note">
                            {diagramSrc ? (
                                <img
                                    className="wpd-color-help-flyout__img"
                                    src={diagramSrc}
                                    alt={sprintf(
                                        /* translators: %s: color setting label */
                                        __('Visual reference for: %s', 'eux-pad'),
                                        label
                                    )}
                                    loading="lazy"
                                />
                            ) : null}
                            <p className="wpd-color-help-flyout__text">{tooltip}</p>
                        </div>
                    </div>
                ) : null}
            </div>
            <div className="wpd-color-input-row">
                <Dropdown
                    className="wpd-color-dropdown"
                    popoverProps={{
                        placement: 'bottom-start',
                        className: 'wpd-color-dropdown__popover',
                    }}
                    renderToggle={({ isOpen, onToggle }) => (
                        <button
                            type="button"
                            className="wpd-color-swatch"
                            onClick={onToggle}
                            aria-expanded={isOpen}
                            aria-haspopup="dialog"
                            aria-label={__('Open color picker', 'eux-pad')}
                        >
                            <span
                                className="wpd-color-swatch__fill"
                                style={{
                                    backgroundColor: formatColorValue(parsed),
                                }}
                            />
                        </button>
                    )}
                    renderContent={() => (
                        <div className="wpd-color-picker-wrap">
                            <ColorPicker
                                color={pickerColor}
                                enableAlpha
                                defaultValue="#000000ff"
                                onChange={(hex) =>
                                    onChange(formatColorValue(parseColorValue(hex)))
                                }
                            />
                        </div>
                    )}
                />
                <TextControl
                    value={value || ''}
                    onChange={(v) => onChange(v)}
                    placeholder={__('Hex, #RRGGBBAA, or rgba(…)', 'eux-pad')}
                />
            </div>
        </div>
    );
}

function decodeHtml(input) {
    if (!input) return '';
    const doc = new DOMParser().parseFromString(input, 'text/html');
    return doc.documentElement.textContent || '';
}

function MediaUploadField({ label, valueUrl, onSelect, onClear }) {
    const fileName = useMemo(() => {
        if (!valueUrl) return '';
        try {
            const u = new URL(valueUrl, window.location.origin);
            return decodeURIComponent(u.pathname.split('/').pop() || '');
        } catch (e) {
            return valueUrl.split('/').pop() || '';
        }
    }, [valueUrl]);

    const openMedia = () => {
        if (!window.wp?.media) return;
        const frame = window.wp.media({
            title: label,
            button: { text: __('Select', 'eux-pad') },
            multiple: false,
        });
        frame.on('select', () => {
            const attachment = frame.state().get('selection').first()?.toJSON();
            if (attachment?.url) {
                onSelect({ id: attachment.id || 0, url: attachment.url });
            }
        });
        frame.open();
    };

    return (
        <div className="wpd-upload-field">
            <div className="wpd-field-label">{label}</div>
            <div className="wpd-upload-pill">
                {!fileName ? (
                    <>
                        <button
                            type="button"
                            className="wpd-upload-choose wpd-upload-choose--empty"
                            onClick={openMedia}
                        >
                            {__('Choose file', 'eux-pad')}
                        </button>
                        <span className="wpd-upload-placeholder">
                            {__('No file chosen', 'eux-pad')}
                        </span>
                    </>
                ) : (
                    <>
                        <div className="wpd-upload-chip">
                            <span className="wpd-upload-chip__name">{fileName}</span>
                            <button
                                type="button"
                                className="wpd-upload-chip__remove"
                                onClick={onClear}
                                aria-label={__('Remove', 'eux-pad')}
                            >
                                ×
                            </button>
                        </div>
                        
                    </>
                )}
            </div>
        </div>
    );
}

export default function GlobalSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [notice, setNotice] = useState(null);
    const [toast, setToast] = useState(null);

    const [settings, setSettings] = useState(DEFAULTS);
    const [padStatus, setPadStatus] = useState(null);
    const [padStatusLoading, setPadStatusLoading] = useState(true);
    const [ensuringPad, setEnsuringPad] = useState(false);

    const load = async () => {
        setApiDefaults();
        setLoading(true);
        setNotice(null);
        try {
            const res = await apiFetch({ path: '/wpd/v1/settings/global' });
            if (res?.success && res?.data) {
                setSettings(res.data);
            }
        } catch (e) {
            setNotice({ status: 'error', message: __('Failed to load settings.', 'eux-pad') });
        } finally {
            setLoading(false);
        }
    };

    const loadPadStatus = async () => {
        setApiDefaults();
        setPadStatusLoading(true);
        try {
            const res = await apiFetch({ path: '/wpd/v1/pad-page' });
            if (res?.success && res?.data) {
                setPadStatus(res.data);
            }
        } catch (e) {
            setPadStatus(null);
        } finally {
            setPadStatusLoading(false);
        }
    };

    useEffect(() => {
        load();
        loadPadStatus();
    }, []);

    const update = (path, value) => {
        setSettings((prev) => {
            const next = { ...prev };
            if (path.length === 1) {
                next[path[0]] = value;
                return next;
            }
            next[path[0]] = { ...(next[path[0]] || {}) };
            next[path[0]][path[1]] = value;
            return next;
        });
    };

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(timer);
    }, [toast]);

    const save = async () => {
        setApiDefaults();
        setSaving(true);
        setNotice(null);
        try {
            const res = await apiFetch({
                path: '/wpd/v1/settings/global',
                method: 'POST',
                data: settings,
            });
            if (res?.success) {
                setSettings(res.data);
                setToast({ status: 'success', message: __('Settings saved.', 'eux-pad') });
            } else {
                setToast({ status: 'error', message: __('Failed to save settings.', 'eux-pad') });
            }
        } catch (e) {
            setToast({ status: 'error', message: __('Failed to save settings.', 'eux-pad') });
        } finally {
            setSaving(false);
        }
    };

    const ensurePadPage = async () => {
        setApiDefaults();
        setEnsuringPad(true);
        try {
            const res = await apiFetch({
                path: '/wpd/v1/pad-page/ensure',
                method: 'POST',
            });
            if (res?.success && res?.data) {
                setToast({
                    status: 'success',
                    message: res.message || __('PAD page updated.', 'eux-pad'),
                });
                setPadStatus({
                    has_pad_page: true,
                    page_id: res.data.pad_page_id,
                    title: res.data.title || '',
                    slug: res.data.slug || '',
                    url: res.data.url || '',
                });
                setSettings((prev) => ({
                    ...prev,
                    pad_page_id: res.data.pad_page_id || 0,
                }));
            } else {
                setToast({ status: 'error', message: __('Could not set up the PAD page.', 'eux-pad') });
            }
        } catch (e) {
            const msg =
                e?.message ||
                e?.data?.message ||
                __('Could not set up the PAD page.', 'eux-pad');
            setToast({ status: 'error', message: msg });
        } finally {
            setEnsuringPad(false);
        }
    };

    const reset = async () => {
        setApiDefaults();
        setResetting(true);
        setNotice(null);
        try {
            const res = await apiFetch({
                path: '/wpd/v1/settings/global/reset',
                method: 'POST',
            });
            if (res?.success) {
                setSettings(res.data);
                loadPadStatus();
                setToast({
                    status: 'success',
                    message: __('Colors reset to default. Other settings were not changed.', 'eux-pad'),
                });
            } else {
                setToast({ status: 'error', message: __('Failed to reset colors.', 'eux-pad') });
            }
        } catch (e) {
            setToast({ status: 'error', message: __('Failed to reset colors.', 'eux-pad') });
        } finally {
            setResetting(false);
        }
    };

    return (
        <>
        <AdminPageLayout
            title={__('Pickup & Delivery Settings', 'eux-pad')}
            description={__('Configure texts, colors, rules, schedules, and checkout behavior', 'eux-pad')}
            pageTitle={__('Global Settings', 'eux-pad')}
            notice={null}
            loading={loading}
            actions={
                !loading && (
                    <Flex justify="flex-end" gap={2}>
                        <button
                            type="button"
                            className="wpd-admin-btn wpd-admin-btn--ghost"
                            onClick={reset}
                            disabled={saving || resetting}
                        >
                            {resetting
                                ? __('Resetting colors...', 'eux-pad')
                                : __('Reset colors to default', 'eux-pad')}
                        </button>
                        <button
                            type="button"
                            className="wpd-admin-btn wpd-admin-btn--primary"
                            onClick={save}
                            disabled={saving || resetting}
                        >
                            {saving
                                ? __('Saving...', 'eux-pad')
                                : __('Save Settings', 'eux-pad')}
                        </button>
                    </Flex>
                )
            }
        >
            {!loading && (
                <>
                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">{__('PAD Setup', 'eux-pad')}</div>
                                <div className="wpd-admin-section__subtitle">
                                    {__(
                                        'Create or reconnect the storefront page that shows pickup and delivery. It uses the shortcode and is published at /pad when created here.',
                                        'woo-pickup-delivery'
                                    )}
                                </div>
                                {padStatusLoading ? (
                                    <div className="wpd-pad-setup__loading">
                                        <Spinner />
                                    </div>
                                ) : (
                                    <>
                                        {padStatus?.has_pad_page ? (
                                            <p className="wpd-pad-setup__status wpd-pad-setup__status--ok">
                                                {__(
                                                    'A page with the PAD shortcode already exists.',
                                                    'woo-pickup-delivery'
                                                )}
                                                {padStatus.url ? (
                                                    <>
                                                        {' '}
                                                        <a href={padStatus.url} target="_blank" rel="noopener noreferrer">
                                                            {padStatus.title || padStatus.slug || __('View page', 'eux-pad')}
                                                        </a>
                                                        {padStatus.slug ? (
                                                            <span className="wpd-pad-setup__slug">
                                                                {' '}
                                                                ({padStatus.slug})
                                                            </span>
                                                        ) : null}
                                                    </>
                                                ) : null}
                                            </p>
                                        ) : (
                                            <p className="wpd-pad-setup__status">
                                                {__(
                                                    'No page with the PAD shortcode was found. Click the button below to create a published page with slug “pad”.',
                                                    'woo-pickup-delivery'
                                                )}
                                            </p>
                                        )}
                                        <button
                                            type="button"
                                            className="wpd-admin-btn wpd-admin-btn--primary"
                                            onClick={ensurePadPage}
                                            disabled={ensuringPad}
                                        >
                                            {ensuringPad
                                                ? __('Please wait…', 'eux-pad')
                                                : __('Set up PAD page', 'eux-pad')}
                                        </button>
                                    </>
                                )}
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">{__('Checkout progress bar', 'eux-pad')}</div>
                                <div className="wpd-admin-section__subtitle">
                                    {__(
                                        'Show the step indicator (Shopping cart → Pickup & Delivery → Checkout → Order complete) on the cart, PAD, checkout, and order received pages.',
                                        'woo-pickup-delivery'
                                    )}
                                </div>
                                <ToggleControl
                                    label={__('Show checkout progress bar', 'eux-pad')}
                                    checked={settings.show_checkout_progress_bar !== false}
                                    onChange={(val) => update(['show_checkout_progress_bar'], !!val)}
                                />
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">{__('Date refresh countdown', 'eux-pad')}</div>
                                <div className="wpd-admin-section__subtitle">
                                    {__(
                                        'On the Pickup & Delivery page, show a timer next to the date list. When it reaches zero, available dates reload. Enter duration in seconds (default 300).',
                                        'eux-pad'
                                    )}
                                </div>
                                <ToggleControl
                                    label={__('Show countdown timer', 'eux-pad')}
                                    checked={settings.show_date_refresh_timer !== false}
                                    onChange={(val) => update(['show_date_refresh_timer'], !!val)}
                                />
                                <TextControl
                                    label={__('Duration (seconds)', 'eux-pad')}
                                    type="number"
                                    min={15}
                                    max={3600}
                                    value={String(
                                        settings.date_refresh_timer_seconds != null
                                            ? settings.date_refresh_timer_seconds
                                            : 300
                                    )}
                                    disabled={settings.show_date_refresh_timer === false}
                                    onChange={(v) =>
                                        update(
                                            ['date_refresh_timer_seconds'],
                                            Math.min(3600, Math.max(15, parseInt(v, 10) || 300))
                                        )
                                    }
                                    help={__('Allowed range: 15–3600 seconds.', 'eux-pad')}
                                />
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">{__('Labels & tab icons', 'eux-pad')}</div>
                                <div className="wpd-admin-section__subtitle">
                                    {__(
                                        'Continue button text and tab icons. Delivery/pickup tab visibility and titles are under Delivery Settings and Pickup Settings.',
                                        'eux-pad'
                                    )}
                                </div>

                                <TextControl
                                    label={__('Continue button text', 'eux-pad')}
                                    value={settings.labels?.continue_button_text || ''}
                                    onChange={(v) => update(['labels', 'continue_button_text'], v)}
                                />

                                <div className="wpd-admin-grid-2">
                                    <MediaUploadField
                                        label={__('Pickup icon', 'eux-pad')}
                                        valueUrl={settings.icons?.pickup_icon_url}
                                        onSelect={({ id, url }) => {
                                            update(['icons', 'pickup_icon_id'], id);
                                            update(['icons', 'pickup_icon_url'], url);
                                        }}
                                        onClear={() => {
                                            update(['icons', 'pickup_icon_id'], 0);
                                            update(['icons', 'pickup_icon_url'], '');
                                        }}
                                    />
                                    <MediaUploadField
                                        label={__('Delivery icon', 'eux-pad')}
                                        valueUrl={settings.icons?.delivery_icon_url}
                                        onSelect={({ id, url }) => {
                                            update(['icons', 'delivery_icon_id'], id);
                                            update(['icons', 'delivery_icon_url'], url);
                                        }}
                                        onClear={() => {
                                            update(['icons', 'delivery_icon_id'], 0);
                                            update(['icons', 'delivery_icon_url'], '');
                                        }}
                                    />
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">{__('Tabs Colors', 'eux-pad')}</div>
                                <div className="wpd-admin-section__subtitle">{__('Customize tab appearance', 'eux-pad')}</div>
                                <div className="wpd-admin-grid-3">
                                    <ColorField
                                        label={__('Tab hover bg', 'eux-pad')}
                                        value={settings.colors?.tab_hover_bg}
                                        onChange={(v) => update(['colors', 'tab_hover_bg'], v)}
                                        tooltip={__(
                                            'Background of the Pickup / Delivery tabs when you hover them (not the selected tab).',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="tabs.svg"
                                    />
                                    <ColorField
                                        label={__('Tab selected bg', 'eux-pad')}
                                        value={settings.colors?.tab_selected_bg}
                                        onChange={(v) => update(['colors', 'tab_selected_bg'], v)}
                                        tooltip={__(
                                            'Background of the tab that is currently selected (active method).',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="tabs.svg"
                                    />
                                    <ColorField
                                        label={__('Tab selected text', 'eux-pad')}
                                        value={settings.colors?.tab_selected_text}
                                        onChange={(v) => update(['colors', 'tab_selected_text'], v)}
                                        tooltip={__(
                                            'Text and icon color on the selected Pickup / Delivery tab.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="tabs.svg"
                                    />
                                    <ColorField
                                        label={__('Tab text', 'eux-pad')}
                                        value={settings.colors?.tab_text}
                                        onChange={(v) => update(['colors', 'tab_text'], v)}
                                        tooltip={__(
                                            'Text and icon color on tab which is not selected.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="tabs.svg"
                                    />
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">{__('Day Selector Colors', 'eux-pad')}</div>
                                <div className="wpd-admin-section__subtitle">{__('Customize day selector appearance', 'eux-pad')}</div>
                                <div className="wpd-admin-grid-3">
                                    <ColorField
                                        label={__('Day name', 'eux-pad')}
                                        value={settings.colors?.day_name}
                                        onChange={(v) => update(['colors', 'day_name'], v)}
                                        tooltip={__(
                                            'Color of the short weekday label (e.g. Mon) on each day chip before it is selected.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="days.svg"
                                    />
                                    <ColorField
                                        label={__('Day number', 'eux-pad')}
                                        value={settings.colors?.day_number}
                                        onChange={(v) => update(['colors', 'day_number'], v)}
                                        tooltip={__(
                                            'Color of the day-of-month number on each day chip before it is selected.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="days.svg"
                                    />
                                    <ColorField
                                        label={__('Day selector bg', 'eux-pad')}
                                        value={settings.colors?.day_selector_bg}
                                        onChange={(v) => update(['colors', 'day_selector_bg'], v)}
                                        tooltip={__(
                                            'Background of each day chip in the date row when it is not selected.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="days.svg"
                                    />
                                    <ColorField
                                        label={__('Day name (selected)', 'eux-pad')}
                                        value={settings.colors?.day_name_selected}
                                        onChange={(v) => update(['colors', 'day_name_selected'], v)}
                                        tooltip={__(
                                            'Weekday label color on the day chip that is currently selected.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="days.svg"
                                    />
                                    <ColorField
                                        label={__('Day number (selected)', 'eux-pad')}
                                        value={settings.colors?.day_number_selected}
                                        onChange={(v) => update(['colors', 'day_number_selected'], v)}
                                        tooltip={__(
                                            'Day-of-month number color on the selected day chip.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="days.svg"
                                    />
                                    <ColorField
                                        label={__('Day selector bg (selected)', 'eux-pad')}
                                        value={settings.colors?.day_selector_bg_selected}
                                        onChange={(v) => update(['colors', 'day_selector_bg_selected'], v)}
                                        tooltip={__(
                                            'Background of the selected day chip in the date row.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="days.svg"
                                    />
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">{__('Time Selector Colors', 'eux-pad')}</div>
                                <div className="wpd-admin-section__subtitle">{__('Customize time slot appearance', 'eux-pad')}</div>
                                <div className="wpd-admin-grid-3">
                                    <ColorField
                                        label={__('Time selector bg', 'eux-pad')}
                                        value={settings.colors?.time_selector_bg}
                                        onChange={(v) => update(['colors', 'time_selector_bg'], v)}
                                        tooltip={__(
                                            'Background of each time-slot pill before a slot is selected.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="times.svg"
                                    />
                                    <ColorField
                                        label={__('Time selector text', 'eux-pad')}
                                        value={settings.colors?.time_selector_text}
                                        onChange={(v) => update(['colors', 'time_selector_text'], v)}
                                        tooltip={__(
                                            'Text color inside time-slot pills before a slot is selected.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="times.svg"
                                    />
                                    <ColorField
                                        label={__('Time selector bg (selected)', 'eux-pad')}
                                        value={settings.colors?.time_selector_bg_selected}
                                        onChange={(v) => update(['colors', 'time_selector_bg_selected'], v)}
                                        tooltip={__(
                                            'Background of the time-slot pill that is currently selected.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="times.svg"
                                    />
                                    <ColorField
                                        label={__('Time selector text (selected)', 'eux-pad')}
                                        value={settings.colors?.time_selector_text_selected}
                                        onChange={(v) => update(['colors', 'time_selector_text_selected'], v)}
                                        tooltip={__(
                                            'Text color on the selected time-slot pill.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="times.svg"
                                    />
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">{__('Continue Button Colors', 'eux-pad')}</div>
                                <div className="wpd-admin-section__subtitle">{__('Customize button appearance', 'eux-pad')}</div>
                                <div className="wpd-admin-grid-3">
                                    <ColorField
                                        label={__('Continue button background', 'eux-pad')}
                                        value={settings.colors?.continue_button_bg}
                                        onChange={(v) => update(['colors', 'continue_button_bg'], v)}
                                        tooltip={__(
                                            'Background of the Continue button on the PAD page in its default state.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="continue.svg"
                                    />
                                    <ColorField
                                        label={__('Continue button text', 'eux-pad')}
                                        value={settings.colors?.continue_button_text}
                                        onChange={(v) => update(['colors', 'continue_button_text'], v)}
                                        tooltip={__(
                                            'Text color on the Continue button in its default state.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="continue.svg"
                                    />
                                    <ColorField
                                        label={__('Continue button bg (hover)', 'eux-pad')}
                                        value={settings.colors?.continue_button_bg_hover}
                                        onChange={(v) => update(['colors', 'continue_button_bg_hover'], v)}
                                        tooltip={__(
                                            'Continue button background while the pointer is over the button.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="continue.svg"
                                    />
                                    <ColorField
                                        label={__('Continue button text (hover)', 'eux-pad')}
                                        value={settings.colors?.continue_button_text_hover}
                                        onChange={(v) => update(['colors', 'continue_button_text_hover'], v)}
                                        tooltip={__(
                                            'Continue button text color while the pointer is over the button.',
                                            'eux-pad'
                                        )}
                                        tooltipDiagram="continue.svg"
                                    />
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">{__('Days displayed', 'eux-pad')}</div>
                                <div className="wpd-admin-section__subtitle">{__('How many days to display in the calendar', 'eux-pad')}</div>
                                <TextControl
                                    type="number"
                                    min={1}
                                    max={60}
                                    value={settings.days_displayed}
                                    onChange={(v) => update(['days_displayed'], parseInt(v, 10) || 15)}
                                />
                            </div>
                        </CardBody>
                    </Card>
                </>
            )}
        </AdminPageLayout>
        {toast && (
            <div className={`wpd-admin-toast wpd-admin-toast--${toast.status}`}>
                {toast.message}
            </div>
        )}
        </>
    );
}

