import { __ } from '@wordpress/i18n';
import { useEffect, useState, useRef, useCallback } from '@wordpress/element';
import { Card, CardBody, Flex, TextControl, ToggleControl } from '@wordpress/components';
import AdminPageLayout from './AdminPageLayout';
import { setApiDefaults } from '../utils/api';

const apiFetch = window.wp?.apiFetch;

const DEFAULTS = {
    suburbs: [],
    tab_enabled: true,
    tab_title: '',
};

function hasSuburbCaseInsensitive(list, candidate) {
    const t = candidate.trim().toLowerCase();
    if (!t) return true;
    return list.some((s) => String(s).trim().toLowerCase() === t);
}

/**
 * WooCommerce-style chips: type a name, press comma or Enter to add; × removes.
 */
function DeliverySuburbChipsField({ suburbs, onChange }) {
    const [draft, setDraft] = useState('');
    const draftRef = useRef('');
    const inputRef = useRef(null);

    const commitDraft = useCallback(() => {
        const t = draftRef.current.trim().replace(/,$/, '').trim();
        if (!t) {
            draftRef.current = '';
            setDraft('');
            return;
        }
        if (!hasSuburbCaseInsensitive(suburbs, t)) {
            onChange([...suburbs, t]);
        }
        draftRef.current = '';
        setDraft('');
    }, [suburbs, onChange]);

    const removeAt = (index) => {
        onChange(suburbs.filter((_, i) => i !== index));
    };

    const onKeyDown = (e) => {
        if (e.key === ',' || e.key === 'Enter') {
            e.preventDefault();
            commitDraft();
            return;
        }
        if (e.key === 'Backspace' && draftRef.current === '' && suburbs.length > 0) {
            e.preventDefault();
            onChange(suburbs.slice(0, -1));
        }
    };

    const onPaste = (e) => {
        const text = e.clipboardData?.getData('text') || '';
        if (!text.includes(',')) {
            return;
        }
        e.preventDefault();
        const parts = text
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        let next = [...suburbs];
        for (const p of parts) {
            if (!hasSuburbCaseInsensitive(next, p)) {
                next.push(p);
            }
        }
        onChange(next);
        draftRef.current = '';
        setDraft('');
    };

    return (
        <div className="wpd-delivery-suburbs-field">
            <div className="wpd-delivery-suburbs-field__label">{__('Delivery suburbs', 'eux-pickup-delivery')}</div>
            <p className="wpd-admin-section__subtitle wpd-delivery-suburbs-field__help">
                {__(
                    'Type a suburb name and press comma or Enter to add it. You can also paste a comma-separated list. These names appear in Rules → Suburb conditions.',
                    'eux-pickup-delivery'
                )}
            </p>
            <div
                className="wpd-delivery-suburbs-field__inner"
                role="group"
                aria-label={__('Suburb names', 'eux-pickup-delivery')}
                onClick={() => inputRef.current?.focus()}
            >
                <input
                    ref={inputRef}
                    type="text"
                    className="wpd-delivery-suburbs-field__input"
                    value={draft}
                    onChange={(e) => {
                        draftRef.current = e.target.value;
                        setDraft(e.target.value);
                    }}
                    onKeyDown={onKeyDown}
                    onPaste={onPaste}
                    onBlur={() => {
                        if (draftRef.current.trim()) {
                            commitDraft();
                        }
                    }}
                    placeholder={suburbs.length ? __('Add another…', 'eux-pickup-delivery') : __('e.g. Richmond', 'eux-pickup-delivery')}
                    autoComplete="off"
                />
                {suburbs.map((name, i) => (
                    <span key={`${name}-${i}`} className="wpd-delivery-suburb-chip">
                        <span className="wpd-delivery-suburb-chip__label">{name}</span>
                        <button
                            type="button"
                            className="wpd-delivery-suburb-chip__remove"
                            onClick={(ev) => {
                                ev.stopPropagation();
                                removeAt(i);
                            }}
                            aria-label={__('Remove suburb', 'eux-pickup-delivery')}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function DeliverySettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [toast, setToast] = useState(null);
    const [settings, setSettings] = useState(DEFAULTS);

    const load = async () => {
        setApiDefaults();
        setLoading(true);
        try {
            const res = await apiFetch({ path: '/wpd/v1/settings/delivery' });
            if (res?.success && res?.data) {
                const data = { ...res.data };
                if (!Array.isArray(data.suburbs)) {
                    data.suburbs = [];
                }
                if (typeof data.tab_enabled !== 'boolean') {
                    data.tab_enabled = true;
                }
                if (typeof data.tab_title !== 'string') {
                    data.tab_title = '';
                }
                setSettings(data);
            }
        } catch (e) {
            setToast({ status: 'error', message: __('Failed to load delivery settings.', 'eux-pickup-delivery') });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(timer);
    }, [toast]);

    const updateSuburbs = (suburbs) => {
        setSettings((prev) => ({ ...prev, suburbs }));
    };

    const save = async () => {
        setApiDefaults();
        setSaving(true);
        try {
            const res = await apiFetch({
                path: '/wpd/v1/settings/delivery',
                method: 'POST',
                data: settings,
            });
            if (res?.success) {
                const data = { ...res.data };
                if (!Array.isArray(data.suburbs)) {
                    data.suburbs = [];
                }
                if (typeof data.tab_enabled !== 'boolean') {
                    data.tab_enabled = true;
                }
                if (typeof data.tab_title !== 'string') {
                    data.tab_title = '';
                }
                setSettings(data);
                setToast({ status: 'success', message: __('Delivery settings saved.', 'eux-pickup-delivery') });
            } else {
                setToast({ status: 'error', message: __('Failed to save delivery settings.', 'eux-pickup-delivery') });
            }
        } catch (e) {
            setToast({ status: 'error', message: __('Failed to save delivery settings.', 'eux-pickup-delivery') });
        } finally {
            setSaving(false);
        }
    };

    const reset = async () => {
        setApiDefaults();
        setResetting(true);
        try {
            const res = await apiFetch({
                path: '/wpd/v1/settings/delivery/reset',
                method: 'POST',
            });
            if (res?.success) {
                const data = res.data && typeof res.data === 'object' ? { ...res.data } : { ...DEFAULTS };
                if (!Array.isArray(data.suburbs)) {
                    data.suburbs = [];
                }
                if (typeof data.tab_enabled !== 'boolean') {
                    data.tab_enabled = true;
                }
                if (typeof data.tab_title !== 'string') {
                    data.tab_title = '';
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
                pageTitle={__('Delivery Settings', 'eux-pickup-delivery')}
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
                                {resetting ? __('Resetting...', 'eux-pickup-delivery') : __('Reset to Default', 'eux-pickup-delivery')}
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
                                <div className="wpd-admin-section__title">{__('Pickup & Delivery page —> Delivery tab', 'eux-pickup-delivery')}</div>
                                <div className="wpd-admin-section__subtitle">
                                    {__(
                                        'Controls the delivery tab on the storefront Pickup & Delivery step.',
                                        'eux-pickup-delivery'
                                    )}
                                </div>
                                <ToggleControl
                                    label={__('Enable Delivery tab', 'eux-pickup-delivery')}
                                    checked={settings.tab_enabled !== false}
                                    onChange={(val) => setSettings((prev) => ({ ...prev, tab_enabled: !!val }))}
                                />
                                <TextControl
                                    label={__('Delivery tab title', 'eux-pickup-delivery')}
                                    value={settings.tab_title || ''}
                                    onChange={(v) => setSettings((prev) => ({ ...prev, tab_title: v }))}
                                />
                            </div>
                        </CardBody>
                    </Card>
                )}
                {!loading && (
                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section">
                                <div className="wpd-admin-section__title">{__('Allowed delivery suburbs', 'eux-pickup-delivery')}</div>
                                <div className="wpd-admin-section__subtitle">
                                    {__(
                                        'Used when customers choose delivery and when you build Suburb rules.',
                                        'eux-pickup-delivery'
                                    )}
                                </div>
                                <DeliverySuburbChipsField suburbs={settings.suburbs || []} onChange={updateSuburbs} />
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
