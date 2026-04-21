/**
 * Rules admin page – Delivery/Pickup rules with conditions.
 * Layout matches Global/Pickup settings. Rules enable/disable dates on the frontend.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
    useEffect,
    useState,
    useCallback,
    useMemo,
    useRef,
    useId,
    useLayoutEffect,
    createPortal,
} from '@wordpress/element';
import {
    Card,
    CardBody,
    Flex,
    TextControl,
    ToggleControl,
    Button,
    Modal,
} from '@wordpress/components';
import AdminPageLayout from './AdminPageLayout';
import RulesCustomSelect from './RulesCustomSelect';
import { setApiDefaults } from '../utils/api';

const apiFetch = window.wp?.apiFetch;

/** Matches flex gap on `.wpd-rules-list` — used to size reorder shifts. */
const RULES_LIST_GAP_PX = 12;

/**
 * Insert-before index (0..n) from pointer Y vs each sort item’s midpoint (uses live rects).
 *
 * @param {number} clientY
 * @param {HTMLElement|null} listEl
 * @return {number}
 */
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

/**
 * Target index for arrayMove-style reorder (from → to).
 *
 * @param {number} from
 * @param {number} insertBefore 0..n
 * @param {number} n
 * @return {number}
 */
function computeToIndex(from, insertBefore, n) {
    if (n <= 0) {
        return 0;
    }
    if (insertBefore <= from) {
        return Math.max(0, Math.min(n - 1, insertBefore));
    }
    return Math.max(0, Math.min(n - 1, insertBefore - 1));
}

/**
 * Vertical offset for item i while previewing move from → to (Angular CDK–style sibling shift).
 *
 * @param {number} i
 * @param {number|null} from
 * @param {number} to
 * @param {number} stride  dragged row height + gap
 * @return {number}
 */
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

/** Date scope: at least one of these is required together with Delivery or Pickup. */
const DATE_SCOPE_CONDITION_TYPES = ['days_of_week', 'specific_dates'];

/** Static copy for the “condition guide” modal (aligned with `WPD_Rules` behavior). */
function getConditionGuideEntries(rulesPro = false) {
    const all = [
        {
            id: 'days_of_week',
            term: __('Days of Week', 'eux-pad'),
            desc: __(
                'The rule only applies on the weekdays you select. Use this to target recurring patterns (for example, every Monday).',
                'eux-pad'
            ),
        },
        {
            id: 'specific_dates',
            term: __('Specific Dates', 'eux-pad'),
            desc: __(
                'The rule only applies on calendar dates you choose. “Matches any of” uses a list of dates; “Between” uses a from–to range.',
                'eux-pad'
            ),
        },
        {
            id: 'method',
            term: __('Delivery or Pickup', 'eux-pad'),
            desc: __(
                'Restricts the rule to the method the shopper selected on the Pickup & Delivery page (delivery or pickup).',
                'eux-pad'
            ),
        },
        {
            id: 'order_value',
            term: __('Order Value', 'eux-pad'),
            desc: __(
                'Compares the sum of existing WooCommerce orders already booked for that calendar date and method (not the live cart). Use the operator and amount to decide when the rule applies.',
                'eux-pad'
            ),
        },
        {
            id: 'total_orders',
            term: __('Total Orders', 'eux-pad'),
            desc: __(
                'Compares how many orders are already booked for that date and method against your threshold, using the operator you pick.',
                'eux-pad'
            ),
        },
        {
            id: 'suburb',
            term: __('Suburb', 'eux-pad'),
            desc: __(
                'Delivery only. Compares the customer’s suburb from the delivery address to your list (case-insensitive). “Equal” matches when the suburb is in the list; “Not equal” when it is not.',
                'eux-pad'
            ),
        },
        {
            id: 'lead_time',
            term: __('Preparation Time', 'eux-pad'),
            desc: __(
                'Minimum full days in advance before a day can be offered. When the rule matches, it is used with “Disable day” to hide dates that are too soon. Rules that include this condition must use the Disable day objective.',
                'eux-pad'
            ),
        },
        {
            id: 'cutoff_time',
            term: __('Cutoff Time', 'eux-pad'),
            desc: __(
                'Uses the site timezone. For a candidate date, if the current time is at or after the cutoff on that date, the condition matches—often paired with “Disable day” to stop same-day bookings after a clock time. Must use the Disable day objective.',
                'eux-pad'
            ),
        },
    ];
    if (rulesPro) {
        return all;
    }
    return all.filter((e) => ['days_of_week', 'specific_dates', 'method'].includes(e.id));
}

/** Rule is considered enabled unless explicitly turned off (REST / toggles). */
function isRuleEnabledForValidation(rule) {
    const v = rule?.enabled;
    if (v === false || v === 0 || v === '0' || v === 'false') {
        return false;
    }
    return true;
}

/**
 * Each enabled rule must have (1) Days of Week OR Specific Dates and (2) Delivery or Pickup.
 */
function ruleMeetsMandatoryConditions(rule) {
    const conds = rule?.conditions || [];
    const hasDateScope = conds.some((c) => DATE_SCOPE_CONDITION_TYPES.includes(c?.type));
    const hasMethod = conds.some((c) => c?.type === 'method');
    return hasDateScope && hasMethod;
}

/** Lead / cutoff semantics only support hiding days. */
function ruleRequiresDisableObjective(rule) {
    return (rule?.conditions || []).some((c) => c?.type === 'lead_time' || c?.type === 'cutoff_time');
}

function normalizeRuleLeadCutoffObjective(rule) {
    if (!ruleRequiresDisableObjective(rule) || rule.objective !== 'enable_day') {
        return rule;
    }
    return { ...rule, objective: 'disable_day' };
}

const WEEKDAY_NAMES = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
];

/**
 * Portaled checkbox list – shared by Days of week and Suburb rule conditions.
 *
 * @param {string} [dropdownMaxHeight] CSS max-height for scroll (e.g. suburbs long list).
 * @param {boolean} [searchable] When true, show a filter field above the checkbox list (e.g. suburbs).
 */
function CheckboxPortalMultiSelect({
    selected = [],
    onChange,
    options,
    triggerPlaceholder,
    dropdownMaxHeight,
    searchable = false,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [filterQuery, setFilterQuery] = useState('');
    const [coords, setCoords] = useState(null);
    const wrapRef = useRef(null);
    const triggerRef = useRef(null);
    const portalRef = useRef(null);
    const searchInputRef = useRef(null);
    const optList = Array.isArray(options) ? options : [];

    const filteredOptions = useMemo(() => {
        if (!searchable) {
            return optList;
        }
        const q = filterQuery.trim().toLowerCase();
        if (!q) {
            return optList;
        }
        return optList.filter(({ value: val, label }) => {
            const text = (label != null && String(label).trim() !== '' ? String(label) : String(val)).toLowerCase();
            return text.includes(q);
        });
    }, [searchable, filterQuery, options]);

    const updatePosition = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setCoords({
            top: rect.bottom + 4,
            left: rect.left,
            minWidth: rect.width,
        });
    }, []);

    useLayoutEffect(() => {
        if (!isOpen) {
            setCoords(null);
            return;
        }
        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, updatePosition]);

    useEffect(() => {
        if (!isOpen) {
            setFilterQuery('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !searchable) return;
        const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
    }, [isOpen, searchable]);

    useEffect(() => {
        if (!isOpen) return;
        const handleMouseDown = (e) => {
            if (wrapRef.current?.contains(e.target)) return;
            if (portalRef.current?.contains(e.target)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isOpen]);

    const toggleValue = (val) => {
        const next = selected.includes(val) ? selected.filter((d) => d !== val) : [...selected, val];
        onChange(next);
    };

    const displayText = selected.length > 0 ? selected.join(', ') : triggerPlaceholder;

    const dropdownStyle = {
        position: 'fixed',
        top: coords ? `${coords.top}px` : 0,
        left: coords ? `${coords.left}px` : 0,
        minWidth: coords ? `${coords.minWidth}px` : undefined,
        width: 'max-content',
        maxWidth: 'min(340px, calc(100vw - 24px))',
        zIndex: 100000,
        backgroundColor: '#fff',
        border: '1px solid #eceef2',
    };
    if (dropdownMaxHeight) {
        dropdownStyle.maxHeight = dropdownMaxHeight;
        dropdownStyle.overflowY = 'auto';
    }

    const portalClass =
        'wpd-rules-multiselect-dropdown wpd-rules-multiselect-dropdown--portal' +
        (searchable ? ' wpd-rules-multiselect-dropdown--with-search' : '');

    const dropdown =
        isOpen &&
        coords &&
        createPortal(
            <div ref={portalRef} className={portalClass} role="listbox" style={dropdownStyle}>
                {searchable && (
                    <div className="wpd-rules-multiselect-dropdown__search">
                        <input
                            ref={searchInputRef}
                            type="search"
                            className="components-text-control__input wpd-rules-multiselect-search-input"
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                            placeholder={__('Search suburbs…', 'eux-pad')}
                            aria-label={__('Search suburbs', 'eux-pad')}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setIsOpen(false);
                                }
                            }}
                        />
                    </div>
                )}
                {filteredOptions.length === 0 ? (
                    <div className="wpd-rules-multiselect-dropdown__empty">
                        {searchable && filterQuery.trim()
                            ? __('No matching suburbs.', 'eux-pad')
                            : __('No options.', 'eux-pad')}
                    </div>
                ) : (
                    filteredOptions.map(({ value: val, label }) => (
                        <label
                            key={val}
                            className="wpd-rules-multiselect-option"
                            role="option"
                            aria-selected={selected.includes(val)}
                        >
                            <input
                                type="checkbox"
                                checked={selected.includes(val)}
                                onChange={() => toggleValue(val)}
                            />
                            <span>{label != null && String(label).trim() !== '' ? label : val}</span>
                        </label>
                    ))
                )}
            </div>,
            document.body
        );

    return (
        <>
            <div className="wpd-rules-multiselect" ref={wrapRef}>
                <button
                    ref={triggerRef}
                    type="button"
                    className="wpd-rules-multiselect-trigger"
                    onClick={() => setIsOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                >
                    <span
                        className={
                            selected.length === 0
                                ? 'wpd-rules-multiselect-placeholder wpd-rules-multiselect-trigger__text'
                                : 'wpd-rules-multiselect-trigger__text'
                        }
                    >
                        {displayText}
                    </span>
                    <span className="wpd-rules-multiselect-arrow" aria-hidden="true">
                        ▼
                    </span>
                </button>
            </div>
            {dropdown}
        </>
    );
}

function DaysOfWeekMultiSelect({ selected = [], onChange, options }) {
    return (
        <CheckboxPortalMultiSelect
            selected={selected}
            onChange={onChange}
            options={options}
            triggerPlaceholder={__('Select days...', 'eux-pad')}
        />
    );
}

/** Operator keys allowed per condition type (admin UI + saved rules). */
const OPERATOR_KEYS_BY_CONDITION_TYPE = {
    days_of_week: ['equal'],
    specific_dates: ['matches_any_of', 'between'],
    method: ['equal'],
    order_value: ['equal', 'greater_than', 'lower_than', 'not_equal', 'between'],
    total_orders: ['equal', 'greater_than', 'lower_than', 'not_equal', 'between'],
    suburb: ['equal', 'not_equal'],
    lead_time: ['equal'],
    cutoff_time: ['equal'],
};

function useRuleFormSelectOptions(rulesPro) {
    return useMemo(() => {
        const allOperators = [
            { value: 'greater_than', label: __('Greater than', 'eux-pad') },
            { value: 'lower_than', label: __('Lower than', 'eux-pad') },
            { value: 'equal', label: __('Equal', 'eux-pad') },
            { value: 'not_equal', label: __('Not equal', 'eux-pad') },
            { value: 'contain', label: __('Contain', 'eux-pad') },
            { value: 'matches_any_of', label: __('Matches any of', 'eux-pad') },
            { value: 'between', label: __('Between', 'eux-pad') },
        ];
        const opByValue = Object.fromEntries(allOperators.map((o) => [o.value, o]));
        const operatorsForType = (type) => {
            const keys = OPERATOR_KEYS_BY_CONDITION_TYPE[type];
            if (!keys) {
                return allOperators;
            }
            return keys
                .map((k) => {
                    const op = opByValue[k];
                    if (!op) {
                        return null;
                    }
                    if (
                        (type === 'days_of_week' || type === 'method') &&
                        k === 'equal'
                    ) {
                        return { ...op, label: __('is', 'eux-pad') };
                    }
                    return op;
                })
                .filter(Boolean);
        };
        const freeConditionTypes = [
            { value: 'days_of_week', label: __('Days of Week', 'eux-pad') },
            { value: 'specific_dates', label: __('Specific Dates', 'eux-pad') },
            { value: 'method', label: __('Delivery or Pickup', 'eux-pad') },
        ];
        const proOnlyTypes = [
            { value: 'order_value', label: __('Order Value', 'eux-pad') },
            { value: 'total_orders', label: __('Total Orders', 'eux-pad') },
            { value: 'suburb', label: __('Suburb', 'eux-pad') },
            { value: 'lead_time', label: __('Preparation Time', 'eux-pad') },
            { value: 'cutoff_time', label: __('Cutoff Time', 'eux-pad') },
        ];
        const conditionTypes = rulesPro
            ? [...freeConditionTypes, ...proOnlyTypes]
            : [
                  ...freeConditionTypes,
                  ...proOnlyTypes.map((o) => ({
                      ...o,
                      disabled: true,
                      isPro: true,
                  })),
              ];
        return {
            conditionTypes,
            /** @deprecated use operatorsForType(type) in condition rows */
            operators: allOperators,
            operatorsForType,
            objectiveOptions: [
                { value: 'enable_day', label: __('Enable Day', 'eux-pad') },
                { value: 'disable_day', label: __('Disable Day', 'eux-pad') },
            ],
            methodOptions: [
                { value: 'delivery', label: __('Delivery', 'eux-pad') },
                { value: 'pickup', label: __('Pickup', 'eux-pad') },
            ],
            dayOptions: WEEKDAY_NAMES.map((d) => ({ value: d, label: d })),
        };
    }, [rulesPro]);
}

/**
 * Default value when fixing operator/type for a condition.
 */
function defaultConditionValueFor(type, operator) {
    switch (type) {
        case 'days_of_week':
            return [];
        case 'specific_dates':
            return operator === 'between' ? ['', ''] : [];
        case 'method':
            return 'delivery';
        case 'order_value':
        case 'total_orders':
        case 'lead_time':
            return operator === 'between' ? ['', ''] : '';
        case 'suburb':
            return [];
        case 'cutoff_time':
            return '';
        default:
            return '';
    }
}

function normalizeLoadedCondition(cond, operatorsForType) {
    const type = cond.type || 'days_of_week';
    const allowed = operatorsForType(type).map((o) => o.value);
    let operator = cond.operator;
    let value = cond.value;

    if (!allowed.includes(operator)) {
        // Legacy: days of week used "matches_any_of" with the same semantics as "equal" list.
        if (type === 'days_of_week' && operator === 'matches_any_of') {
            operator = 'equal';
        } else if (type === 'method') {
            operator = 'equal';
        } else {
            operator = allowed[0];
            value = defaultConditionValueFor(type, operator);
        }
    }

    if (type === 'specific_dates') {
        if (operator === 'between') {
            if (!Array.isArray(value) || value.length < 2) {
                value = ['', ''];
            } else {
                value = [String(value[0] || ''), String(value[1] || '')];
            }
        } else if (!Array.isArray(value)) {
            value = value ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : [];
        }
    }

    if (type === 'suburb') {
        const allowedSuburbOps = ['equal', 'not_equal'];
        if (!allowedSuburbOps.includes(operator)) {
            operator = 'equal';
        }
        if (!Array.isArray(value)) {
            value = value ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : [];
        }
    }

    return { ...cond, type, operator, value };
}

function uuid() {
    return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

function createDefaultMethodCondition() {
    return {
        id: uuid(),
        type: 'method',
        operator: 'equal',
        value: 'delivery',
    };
}

/** Date-scope + method rows are required; UI does not offer remove on these indices. */
const MIN_FIXED_CONDITION_ROWS = 2;

function createEmptyRule() {
    return {
        id: uuid(),
        name: '',
        enabled: true,
        objective: 'disable_day',
        conditions: [createEmptyCondition(), createDefaultMethodCondition()],
    };
}

function createEmptyCondition() {
    return {
        id: uuid(),
        type: 'days_of_week',
        operator: 'equal',
        value: [],
    };
}

function formatSpecificDateChip(isoDate) {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return isoDate || '';
    }
    try {
        return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch (e) {
        return isoDate;
    }
}

/**
 * One date picker; each pick adds to the list. Selected dates show as chips with × inside the same field.
 */
function SpecificDatesMultiCalendarField({ value, onChange }) {
    const inputRef = useRef(null);
    const dates = useMemo(() => {
        const raw = Array.isArray(value)
            ? value
            : value
              ? String(value)
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
              : [];
        return [...new Set(raw.filter(Boolean))].sort();
    }, [value]);

    const handlePick = (e) => {
        const v = e.target.value;
        if (!v) {
            return;
        }
        if (!dates.includes(v)) {
            onChange([...dates, v].sort());
        }
        e.target.value = '';
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const removeDate = (d) => onChange(dates.filter((x) => x !== d));

    return (
        <div className="wpd-rules-specific-dates-field">
            <div
                className="wpd-rules-specific-dates-field__inner"
                role="group"
                aria-label={__('Selected dates and date picker', 'eux-pad')}
            >
                {dates.map((d) => (
                    <span key={d} className="wpd-rules-specific-dates-chip">
                        <span className="wpd-rules-specific-dates-chip__label">{formatSpecificDateChip(d)}</span>
                        <button
                            type="button"
                            className="wpd-rules-specific-dates-chip__remove"
                            onClick={() => removeDate(d)}
                            aria-label={__('Remove date', 'eux-pad')}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="date"
                    className="wpd-rules-specific-dates-field__picker"
                    aria-label={__('Add date from calendar', 'eux-pad')}
                    onChange={handlePick}
                />
            </div>
        </div>
    );
}

function ConditionValueField({ condition, onChange, methodOptions, dayOptions, deliverySuburbs }) {
    const { type, operator, value } = condition;
    const updateValue = (v) => onChange({ ...condition, value: v });

    // Days of week – multi-select dropdown
    if (type === 'days_of_week') {
        const selected = Array.isArray(value) ? value : (value ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : []);
        return (
            <DaysOfWeekMultiSelect
                selected={selected}
                onChange={updateValue}
                options={dayOptions}
            />
        );
    }

    // Specific dates – multi date pickers (matches any of) or from–to (between)
    if (type === 'specific_dates') {
        if (operator === 'between') {
            const fromTo = Array.isArray(value) && value.length >= 2 ? value : ['', ''];
            const from = fromTo[0] || '';
            const to = fromTo[1] || '';
            return (
                <div className="wpd-rules-value-dates wpd-rules-value-dates--between">
                    <span className="wpd-rules-value-dates__label">{__('From', 'eux-pad')}</span>
                    <input
                        type="date"
                        className="components-text-control__input wpd-rules-input"
                        value={from}
                        onChange={(e) => updateValue([e.target.value, to])}
                    />
                    <span className="wpd-rules-between-sep" aria-hidden="true">
                        –
                    </span>
                    <span className="wpd-rules-value-dates__label">{__('To', 'eux-pad')}</span>
                    <input
                        type="date"
                        className="components-text-control__input wpd-rules-input"
                        value={to}
                        onChange={(e) => updateValue([from, e.target.value])}
                    />
                </div>
            );
        }
        return (
            <div className="wpd-rules-value-dates wpd-rules-value-dates--multi">
                <SpecificDatesMultiCalendarField value={value} onChange={updateValue} />
            </div>
        );
    }

    // Method – single select (custom dropdown)
    if (type === 'method') {
        return (
            <RulesCustomSelect
                value={value || 'delivery'}
                options={methodOptions}
                onChange={updateValue}
                ariaLabel={__('Delivery or Pickup', 'eux-pad')}
            />
        );
    }

    // Order value, total orders – number (between = min/max); lead time – single number (equal only)
    if (type === 'order_value' || type === 'total_orders') {
        const isBetween = operator === 'between';
        if (isBetween) {
            const [min, max] = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',').map((n) => n.trim()) : ['', '']);
            return (
                <div className="wpd-rules-value-between">
                    <input
                        type="number"
                        className="components-text-control__input wpd-rules-input wpd-rules-input--small"
                        placeholder={__('Min', 'eux-pad')}
                        value={min || ''}
                        onChange={(e) => updateValue([e.target.value, max])}
                        min={0}
                    />
                    <span className="wpd-rules-between-sep">–</span>
                    <input
                        type="number"
                        className="components-text-control__input wpd-rules-input wpd-rules-input--small"
                        placeholder={__('Max', 'eux-pad')}
                        value={max || ''}
                        onChange={(e) => updateValue([min, e.target.value])}
                        min={0}
                    />
                </div>
            );
        }
        return (
            <input
                type="number"
                className="components-text-control__input wpd-rules-input"
                value={value ?? ''}
                onChange={(e) => updateValue(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder={type === 'order_value' ? __('Order total', 'eux-pad') : __('Count', 'eux-pad')}
                min={0}
                step={type === 'order_value' ? 0.01 : 1}
            />
        );
    }

    if (type === 'lead_time') {
        return (
            <input
                type="number"
                className="components-text-control__input wpd-rules-input"
                value={value ?? ''}
                onChange={(e) => updateValue(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder={__('Days ahead', 'eux-pad')}
                min={0}
                step={1}
            />
        );
    }

    // Suburb – same portaled multiselect UI as Days of week (options from Delivery settings)
    if (type === 'suburb') {
        const names = Array.isArray(deliverySuburbs) ? deliverySuburbs : [];
        const selected = Array.isArray(value) ? value : [];
        if (names.length === 0) {
            return (
                <div className="wpd-rules-suburb-empty-wrap">
                    <p className="wpd-rules-suburb-empty">
                        {__(
                            'Add suburb names under Pickup & Delivery → Delivery Settings.',
                            'eux-pad'
                        )}
                    </p>
                </div>
            );
        }
        return (
            <CheckboxPortalMultiSelect
                selected={selected}
                onChange={updateValue}
                options={names.map((n) => ({ value: n, label: n }))}
                triggerPlaceholder={__('Select suburbs...', 'eux-pad')}
                dropdownMaxHeight="min(280px, 50vh)"
                searchable
            />
        );
    }

    // Cutoff time – time input
    if (type === 'cutoff_time') {
        return (
            <input
                type="time"
                className="components-text-control__input wpd-rules-input"
                value={value || ''}
                onChange={(e) => updateValue(e.target.value)}
            />
        );
    }

    return (
        <TextControl
            value={value ?? ''}
            onChange={(v) => updateValue(v)}
            placeholder={__('Value', 'eux-pad')}
            __nextHasNoMarginBottom
        />
    );
}

function RuleCard({
    rule,
    onUpdate,
    onRemove,
    sortHandleProps,
    selectOptions,
    expanded,
    onAccordionToggle,
    deliverySuburbs,
}) {
    const ruleBodyId = useId();
    const updateRule = (patch) => onUpdate({ ...rule, ...patch });
    const updateCondition = (index, cond) => {
        const conds = [...(rule.conditions || [])];
        conds[index] = cond;
        const patch = { conditions: conds };
        if (conds.some((c) => c?.type === 'lead_time' || c?.type === 'cutoff_time')) {
            patch.objective = 'disable_day';
        }
        updateRule(patch);
    };
    const addCondition = () => {
        const conds = [...(rule.conditions || []), createEmptyCondition()];
        const patch = { conditions: conds };
        if (conds.some((c) => c?.type === 'lead_time' || c?.type === 'cutoff_time')) {
            patch.objective = 'disable_day';
        }
        updateRule(patch);
    };
    const removeCondition = (index) => {
        if (index < MIN_FIXED_CONDITION_ROWS) {
            return;
        }
        const conds = rule.conditions.filter((_, i) => i !== index);
        if (conds.length === 0) conds.push(createEmptyCondition());
        updateRule({ conditions: conds });
    };

    const hasMandatoryConditions = ruleMeetsMandatoryConditions(rule);
    const requiresDisableObjective = ruleRequiresDisableObjective(rule);
    const objectiveOptionsForRule = requiresDisableObjective
        ? selectOptions.objectiveOptions.filter((o) => o.value === 'disable_day')
        : selectOptions.objectiveOptions;

    const onHeaderMainKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAccordionToggle(rule.id);
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
                    aria-controls={expanded ? ruleBodyId : undefined}
                    title={__('Click to expand or collapse rule details', 'eux-pad')}
                    onClick={() => onAccordionToggle(rule.id)}
                    onKeyDown={onHeaderMainKeyDown}
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
                        {rule.name || __('Untitled rule', 'eux-pad')}
                    </span>
                </div>
                <button
                    type="button"
                    className="wpd-rules-rule-delete"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    aria-label={__('Delete rule', 'eux-pad')}
                    title={__('Delete rule', 'eux-pad')}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path fill="#DC2626" d="M9 3a1 1 0 0 0-.894.553L7.382 5H5a1 1 0 1 0 0 2h.25l.772 11.088A2 2 0 0 0 8.016 20h7.968a2 2 0 0 0 1.994-1.912L18.75 7H19a1 1 0 1 0 0-2h-2.382l-.724-1.447A1 1 0 0 0 14 3H9zm1.382 2L11 4h3l.618 1H10.382zM10 9a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1z" />
                    </svg>
                </button>
                <span
                    className="wpd-rules-toggle-wrap"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <ToggleControl
                        label=""
                        checked={!!rule.enabled}
                        onChange={(v) => updateRule({ enabled: !!v })}
                        __nextHasNoMarginBottom
                        className="wpd-rules-toggle"
                    />
                </span>
            </div>

            {expanded ? (
            <div id={ruleBodyId} className="wpd-rules-rule-body">
                <div className="wpd-rules-rule-fields">
                    <TextControl
                        label={__('Rule Name', 'eux-pad')}
                        value={rule.name || ''}
                        onChange={(v) => updateRule({ name: v })}
                        placeholder={__('e.g. Weekend Delivery Restriction', 'eux-pad')}
                        __nextHasNoMarginBottom
                    />
                    <RulesCustomSelect
                        label={__('Rule Objective', 'eux-pad')}
                        value={
                            requiresDisableObjective
                                ? 'disable_day'
                                : rule.objective || 'disable_day'
                        }
                        options={objectiveOptionsForRule}
                        onChange={(v) => updateRule({ objective: v })}
                    />
                    {requiresDisableObjective && (
                        <p className="wpd-rules-objective-hint">
                            {__(
                                'Preparation Time and Cutoff Time only support the Disable Day objective.',
                                'eux-pad'
                            )}
                        </p>
                    )}
                </div>

                <div className="wpd-rules-conditions">
                    <div className="wpd-rules-conditions-title">{__('Conditions', 'eux-pad')}</div>
                    {!hasMandatoryConditions && (
                        <p className="wpd-rules-conditions-hint">
                            {__(
                                'This rule must include at least one Days of Week or Specific Dates condition and one Delivery or Pickup condition.',
                                'eux-pad'
                            )}
                        </p>
                    )}
                    {(rule.conditions || []).map((cond, idx) => {
                        const condType = cond.type || 'days_of_week';
                        const operatorOptions = selectOptions.operatorsForType(condType);
                        const defaultOp = operatorOptions[0]?.value || 'equal';
                        return (
                            <div key={cond.id || idx} className="wpd-rules-condition-row">
                            <RulesCustomSelect
                                className="wpd-rules-condition-type"
                                value={condType}
                                options={selectOptions.conditionTypes}
                                onChange={(v) => {
                                    const ops = selectOptions.operatorsForType(v);
                                    const op0 = ops[0]?.value || 'equal';
                                    updateCondition(idx, {
                                        ...cond,
                                        type: v,
                                        operator: op0,
                                        value: defaultConditionValueFor(v, op0),
                                    });
                                }}
                                ariaLabel={__('Condition type', 'eux-pad')}
                            />
                            <RulesCustomSelect
                                className="wpd-rules-condition-operator"
                                value={operatorOptions.some((o) => o.value === cond.operator) ? cond.operator : defaultOp}
                                options={operatorOptions}
                                onChange={(v) => {
                                    let next = { ...cond, operator: v };
                                    if (cond.type === 'specific_dates') {
                                        next.value = v === 'between' ? ['', ''] : [];
                                    } else if (cond.type === 'order_value' || cond.type === 'total_orders') {
                                        if (v === 'between') {
                                            next.value = ['', ''];
                                        } else if (cond.operator === 'between') {
                                            next.value = '';
                                        }
                                    }
                                    updateCondition(idx, next);
                                }}
                                ariaLabel={__('Operator', 'eux-pad')}
                            />
                            <div className="wpd-rules-condition-value">
                                <ConditionValueField
                                    condition={cond}
                                    onChange={(c) => updateCondition(idx, c)}
                                    methodOptions={selectOptions.methodOptions}
                                    dayOptions={selectOptions.dayOptions}
                                    deliverySuburbs={deliverySuburbs}
                                />
                            </div>
                            {idx >= MIN_FIXED_CONDITION_ROWS && (
                                <button
                                    type="button"
                                    className="wpd-rules-condition-remove"
                                    onClick={() => removeCondition(idx)}
                                    aria-label={__('Remove condition', 'eux-pad')}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path fill="#DC2626" d="M9 3a1 1 0 0 0-.894.553L7.382 5H5a1 1 0 1 0 0 2h.25l.772 11.088A2 2 0 0 0 8.016 20h7.968a2 2 0 0 0 1.994-1.912L18.75 7H19a1 1 0 1 0 0-2h-2.382l-.724-1.447A1 1 0 0 0 14 3H9zm1.382 2L11 4h3l.618 1H10.382zM10 9a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1z" />
                                    </svg>
                                </button>
                            )}
                            </div>
                        );
                    })}
                    <Button variant="secondary" isSmall onClick={addCondition} className="wpd-rules-add-condition">
                        {__('+ Add new condition', 'eux-pad')}
                    </Button>
                </div>
            </div>
            ) : null}
        </div>
    );
}

export default function RulesPage() {
    const rulesPro = Boolean(typeof window !== 'undefined' && window.wpdAdmin?.rulesPro);
    const selectOptions = useRuleFormSelectOptions(rulesPro);
    const { operatorsForType } = selectOptions;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [rules, setRules] = useState([]);
    const sortListRef = useRef(null);
    const sortDraggingRef = useRef(false);
    const [sortActiveIndex, setSortActiveIndex] = useState(null);
    const [sortOverTo, setSortOverTo] = useState(0);
    const [sortPointerDy, setSortPointerDy] = useState(0);
    const [sortStride, setSortStride] = useState(0);
    const [expandedRuleId, setExpandedRuleId] = useState(null);
    const [deliverySuburbs, setDeliverySuburbs] = useState([]);
    const [conditionsHelpOpen, setConditionsHelpOpen] = useState(false);

    const rulesIdKey = useMemo(() => rules.map((r) => r.id).join('\0'), [rules]);

    useEffect(() => {
        if (rules.length === 0) {
            setExpandedRuleId(null);
            return;
        }
        setExpandedRuleId((prev) => {
            if (prev != null && rules.some((r) => r.id === prev)) {
                return prev;
            }
            return rules[0].id;
        });
    }, [rulesIdKey, rules]);

    const toggleAccordion = useCallback((ruleId) => {
        setExpandedRuleId((prev) => (prev === ruleId ? null : ruleId));
    }, []);

    const load = useCallback(async () => {
        setApiDefaults();
        setLoading(true);
        try {
            const [rulesRes, deliveryRes] = await Promise.all([
                apiFetch({ path: '/wpd/v1/settings/rules' }),
                apiFetch({ path: '/wpd/v1/settings/delivery' }),
            ]);
            if (deliveryRes?.success && Array.isArray(deliveryRes?.data?.suburbs)) {
                setDeliverySuburbs(deliveryRes.data.suburbs);
            } else {
                setDeliverySuburbs([]);
            }
            if (rulesRes?.success && Array.isArray(rulesRes?.data)) {
                const normalized = rulesRes.data.map((r, i) =>
                    normalizeRuleLeadCutoffObjective({
                        ...r,
                        id: r.id || uuid(),
                        order: i,
                        conditions: (r.conditions || []).map((c, j) =>
                            normalizeLoadedCondition({ ...c, id: c.id || `c-${i}-${j}` }, operatorsForType)
                        ),
                    })
                );
                setRules(normalized);
            } else {
                setRules([]);
            }
        } catch (e) {
            setToast({ status: 'error', message: __('Failed to load rules.', 'eux-pad') });
        } finally {
            setLoading(false);
        }
    }, [operatorsForType]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(timer);
    }, [toast]);

    const addRule = () => {
        const newRule = createEmptyRule();
        setRules((prev) => [...prev, newRule]);
        setExpandedRuleId(newRule.id);
    };

    const updateRule = (index, rule) => {
        setRules((prev) => {
            const next = [...prev];
            next[index] = rule;
            return next;
        });
    };

    const removeRule = (index) => {
        setRules((prev) => prev.filter((_, i) => i !== index));
    };

    const requestRemoveRule = (index, rule) => {
        const name = (rule?.name || '').trim() || __('Untitled rule', 'eux-pad');
        const message = sprintf(
            /* translators: %s: rule name */
            __('Are you sure you want to delete "%s"? This cannot be undone.', 'eux-pad'),
            name
        );
        if (!window.confirm(message)) {
            return;
        }
        removeRule(index);
    };

    const moveRule = useCallback((fromIndex, toIndex) => {
        setRules((prev) => {
            if (toIndex < 0 || toIndex >= prev.length || fromIndex === toIndex) {
                return prev;
            }
            const next = [...prev];
            const [item] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, item);
            return next.map((r, i) => ({ ...r, order: i }));
        });
    }, []);

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
                const n =
                    sortListRef.current?.querySelectorAll(':scope > .wpd-rules-sort-item').length ?? 0;
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
                const n =
                    sortListRef.current?.querySelectorAll(':scope > .wpd-rules-sort-item').length ?? 0;
                const ins = computeInsertBefore(ev.clientY, sortListRef.current);
                const to = computeToIndex(index, ins, n);
                setSortActiveIndex(null);
                setSortPointerDy(0);
                setSortStride(0);
                if (index !== to) {
                    moveRule(index, to);
                }
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', finish);
            window.addEventListener('pointercancel', finish);
        },
        [moveRule]
    );

    const save = async () => {
        const invalidEnabled = rules.filter(
            (r) => isRuleEnabledForValidation(r) && !ruleMeetsMandatoryConditions(r)
        );
        if (invalidEnabled.length > 0) {
            setToast({
                status: 'error',
                message: __(
                    'Every enabled rule must include at least one Days of Week or Specific Dates condition and one Delivery or Pickup condition.',
                    'eux-pad'
                ),
            });
            return;
        }

        if (rulesPro) {
            const badLeadCutoffObjective = rules.filter(
                (r) =>
                    isRuleEnabledForValidation(r) &&
                    ruleRequiresDisableObjective(r) &&
                    r.objective === 'enable_day'
            );
            if (badLeadCutoffObjective.length > 0) {
                setToast({
                    status: 'error',
                    message: __(
                        'Rules that include Preparation Time or Cutoff Time must use the Disable Day objective.',
                        'eux-pad'
                    ),
                });
                return;
            }
        }

        setApiDefaults();
        setSaving(true);
        try {
            const payload = rules.map((r, i) => ({
                id: r.id,
                name: r.name,
                enabled: r.enabled,
                order: i,
                objective:
                    rulesPro && ruleRequiresDisableObjective(r)
                        ? 'disable_day'
                        : r.objective === 'enable_day'
                          ? 'enable_day'
                          : 'disable_day',
                conditions: (r.conditions || []).map((c) => ({
                    id: c.id,
                    type: c.type,
                    operator: c.operator,
                    value: c.value,
                })),
            }));
            const res = await apiFetch({
                path: '/wpd/v1/settings/rules',
                method: 'POST',
                data: { rules: payload },
            });
            if (res?.success) {
                setRules(
                    res.data.map((r, i) =>
                        normalizeRuleLeadCutoffObjective({
                            ...r,
                            id: r.id || uuid(),
                            order: i,
                            conditions: (r.conditions || []).map((c, j) =>
                                normalizeLoadedCondition({ ...c, id: c.id || `c-${i}-${j}` }, operatorsForType)
                            ),
                        })
                    )
                );
                setToast({ status: 'success', message: __('Rules saved.', 'eux-pad') });
            } else {
                setToast({ status: 'error', message: __('Failed to save rules.', 'eux-pad') });
            }
        } catch (e) {
            const fromRest =
                e && typeof e === 'object' && e.data && typeof e.data === 'object' && typeof e.data.message === 'string'
                    ? e.data.message
                    : '';
            const fromErr = e && typeof e === 'object' && typeof e.message === 'string' ? e.message : '';
            let msg = '';
            if (fromRest.trim() !== '') {
                msg = fromRest;
            } else if (
                fromErr.trim() !== '' &&
                !fromErr.includes('status code') &&
                !fromErr.includes('HTTP ')
            ) {
                msg = fromErr;
            }
            setToast({
                status: 'error',
                message: msg || __('Failed to save rules.', 'eux-pad'),
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {conditionsHelpOpen && (
                <Modal
                    className="wpd-rules-conditions-help-modal"
                    title={__('What each condition does', 'eux-pad')}
                    onRequestClose={() => setConditionsHelpOpen(false)}
                >
                    <p className="wpd-rules-conditions-help-intro">
                        {__(
                            'Every condition on a rule determines if a specific date/dates will be disabled or enabled. Rules are evaluated in list order; the first matching rule wins when several could affect the same date. Each enabled rule must include at least one date scope (Days of Week or Specific Dates) and one Delivery or Pickup condition.',
                            'eux-pad'
                        )}
                    </p>
                    <dl className="wpd-rules-conditions-help-list">
                        {getConditionGuideEntries(rulesPro).map(({ id, term, desc }) => (
                            <div key={id} className="wpd-rules-conditions-help-item">
                                <dt>{term}</dt>
                                <dd>{desc}</dd>
                            </div>
                        ))}
                    </dl>
                    {!rulesPro ? (
                        <p className="wpd-rules-conditions-help-pro-note">
                            {__(
                                'Order Value, Total Orders, Suburb, Preparation Time, and Cutoff Time are available with the EUX Pickup & Delivery Pro add-on.',
                                'eux-pad'
                            )}
                        </p>
                    ) : null}
                </Modal>
            )}
            <AdminPageLayout
                title={__('Pickup & Delivery Settings', 'eux-pad')}
                description={__(
                    'Configure texts, colors, rules, schedules, and checkout behavior',
                    'woo-pickup-delivery'
                )}
                pageTitle={__('Rules', 'eux-pad')}
                loading={loading}
                actions={
                    !loading && (
                        <Flex justify="flex-end" gap={2}>
                            <button
                                type="button"
                                className="wpd-admin-btn wpd-admin-btn--primary"
                                onClick={save}
                                disabled={saving}
                            >
                                {saving ? __('Saving...', 'eux-pad') : __('Save Rules', 'eux-pad')}
                            </button>
                        </Flex>
                    )
                }
            >
                {!loading && (
                    <Card>
                        <CardBody>
                            <div className="wpd-admin-section wpd-rules-section">
                                <div className="wpd-rules-section-header">
                                    <div>
                                        <div className="wpd-admin-section__title">{__('Delivery Rules', 'eux-pad')}</div>
                                        <div className="wpd-admin-section__subtitle">
                                            {__('Create conditional rules to enable or disable delivery/pickup days', 'eux-pad')}
                                        </div>
                                    </div>
                                    <div className="wpd-rules-section-header-actions">
                                        <button
                                            type="button"
                                            className="wpd-admin-btn wpd-admin-btn--ghost"
                                            onClick={() => setConditionsHelpOpen(true)}
                                        >
                                            {__('Condition guide', 'eux-pad')}
                                        </button>
                                        <button
                                            type="button"
                                            className="wpd-admin-btn wpd-admin-btn--primary wpd-rules-add-btn"
                                            onClick={addRule}
                                        >
                                            {__('Add new rule', 'eux-pad')}
                                        </button>
                                    </div>
                                </div>

                                <div
                                    ref={sortListRef}
                                    className={`wpd-rules-list${
                                        sortActiveIndex !== null ? ' wpd-rules-list--sorting' : ''
                                    }`}
                                >
                                    {rules.length === 0 ? (
                                        <p className="wpd-rules-empty">{__('No rules yet. Click "Add new rule" to create one.', 'eux-pad')}</p>
                                    ) : (
                                        rules.map((rule, index) => {
                                            const shiftY =
                                                sortActiveIndex !== null
                                                    ? getReorderShiftY(
                                                          index,
                                                          sortActiveIndex,
                                                          sortOverTo,
                                                          sortStride
                                                      )
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
                                                    key={rule.id}
                                                    className="wpd-rules-sort-item"
                                                    style={{
                                                        transform:
                                                            sortActiveIndex !== null
                                                                ? `translateY(${shiftY}px)`
                                                                : undefined,
                                                        transition: itemTransition,
                                                    }}
                                                >
                                                    <div
                                                        className={
                                                            isLifted
                                                                ? 'wpd-rules-sortable-lift'
                                                                : 'wpd-rules-sortable-lift-wrap'
                                                        }
                                                        style={
                                                            isLifted
                                                                ? {
                                                                      transform: `translateY(${sortPointerDy}px)`,
                                                                      transition: 'none',
                                                                  }
                                                                : undefined
                                                        }
                                                    >
                                                        <RuleCard
                                                            rule={rule}
                                                            selectOptions={selectOptions}
                                                            deliverySuburbs={deliverySuburbs}
                                                            expanded={expandedRuleId === rule.id}
                                                            onAccordionToggle={toggleAccordion}
                                                            onUpdate={(r) => updateRule(index, r)}
                                                            onRemove={() => requestRemoveRule(index, rule)}
                                                            sortHandleProps={{
                                                                onPointerDown: (ev) =>
                                                                    handleSortPointerDown(ev, index),
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </CardBody>
                    </Card>
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
