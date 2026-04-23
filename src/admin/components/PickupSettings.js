import { __ } from '@wordpress/i18n';
import { useEffect, useState, useCallback } from '@wordpress/element';
import {
    Button,
    Card,
    CardBody,
    Flex,
    TextControl,
    TextareaControl,
    ToggleControl,
} from '@wordpress/components';
import AdminPageLayout from './AdminPageLayout';
import RulesCustomSelect from './RulesCustomSelect';
import PickupStoresPanel from './PickupStoresPanel';
import { setApiDefaults } from '../utils/api';

const apiFetch = window.wp?.apiFetch;

const wpdAdmin = typeof window !== 'undefined' ? window.wpdAdmin || {} : {};
const multiPickupStoresAddon = !!wpdAdmin.multiPickupStoresAddon;

const DEFAULTS = {
    address: '',
    phone: '',
    interval: 60,
    opening_hours: [],
    tab_enabled: true,
    tab_title: '',
};

const ALL_DAYS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
];

/** One row per weekday; server also caps at this count. */
const MAX_OPENING_ROWS = 7;

export default function PickupSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [notice, setNotice] = useState(null);
    const [toast, setToast] = useState(null);
    const [settings, setSettings] = useState(DEFAULTS);
    const [pickupStores, setPickupStores] = useState([]);

    const loadStores = useCallback(async () => {
        if (!multiPickupStoresAddon || !apiFetch) {
            return [];
        }
        try {
            const res = await apiFetch({ path: '/wpd/v1/settings/pickup-stores' });
            if (res?.success && Array.isArray(res?.data)) {
                return res.data;
            }
        } catch (e) {
            /* REST missing if add-on deactivated */
        }
        return [];
    }, []);

    const load = async () => {
        setApiDefaults();
        setLoading(true);
        setNotice(null);
        try {
            const [res, storesList] = await Promise.all([apiFetch({ path: '/wpd/v1/settings/pickup' }), loadStores()]);
            if (res?.success && res?.data) {
                const data = { ...res.data };
                if (Array.isArray(data.opening_hours) && data.opening_hours.length > MAX_OPENING_ROWS) {
                    data.opening_hours = data.opening_hours.slice(0, MAX_OPENING_ROWS);
                }
                if (typeof data.tab_enabled !== 'boolean') {
                    data.tab_enabled = true;
                }
                if (typeof data.tab_title !== 'string') {
                    data.tab_title = '';
                }
                setSettings(data);
            }
            if (multiPickupStoresAddon) {
                setPickupStores(Array.isArray(storesList) ? storesList : []);
            }
        } catch (e) {
            setNotice({ status: 'error', message: __('Failed to load pickup settings.', 'eux-pad') });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const update = (key, value) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const updateOpeningRow = (index, patch) => {
        setSettings((prev) => {
            const rows = Array.isArray(prev.opening_hours) ? [...prev.opening_hours] : [];
            rows[index] = { ...rows[index], ...patch };
            return { ...prev, opening_hours: rows };
        });
    };

    const addOpeningRow = () => {
        setSettings((prev) => {
            const rows = Array.isArray(prev.opening_hours) ? [...prev.opening_hours] : [];
            if (rows.length >= MAX_OPENING_ROWS) {
                return prev;
            }
            rows.push({ day: '', start: '', end: '' });
            return { ...prev, opening_hours: rows };
        });
    };

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(timer);
    }, [toast]);

    const removeOpeningRow = (index) => {
        setSettings((prev) => {
            const rows = Array.isArray(prev.opening_hours) ? [...prev.opening_hours] : [];
            rows.splice(index, 1);
            return { ...prev, opening_hours: rows };
        });
    };

    const save = async () => {
        setApiDefaults();
        setSaving(true);
        setNotice(null);
        try {
            const res = await apiFetch({
                path: '/wpd/v1/settings/pickup',
                method: 'POST',
                data: settings,
            });
            if (!res?.success) {
                setToast({ status: 'error', message: __('Failed to save pickup settings.', 'eux-pad') });
                setSaving(false);
                return;
            }
            const data = { ...res.data };
            if (Array.isArray(data.opening_hours) && data.opening_hours.length > MAX_OPENING_ROWS) {
                data.opening_hours = data.opening_hours.slice(0, MAX_OPENING_ROWS);
            }
            if (typeof data.tab_enabled !== 'boolean') {
                data.tab_enabled = true;
            }
            if (typeof data.tab_title !== 'string') {
                data.tab_title = '';
            }
            setSettings(data);

            if (multiPickupStoresAddon) {
                const resStores = await apiFetch({
                    path: '/wpd/v1/settings/pickup-stores',
                    method: 'POST',
                    data: { stores: pickupStores },
                });
                if (resStores?.success && Array.isArray(resStores.data)) {
                    setPickupStores(resStores.data);
                } else {
                    setToast({
                        status: 'error',
                        message: __('Pickup tab saved, but pickup stores failed to save.', 'eux-pad'),
                    });
                    setSaving(false);
                    return;
                }
            }

            setToast({ status: 'success', message: __('Pickup settings saved.', 'eux-pad') });
        } catch (e) {
            setToast({ status: 'error', message: __('Failed to save pickup settings.', 'eux-pad') });
        } finally {
            setSaving(false);
        }
    };

    const reset = async () => {
        setApiDefaults();
        setResetting(true);
        setNotice(null);
        try {
            const res = await apiFetch({
                path: '/wpd/v1/settings/pickup/reset',
                method: 'POST',
            });
            if (res?.success) {
                const data = { ...res.data };
                if (Array.isArray(data.opening_hours) && data.opening_hours.length > MAX_OPENING_ROWS) {
                    data.opening_hours = data.opening_hours.slice(0, MAX_OPENING_ROWS);
                }
                if (typeof data.tab_enabled !== 'boolean') {
                    data.tab_enabled = true;
                }
                if (typeof data.tab_title !== 'string') {
                    data.tab_title = '';
                }
                setSettings(data);
                setToast({ status: 'success', message: __('Reset to default.', 'eux-pad') });
            } else {
                setToast({ status: 'error', message: __('Failed to reset.', 'eux-pad') });
            }
        } catch (e) {
            setToast({ status: 'error', message: __('Failed to reset.', 'eux-pad') });
        } finally {
            setResetting(false);
        }
    };

    return (
        <>
            <AdminPageLayout
                title={__('Pickup & Delivery Settings', 'eux-pad')}
                description={__('Configure texts, colors, rules, schedules, and checkout behavior', 'eux-pad')}
                pageTitle={__('Pickup Settings', 'eux-pad')}
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
                                    ? __('Resetting...', 'eux-pad')
                                    : __('Reset to Default', 'eux-pad')}
                            </button>
                            <button
                                type="button"
                                className="wpd-admin-btn wpd-admin-btn--primary"
                                onClick={save}
                                disabled={saving || resetting}
                            >
                                {saving ? __('Saving...', 'eux-pad') : __('Save Settings', 'eux-pad')}
                            </button>
                        </Flex>
                    )
                }
            >
                {!loading && (
                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">
                                    {__('Pickup & Delivery page —> Pickup tab', 'eux-pad')}
                                </div>
                                <div className="wpd-admin-section__subtitle">
                                    {__(
                                        'Controls the pickup / click & collect tab on the storefront Pickup & Delivery step.',
                                        'eux-pad'
                                    )}
                                </div>
                                <ToggleControl
                                    label={__('Enable Pickup tab', 'eux-pad')}
                                    checked={settings.tab_enabled !== false}
                                    onChange={(val) => setSettings((prev) => ({ ...prev, tab_enabled: !!val }))}
                                />
                                <TextControl
                                    label={__('Pickup tab title', 'eux-pad')}
                                    value={settings.tab_title || ''}
                                    onChange={(v) => setSettings((prev) => ({ ...prev, tab_title: v }))}
                                />
                            </div>
                        </CardBody>
                    </Card>
                )}
                {!loading && multiPickupStoresAddon && (
                    <Card>
                        <CardBody>
                            <PickupStoresPanel stores={pickupStores} onChange={setPickupStores} />
                        </CardBody>
                    </Card>
                )}
                {!loading && !multiPickupStoresAddon && (
                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">{__('Pickup Location', 'eux-pad')}</div>
                                <div className="wpd-admin-section__subtitle">
                                    {__('Configure your pickup address and contact', 'eux-pad')}
                                </div>

                                <TextareaControl
                                    label={__('Address', 'eux-pad')}
                                    help={__('Shown on the pickup page.', 'eux-pad')}
                                    value={settings.address || ''}
                                    onChange={(v) => update('address', v)}
                                />

                                <TextControl
                                    label={__('Phone', 'eux-pad')}
                                    value={settings.phone || ''}
                                    onChange={(v) => update('phone', v)}
                                />

                                <TextControl
                                    type="number"
                                    label={__('Interval (minutes)', 'eux-pad')}
                                    help={__('Gap between each pickup time slot.', 'eux-pad')}
                                    min={5}
                                    max={360}
                                    value={settings.interval}
                                    onChange={(v) => update('interval', parseInt(v, 10) || 60)}
                                />

                                <div className="wpd-opening-label">{__('Opening Hours', 'eux-pad')}</div>
                                <p className="wpd-admin-section__subtitle wpd-opening-hours-help">
                                    {__(
                                        'Add up to 7 rows (e.g. one per day). Each row needs a day, open time, and close time.',
                                        'woo-pickup-delivery'
                                    )}
                                </p>

                                {Array.isArray(settings.opening_hours) &&
                                    settings.opening_hours.map((row, index) => {
                                        const used = new Set(
                                            settings.opening_hours
                                                .map((r, i) => (i === index ? null : (r.day || '').toLowerCase()))
                                                .filter(Boolean)
                                        );
                                        const options = [
                                            { label: __('Select day', 'eux-pad'), value: '' },
                                            ...ALL_DAYS.filter(
                                                (day) => day === row.day || !used.has(day.toLowerCase())
                                            ).map((day) => ({ label: day, value: day })),
                                        ];

                                        return (
                                            <div key={index} className="wpd-opening-row">
                                                <RulesCustomSelect
                                                    className="wpd-opening-day"
                                                    value={row.day || ''}
                                                    options={options}
                                                    onChange={(v) => updateOpeningRow(index, { day: v })}
                                                    placeholder={__('Select day', 'eux-pad')}
                                                    ariaLabel={__('Day', 'eux-pad')}
                                                />
                                                <input
                                                    type="time"
                                                    className="components-text-control__input wpd-opening-time"
                                                    value={row.start || ''}
                                                    onChange={(e) =>
                                                        updateOpeningRow(index, { start: e.target.value })
                                                    }
                                                />
                                                <input
                                                    type="time"
                                                    className="components-text-control__input wpd-opening-time"
                                                    value={row.end || ''}
                                                    onChange={(e) => updateOpeningRow(index, { end: e.target.value })}
                                                />
                                                <Button
                                                    className="wpd-opening-remove"
                                                    isDestructive
                                                    variant="link"
                                                    onClick={() => removeOpeningRow(index)}
                                                    aria-label={__('Remove row', 'eux-pad')}
                                                >
                                                    <svg
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 24 24"
                                                        aria-hidden="true"
                                                        focusable="false"
                                                    >
                                                        <path
                                                            fill="#DC2626"
                                                            d="M9 3a1 1 0 0 0-.894.553L7.382 5H5a1 1 0 1 0 0 2h.25l.772 11.088A2 2 0 0 0 8.016 20h7.968a2 2 0 0 0 1.994-1.912L18.75 7H19a1 1 0 1 0 0-2h-2.382l-.724-1.447A1 1 0 0 0 14 3H9zm1.382 2L11 4h3l.618 1H10.382zM10 9a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1z"
                                                        />
                                                    </svg>
                                                </Button>
                                            </div>
                                        );
                                    })}

                                <Button
                                    variant="secondary"
                                    onClick={addOpeningRow}
                                    disabled={
                                        !Array.isArray(settings.opening_hours) ||
                                        settings.opening_hours.length >= MAX_OPENING_ROWS
                                    }
                                >
                                    {__('+ Add row', 'eux-pad')}
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                )}
            </AdminPageLayout>
            {toast && (
                <div className={`wpd-admin-toast wpd-admin-toast--${toast.status}`}>{toast.message}</div>
            )}
        </>
    );
}
