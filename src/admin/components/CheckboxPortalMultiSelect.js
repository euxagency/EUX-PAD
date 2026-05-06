/**
 * Portaled checkbox list – shared by Rules conditions and Delivery Settings.
 */
import { __ } from '@wordpress/i18n';
import {
    useEffect,
    useState,
    useCallback,
    useMemo,
    useRef,
    useLayoutEffect,
    createPortal,
} from '@wordpress/element';

/**
 * @param {string[]} [selected]
 * @param {function(string[]): void} onChange
 * @param {{ value: string, label: string }[]} options
 * @param {string} triggerPlaceholder
 * @param {string} [dropdownMaxHeight] CSS max-height for scroll.
 * @param {boolean} [searchable]
 * @param {string} [searchPlaceholder]
 * @param {string} [searchAriaLabel]
 * @param {string} [emptyFilterMessage]
 */
export default function CheckboxPortalMultiSelect({
    selected = [],
    onChange,
    options,
    triggerPlaceholder,
    dropdownMaxHeight,
    searchable = false,
    searchPlaceholder,
    searchAriaLabel,
    emptyFilterMessage,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [filterQuery, setFilterQuery] = useState('');
    const [coords, setCoords] = useState(null);
    const wrapRef = useRef(null);
    const triggerRef = useRef(null);
    const portalRef = useRef(null);
    const searchInputRef = useRef(null);
    const optList = Array.isArray(options) ? options : [];
    const searchPh = searchPlaceholder ?? __('Search suburbs…', 'eux-pickup-delivery');
    const searchAria = searchAriaLabel ?? __('Search suburbs', 'eux-pickup-delivery');
    const emptyFilter = emptyFilterMessage ?? __('No matching suburbs.', 'eux-pickup-delivery');

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
    }, [searchable, filterQuery, optList]);

    const updatePosition = useCallback(() => {
        const el = triggerRef.current;
        if (!el) {
            return;
        }
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
        if (!isOpen || !searchable) {
            return;
        }
        const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
    }, [isOpen, searchable]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const handleMouseDown = (e) => {
            if (wrapRef.current?.contains(e.target)) {
                return;
            }
            if (portalRef.current?.contains(e.target)) {
                return;
            }
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isOpen]);

    const toggleValue = (val) => {
        const key = String(val);
        const sel = (Array.isArray(selected) ? selected : []).map((s) => String(s));
        const next = sel.includes(key) ? sel.filter((d) => d !== key) : [...sel, key];
        onChange(next);
    };

    const selectedLabels = useMemo(() => {
        const map = new Map(
            optList.map(({ value: v, label }) => [
                String(v),
                label != null && String(label).trim() !== '' ? String(label) : String(v),
            ])
        );
        return (Array.isArray(selected) ? selected : []).map((v) => map.get(String(v)) ?? String(v));
    }, [optList, selected]);

    const displayText = selectedLabels.length > 0 ? selectedLabels.join(', ') : triggerPlaceholder;

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
                            placeholder={searchPh}
                            aria-label={searchAria}
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
                        {searchable && filterQuery.trim() ? emptyFilter : __('No options.', 'eux-pickup-delivery')}
                    </div>
                ) : (
                    filteredOptions.map(({ value: val, label }) => (
                        <label
                            key={val}
                            className="wpd-rules-multiselect-option"
                            role="option"
                            aria-selected={(Array.isArray(selected) ? selected : []).map(String).includes(String(val))}
                        >
                            <input
                                type="checkbox"
                                checked={(Array.isArray(selected) ? selected : []).map(String).includes(String(val))}
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
