import { __ } from '@wordpress/i18n';
import { useEffect, useState, useCallback } from '@wordpress/element';
import { Button, Card, CardBody, Flex, TextControl, ToggleControl } from '@wordpress/components';
import AdminPageLayout from './AdminPageLayout';
import RulesCustomSelect from './RulesCustomSelect';
import PickupStoresPanel from './PickupStoresPanel';
import PickupAddressFields from './PickupAddressFields';
import { setApiDefaults } from '../utils/api';

const apiFetch = window.wp?.apiFetch;

const DEFAULTS = {
    street_number: '155',
    street_name: 'George St',
    city: 'SYDNEY',
    state: 'NSW',
    postcode: '2000',
    country: 'AU',
    address: '155 George St\nSYDNEY NSW 2000',
    phone: '(02) 5550 4321',
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
    const multiPickupStoresAddon =
        typeof window !== 'undefined' && !!window.wpdAdmin?.multiPickupStoresAddon;

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
    }, [multiPickupStoresAddon]);

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
                if (typeof data.country !== 'string' || data.country.length !== 2) {
                    data.country = 'AU';
                }
                setSettings(data);
            }
            if (multiPickupStoresAddon) {
                setPickupStores(Array.isArray(storesList) ? storesList : []);
            }
        } catch (e) {
            setNotice({ status: 'error', message: __('Failed to load pickup settings.', 'eux-pickup-delivery') });
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

    const buildPickupSavePayload = () => {
        if (!multiPickupStoresAddon) {
            return { ...settings };
        }
        const p = { ...settings };
        if (!String(p.address ?? '').trim()) {
            delete p.address;
        }
        if (!String(p.phone ?? '').trim()) {
            delete p.phone;
        }
        if (Array.isArray(p.opening_hours) && p.opening_hours.length === 0) {
            delete p.opening_hours;
        }
        return p;
    };

    const save = async () => {
        setApiDefaults();
        setSaving(true);
        setNotice(null);
        try {
            const res = await apiFetch({
                path: '/wpd/v1/settings/pickup',
                method: 'POST',
                data: buildPickupSavePayload(),
            });
            if (!res?.success) {
                setToast({ status: 'error', message: __('Failed to save pickup settings.', 'eux-pickup-delivery') });
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
            if (typeof data.country !== 'string' || data.country.length !== 2) {
                data.country = 'AU';
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
                        message: __('Pickup tab saved, but pickup stores failed to save.', 'eux-pickup-delivery'),
                    });
                    setSaving(false);
                    return;
                }
            }

            setToast({ status: 'success', message: __('Pickup settings saved.', 'eux-pickup-delivery') });
        } catch (e) {
            setToast({ status: 'error', message: __('Failed to save pickup settings.', 'eux-pickup-delivery') });
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
                if (typeof data.country !== 'string' || data.country.length !== 2) {
                    data.country = 'AU';
                }
                setSettings(data);
                setToast({ status: 'success', message: __('Reset to default.', 'eux-pickup-delivery') });
            } else {
                setToast({ status: 'error', message: __('Failed to reset.', 'eux-pickup-delivery') });
            }
        } catch (e) {
            setToast({ status: 'error', message: __('Failed to reset.', 'eux-pickup-delivery') });
        } finally {
            setResetting(false);
        }
    };

    return (
        <>
            <AdminPageLayout
                title={__('Pickup & Delivery Settings', 'eux-pickup-delivery')}
                description={__('Configure texts, colors, rules, schedules, and checkout behavior', 'eux-pickup-delivery')}
                pageTitle={__('Pickup Settings', 'eux-pickup-delivery')}
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
                                    ? __('Resetting...', 'eux-pickup-delivery')
                                    : __('Reset to Default', 'eux-pickup-delivery')}
                            </button>
                            <button
                                type="button"
                                className="wpd-admin-btn wpd-admin-btn--primary"
                                onClick={save}
                                disabled={saving || resetting}
                            >
                                {saving ? __('Saving...', 'eux-pickup-delivery') : __('Save Settings', 'eux-pickup-delivery')}
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
                                    {__('Pickup & Delivery page —> Pickup tab', 'eux-pickup-delivery')}
                                </div>
                                <div className="wpd-admin-section__subtitle">
                                    {__(
                                        'Controls the pickup / click & collect tab on the storefront Pickup & Delivery step.',
                                        'eux-pickup-delivery'
                                    )}
                                </div>
                                <ToggleControl
                                    label={__('Enable Pickup tab', 'eux-pickup-delivery')}
                                    checked={settings.tab_enabled !== false}
                                    onChange={(val) => setSettings((prev) => ({ ...prev, tab_enabled: !!val }))}
                                />
                                <TextControl
                                    label={__('Pickup tab title', 'eux-pickup-delivery')}
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
                                <div className="wpd-admin-section__title">{__('Pickup Location', 'eux-pickup-delivery')}</div>
                                <div className="wpd-admin-section__subtitle">
                                    {__('Configure your pickup address and contact', 'eux-pickup-delivery')}
                                </div>

                                <PickupAddressFields
                                    values={{
                                        street_number: settings.street_number,
                                        street_name: settings.street_name,
                                        city: settings.city,
                                        state: settings.state,
                                        postcode: settings.postcode,
                                        country: settings.country,
                                    }}
                                    onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
                                />

                                <TextControl
                                    label={__('Phone', 'eux-pickup-delivery')}
                                    value={settings.phone || ''}
                                    onChange={(v) => update('phone', v)}
                                />
                                <TextControl
                                    type="number"
                                    label={__('Interval (minutes)', 'eux-pickup-delivery')}
                                    help={__('Gap between each pickup time slot.', 'eux-pickup-delivery')}
                                    min={5}
                                    max={360}
                                    value={settings.interval}
                                    onChange={(v) => update('interval', parseInt(v, 10) || 60)}
                                />

                                <div className="wpd-opening-label">{__('Opening Hours', 'eux-pickup-delivery')}</div>
                                <p className="wpd-admin-section__subtitle wpd-opening-hours-help">
                                    {__(
                                        'Add up to 7 rows (e.g. one per day). Each row needs a day, open time, and close time.',
                                        'eux-pickup-delivery'
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
                                            { label: __('Select day', 'eux-pickup-delivery'), value: '' },
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
                                                    placeholder={__('Select day', 'eux-pickup-delivery')}
                                                    ariaLabel={__('Day', 'eux-pickup-delivery')}
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
                                                    aria-label={__('Remove row', 'eux-pickup-delivery')}
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
                                    {__('+ Add row', 'eux-pickup-delivery')}
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
