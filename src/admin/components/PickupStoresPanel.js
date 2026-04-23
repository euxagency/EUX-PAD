/**
 * Multiple pickup stores — same fields as Pickup Location, rules-style list (reorder, collapse, enable, delete).
 * Shown on Pickup Settings when the Multi-Store add-on is active.
 */

import { __, sprintf } from '@wordpress/i18n';
import { useCallback, useRef, useState, useId } from '@wordpress/element';
import { Button, TextControl, TextareaControl, ToggleControl } from '@wordpress/components';
import RulesCustomSelect from './RulesCustomSelect';

const RULES_LIST_GAP_PX = 12;

const ALL_DAYS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
];

const MAX_OPENING_ROWS = 7;

function computeInsertBefore(clientY, listEl) {
    if (!listEl) {
        return 0;
    }
    const children = [...listEl.querySelectorAll(':scope > .wpd-rules-sort-item')];
    const n = children.length;
    for (let j = 0; j < n; j++) {
        const r = children[j].getBoundingClientRect();
        const mid = r.top + r.height / 2;
        if (clientY < mid) {
            return j;
        }
    }
    return n;
}

function computeToIndex(from, insertBefore, n) {
    if (n <= 0) {
        return 0;
    }
    if (insertBefore <= from) {
        return Math.max(0, Math.min(n - 1, insertBefore));
    }
    return Math.max(0, Math.min(n - 1, insertBefore - 1));
}

function getReorderShiftY(i, from, to, stride) {
    if (from === null || stride <= 0) {
        return 0;
    }
    if (i === from) {
        return 0;
    }
    if (from < to) {
        if (i > from && i <= to) {
            return -stride;
        }
    } else if (from > to) {
        if (i >= to && i < from) {
            return stride;
        }
    }
    return 0;
}

function newStoreId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `s-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function createEmptyPickupStore() {
    return {
        id: newStoreId(),
        enabled: true,
        name: '',
        address: '',
        phone: '',
        interval: 60,
        opening_hours: [
            { day: 'Monday', start: '07:00', end: '17:00' },
            { day: 'Tuesday', start: '07:00', end: '17:00' },
        ],
    };
}

/**
 * One store: name + same fields as Pickup Location (address, phone, interval, opening hours).
 */
function PickupStoreCard({ store, expanded, onToggleExpand, onUpdate, onRemove, sortHandleProps }) {
    const bodyId = useId();

    const update = (patch) => onUpdate({ ...store, ...patch });

    const updateOpeningRow = (rowIndex, patch) => {
        const rows = Array.isArray(store.opening_hours) ? [...store.opening_hours] : [];
        rows[rowIndex] = { ...rows[rowIndex], ...patch };
        update({ opening_hours: rows });
    };

    const addOpeningRow = () => {
        const rows = Array.isArray(store.opening_hours) ? [...store.opening_hours] : [];
        if (rows.length >= MAX_OPENING_ROWS) return;
        rows.push({ day: '', start: '', end: '' });
        update({ opening_hours: rows });
    };

    const removeOpeningRow = (rowIndex) => {
        const rows = Array.isArray(store.opening_hours) ? [...store.opening_hours] : [];
        rows.splice(rowIndex, 1);
        update({ opening_hours: rows });
    };

    const onHeaderKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand(store.id);
        }
    };

    return (
        <div className="wpd-rules-rule-card">
            <div className="wpd-rules-rule-header">
                <div
                    className="wpd-rules-drag-handle"
                    title={__('Drag to reorder', 'eux-pad')}
                    {...(sortHandleProps || {})}
                    onClick={(e) => {
                        e.stopPropagation();
                        sortHandleProps?.onClick?.(e);
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="9" cy="6" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" />
                        <circle cx="9" cy="18" r="1.5" />
                        <circle cx="15" cy="6" r="1.5" />
                        <circle cx="15" cy="12" r="1.5" />
                        <circle cx="15" cy="18" r="1.5" />
                    </svg>
                </div>
                <div
                    className={`wpd-rules-rule-header-main${expanded ? '' : ' wpd-rules-rule-header-main--collapsed'}`}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    aria-controls={expanded ? bodyId : undefined}
                    title={__('Click to expand or collapse', 'eux-pad')}
                    onClick={() => onToggleExpand(store.id)}
                    onKeyDown={onHeaderKeyDown}
                >
                    <span className="wpd-rules-rule-header-main__chevron" aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path
                                d="M3 4.5L6 8l3-3.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </span>
                    <span className="wpd-rules-rule-header-main__text">
                        {store.name?.trim() || __('Untitled store', 'eux-pad')}
                    </span>
                </div>
                <button
                    type="button"
                    className="wpd-rules-rule-delete"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    aria-label={__('Delete store', 'eux-pad')}
                    title={__('Delete store', 'eux-pad')}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                            fill="#DC2626"
                            d="M9 3a1 1 0 0 0-.894.553L7.382 5H5a1 1 0 1 0 0 2h.25l.772 11.088A2 2 0 0 0 8.016 20h7.968a2 2 0 0 0 1.994-1.912L18.75 7H19a1 1 0 1 0 0-2h-2.382l-.724-1.447A1 1 0 0 0 14 3H9zm1.382 2L11 4h3l.618 1H10.382zM10 9a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1z"
                        />
                    </svg>
                </button>
                <span
                    className="wpd-rules-toggle-wrap"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <ToggleControl
                        label={__('Enabled', 'eux-pad')}
                        checked={store.enabled !== false}
                        onChange={(v) => update({ enabled: !!v })}
                    />
                </span>
            </div>
            {expanded ? (
                <div className="wpd-rules-rule-body" id={bodyId}>
                    <TextControl
                        label={__('Store name', 'eux-pad')}
                        value={store.name || ''}
                        onChange={(v) => update({ name: v })}
                    />
                    <TextareaControl
                        label={__('Address', 'eux-pad')}
                        help={__('Shown on the pickup page.', 'eux-pad')}
                        value={store.address || ''}
                        onChange={(v) => update({ address: v })}
                    />
                    <TextControl
                        label={__('Phone', 'eux-pad')}
                        value={store.phone || ''}
                        onChange={(v) => update({ phone: v })}
                    />
                    <TextControl
                        type="number"
                        label={__('Interval (minutes)', 'eux-pad')}
                        help={__('Gap between each pickup time slot for this store.', 'eux-pad')}
                        min={5}
                        max={360}
                        value={store.interval}
                        onChange={(v) => update({ interval: parseInt(v, 10) || 60 })}
                    />
                    <div className="wpd-opening-label" style={{ marginTop: 12 }}>
                        {__('Opening Hours', 'eux-pad')}
                    </div>
                    <p className="wpd-admin-section__subtitle wpd-opening-hours-help">
                        {__(
                            'Add up to 7 rows (e.g. one per day). Each row needs a day, open time, and close time.',
                            'woo-pickup-delivery'
                        )}
                    </p>
                    {Array.isArray(store.opening_hours) &&
                        store.opening_hours.map((row, index) => {
                            const used = new Set(
                                store.opening_hours
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
                                        onChange={(e) => updateOpeningRow(index, { start: e.target.value })}
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
                            !Array.isArray(store.opening_hours) || store.opening_hours.length >= MAX_OPENING_ROWS
                        }
                    >
                        {__('+ Add row', 'eux-pad')}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

export default function PickupStoresPanel({ stores, onChange }) {
    const [expandedStoreId, setExpandedStoreId] = useState(null);
    const sortListRef = useRef(null);
    const sortDraggingRef = useRef(false);
    const [sortActiveIndex, setSortActiveIndex] = useState(null);
    const [sortOverTo, setSortOverTo] = useState(0);
    const [sortPointerDy, setSortPointerDy] = useState(0);
    const [sortStride, setSortStride] = useState(0);

    const moveStore = useCallback(
        (fromIndex, toIndex) => {
            onChange((prev) => {
                if (toIndex < 0 || toIndex >= prev.length || fromIndex === toIndex) {
                    return prev;
                }
                const next = [...prev];
                const [item] = next.splice(fromIndex, 1);
                next.splice(toIndex, 0, item);
                return next.map((s, i) => ({ ...s, order: i }));
            });
        },
        [onChange]
    );

    const handleSortPointerDown = useCallback(
        (e, index) => {
            if (e.button !== 0 || sortDraggingRef.current) {
                return;
            }
            const list = sortListRef.current;
            if (!list) {
                return;
            }
            const items = [...list.querySelectorAll(':scope > .wpd-rules-sort-item')];
            const row = items[index];
            if (!row) {
                return;
            }
            e.preventDefault();
            const stride = row.offsetHeight + RULES_LIST_GAP_PX;
            const startY = e.clientY;
            const handleEl = e.currentTarget;
            try {
                handleEl.setPointerCapture(e.pointerId);
            } catch (err) {
                return;
            }
            sortDraggingRef.current = true;
            setSortActiveIndex(index);
            setSortOverTo(index);
            setSortPointerDy(0);
            setSortStride(stride);

            const onMove = (ev) => {
                if (ev.pointerId !== e.pointerId) {
                    return;
                }
                setSortPointerDy(ev.clientY - startY);
                const n = sortListRef.current?.querySelectorAll(':scope > .wpd-rules-sort-item').length ?? 0;
                const ins = computeInsertBefore(ev.clientY, sortListRef.current);
                const to = computeToIndex(index, ins, n);
                setSortOverTo((prev) => (prev === to ? prev : to));
            };

            const finish = (ev) => {
                if (ev.pointerId !== e.pointerId) {
                    return;
                }
                try {
                    handleEl.releasePointerCapture(ev.pointerId);
                } catch (err) {
                    /* ignore */
                }
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', finish);
                window.removeEventListener('pointercancel', finish);
                sortDraggingRef.current = false;
                const n = sortListRef.current?.querySelectorAll(':scope > .wpd-rules-sort-item').length ?? 0;
                const ins = computeInsertBefore(ev.clientY, sortListRef.current);
                const to = computeToIndex(index, ins, n);
                setSortActiveIndex(null);
                setSortPointerDy(0);
                setSortStride(0);
                if (index !== to) {
                    moveStore(index, to);
                }
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', finish);
            window.addEventListener('pointercancel', finish);
        },
        [moveStore]
    );

    const addStore = () => {
        const s = createEmptyPickupStore();
        onChange((prev) => [...prev, s]);
        setExpandedStoreId(s.id);
    };

    const updateStore = (idx, store) => {
        onChange((prev) => {
            const next = [...prev];
            next[idx] = store;
            return next;
        });
    };

    const requestRemove = (idx, store) => {
        const name = (store?.name || '').trim() || __('Untitled store', 'eux-pad');
        const message = sprintf(
            /* translators: %s: store name */
            __('Are you sure you want to delete "%s"?', 'eux-pad'),
            name
        );
        if (!window.confirm(message)) {
            return;
        }
        onChange((prev) => prev.filter((_, i) => i !== idx));
        setExpandedStoreId((id) => (id === store.id ? null : id));
    };

    const toggleAccordion = (id) => {
        setExpandedStoreId((prev) => (prev === id ? null : id));
    };

    return (
        <div className="wpd-admin-section wpd-rules-section">
            <div className="wpd-rules-section-header">
                <div>
                    <div className="wpd-admin-section__title">{__('Pickup stores', 'eux-pad')}</div>
                    <div className="wpd-admin-section__subtitle">
                        {__(
                            'Each store uses the same fields as a single pickup location. Shoppers choose a store on the Pickup & Delivery page.',
                            'eux-pad'
                        )}
                    </div>
                </div>
                <div className="wpd-rules-section-header-actions">
                    <button type="button" className="wpd-admin-btn wpd-admin-btn--primary wpd-rules-add-btn" onClick={addStore}>
                        {__('Add store', 'eux-pad')}
                    </button>
                </div>
            </div>
            <div
                ref={sortListRef}
                className={`wpd-rules-list${sortActiveIndex !== null ? ' wpd-rules-list--sorting' : ''}`}
            >
                {stores.length === 0 ? (
                    <p className="wpd-rules-empty">
                        {__('No stores yet. Click "Add store" to create one, or save settings after activating the Multi-Store add-on.', 'eux-pad')}
                    </p>
                ) : (
                    stores.map((store, index) => {
                        const shiftY =
                            sortActiveIndex !== null
                                ? getReorderShiftY(index, sortActiveIndex, sortOverTo, sortStride)
                                : 0;
                        const isLifted = sortActiveIndex === index;
                        const itemTransition =
                            sortActiveIndex !== null
                                ? isLifted
                                    ? 'transform 0.15s ease-out'
                                    : 'transform 200ms cubic-bezier(0.25, 0.8, 0.25, 1)'
                                : 'transform 200ms cubic-bezier(0.25, 0.8, 0.25, 1)';
                        return (
                            <div
                                key={store.id}
                                className="wpd-rules-sort-item"
                                style={{
                                    transform:
                                        sortActiveIndex !== null ? `translateY(${shiftY}px)` : undefined,
                                    transition: itemTransition,
                                }}
                            >
                                <div
                                    className={isLifted ? 'wpd-rules-sortable-lift' : 'wpd-rules-sortable-lift-wrap'}
                                    style={
                                        isLifted
                                            ? {
                                                  transform: `translateY(${sortPointerDy}px)`,
                                                  transition: 'none',
                                              }
                                            : undefined
                                    }
                                >
                                    <PickupStoreCard
                                        store={store}
                                        expanded={expandedStoreId === store.id}
                                        onToggleExpand={toggleAccordion}
                                        onUpdate={(s) => updateStore(index, s)}
                                        onRemove={() => requestRemove(index, store)}
                                        sortHandleProps={{
                                            onPointerDown: (ev) => handleSortPointerDown(ev, index),
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
