/**
 * Single-select dropdown (Rule Objective, condition fields, Pickup day, etc.).
 * Portaled list — matches Rules page styling.
 */
import { __ } from '@wordpress/i18n';
import {
    useState,
    useCallback,
    useRef,
    useEffect,
    useLayoutEffect,
    useId,
    createPortal,
} from '@wordpress/element';

function optionLabel(opt) {
    if (opt == null) return '';
    const t = opt.label;
    if (t != null && String(t).trim() !== '') return t;
    return String(opt.value ?? '');
}

export default function RulesCustomSelect({
    value,
    onChange,
    options,
    placeholder,
    className,
    label,
    ariaLabel,
    portalDropdownClassName,
    portalMaxWidth,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState(null);
    const wrapRef = useRef(null);
    const triggerRef = useRef(null);
    const portalRef = useRef(null);
    const labelId = useId();

    const list = Array.isArray(options) ? options : [];

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
        if (!isOpen) return;
        const handleMouseDown = (e) => {
            if (wrapRef.current?.contains(e.target)) return;
            if (portalRef.current?.contains(e.target)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isOpen]);

    const selected = list.find((o) => String(o.value) === String(value));
    const displayText = selected
        ? `${optionLabel(selected)}${
              selected.isPro && selected.disabled ? ` (${__('Pro', 'eux-pickup-delivery')})` : ''
          }`.trim()
        : placeholder || __('Select…', 'eux-pickup-delivery');

    const dropdown =
        isOpen &&
        coords &&
        createPortal(
            <div
                ref={portalRef}
                className={`wpd-rules-multiselect-dropdown wpd-rules-multiselect-dropdown--portal${
                    portalDropdownClassName ? ` ${portalDropdownClassName}` : ''
                }`}
                role="listbox"
                style={{
                    position: 'fixed',
                    top: `${coords.top}px`,
                    left: `${coords.left}px`,
                    minWidth: `${coords.minWidth}px`,
                    width: 'max-content',
                    maxWidth: portalMaxWidth || 'min(340px, calc(100vw - 24px))',
                    zIndex: 100000,
                    backgroundColor: '#fff',
                    border: '1px solid #eceef2',
                }}
            >
                {list.map((opt, idx) =>
                    opt.disabled ? (
                        <div
                            key={`${String(opt.value)}-${idx}`}
                            role="option"
                            aria-disabled="true"
                            aria-selected={String(opt.value) === String(value)}
                            className={`wpd-rules-custom-select-option wpd-rules-custom-select-option--disabled ${
                                String(opt.value) === String(value) ? 'is-selected' : ''
                            }`}
                        >
                            <span className="wpd-rules-custom-select-option__label">{optionLabel(opt)}</span>
                            {opt.isPro ? (
                                <span className="wpd-pro-badge" title={__('Requires Pro add-on', 'eux-pickup-delivery')}>
                                    {__('Pro', 'eux-pickup-delivery')}
                                </span>
                            ) : null}
                        </div>
                    ) : (
                        <button
                            key={`${String(opt.value)}-${idx}`}
                            type="button"
                            role="option"
                            aria-selected={String(opt.value) === String(value)}
                            className={`wpd-rules-custom-select-option ${
                                String(opt.value) === String(value) ? 'is-selected' : ''
                            }`}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                        >
                            {optionLabel(opt)}
                        </button>
                    )
                )}
            </div>,
            document.body
        );

    return (
        <>
            <div
                className={`wpd-rules-multiselect wpd-rules-custom-select ${className || ''}`}
                ref={wrapRef}
            >
                {label ? (
                    <span id={labelId} className="components-base-control__label wpd-rules-custom-select__label">
                        {label}
                    </span>
                ) : null}
                <button
                    ref={triggerRef}
                    type="button"
                    className="wpd-rules-multiselect-trigger"
                    onClick={() => setIsOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-labelledby={label ? labelId : undefined}
                    aria-label={label ? undefined : ariaLabel}
                >
                    <span
                        className={
                            !selected
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
