/**
 * Main PAD (Pickup & Delivery) app container.
 * Handles tabs, state, and API calls; delegates UI to DeliveryForm, StoreInfo, DateSelection.
 */

import { __ } from '@wordpress/i18n';
import { useState, useEffect, useMemo } from '@wordpress/element';
import DeliveryForm from './DeliveryForm/DeliveryForm';
import StoreInfo from './StoreInfo/StoreInfo';
import DateSelection from './DateSelection/DateSelection';
import DeliveryIcon from './icons/DeliveryIcon';
import PickupIcon from './icons/PickupIcon';

const wpdData = typeof window !== 'undefined' ? window.wpdData || {} : {};

function wpdNormSuburb(s) {
    return String(s).trim().toLowerCase();
}

function formatTimeSlot(slot) {
    const [startTime, endTime] = slot.split('-');
    const formatTime = (time) => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:${minutes} ${ampm}`;
    };
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

export default function PADApp() {
    const globalSettings = wpdData.globalSettings || {};
    const enabledDelivery = globalSettings.tabs?.enable_delivery !== false;
    const enabledPickup = globalSettings.tabs?.enable_pickup !== false;
    const deliveryTitle = globalSettings.labels?.delivery_title || __('DELIVERY', 'eux-pad');
    const pickupTitle = globalSettings.labels?.pickup_title || __('CLICK & COLLECT', 'eux-pad');
    const continueText = globalSettings.labels?.continue_button_text || __('Continue', 'eux-pad');
    const pickupIconUrl = globalSettings.icons?.pickup_icon_url || '';
    const deliveryIconUrl = globalSettings.icons?.delivery_icon_url || '';
    const daysDisplayed = parseInt(globalSettings.days_displayed, 10) > 0 ? parseInt(globalSettings.days_displayed, 10) : 15;
    const showDateRefreshTimer = globalSettings.show_date_refresh_timer !== false;
    const timerDuration = (() => {
        const n = parseInt(globalSettings.date_refresh_timer_seconds, 10);
        if (!Number.isFinite(n)) return 300;
        return Math.min(3600, Math.max(15, n));
    })();

    const [activeTab, setActiveTab] = useState(enabledDelivery ? 'delivery' : 'pickup');
    const [isTabTransitioning, setIsTabTransitioning] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [notice, setNotice] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(timerDuration);
    const [datesLoading, setDatesLoading] = useState(false);
    const [timeSlotsLoading, setTimeSlotsLoading] = useState(false);
    const [showDeliveryDates, setShowDeliveryDates] = useState(false);
    const [selectedShippingMethod, setSelectedShippingMethod] = useState('');
    const [pickupShippingMethod, setPickupShippingMethod] = useState(null);
    const [availableDates, setAvailableDates] = useState([]);
    const [timeSlots, setTimeSlots] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});

    const [deliveryForm, setDeliveryForm] = useState({
        streetAddress: '',
        streetAddressBackend: '',
        suburb: '',
        state: 'NSW',
        postcode: '',
        instructions: '',
    });

    const storeAddress = wpdData.storeAddress || {};
    const pickupSettings = wpdData.pickupSettings || {};
    const australianStates = wpdData.australianStates || {};
    const customerAddress = wpdData.customerAddress || {};
    const deliverySuburbs = useMemo(
        () => (Array.isArray(wpdData.deliverySuburbs) ? wpdData.deliverySuburbs : []),
        []
    );

    // If tabs are disabled via settings, keep a valid active tab.
    useEffect(() => {
        if (!enabledDelivery && activeTab === 'delivery') setActiveTab('pickup');
        if (!enabledPickup && activeTab === 'pickup') setActiveTab('delivery');
    }, [enabledDelivery, enabledPickup]);

    useEffect(() => {
        if (activeTab === 'pickup') {
            setDatesLoading(true);
            setAvailableDates([]);
            setTimeSlots({});
            setTimeRemaining(timerDuration);
            fetchLocalPickup();
        }
    }, [activeTab]);

    const fetchLocalPickup = async () => {
        setDatesLoading(true);
        setAvailableDates([]);
        try {
            const formData = new FormData();
            formData.append('action', 'wpd_calculate_shipping');
            formData.append('nonce', wpdData.nonce);
            formData.append('type', 'pickup');

            const response = await fetch(wpdData.ajaxUrl, { method: 'POST', body: formData });
            const data = await response.json();

            if (data.success && data.data.shipping_method) {
                const shippingMethod = data.data.shipping_method;
                setSelectedShippingMethod(shippingMethod.id);
                setPickupShippingMethod(shippingMethod);
                window.wpdShippingMethod = shippingMethod;

                const datesFormData = new FormData();
                datesFormData.append('action', 'wpd_get_pickup_dates');
                datesFormData.append('nonce', wpdData.nonce);
                const datesResponse = await fetch(wpdData.ajaxUrl, { method: 'POST', body: datesFormData });
                const datesData = await datesResponse.json();

                if (datesData.success && datesData.data.dates) {
                    const apiDates = datesData.data.dates;
                    const transformedDates = apiDates.map((dateObj) => {
                        const dateInstance = new Date(dateObj.date);
                        const fullDayName = dateInstance.toLocaleDateString('en-US', { weekday: 'long' });
                        const fullMonthName = dateInstance.toLocaleDateString('en-US', { month: 'long' });
                        const dayNumber = dateInstance.getDate();
                        const year = dateInstance.getFullYear();
                        return {
                            date: dateObj.date,
                            display: dateInstance.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                            full: `${fullDayName}, ${fullMonthName} ${dayNumber}, ${year}`,
                            day_of_week: fullDayName,
                            time_slots: dateObj.time_slots || [],
                        };
                    });

                    const dateSlotsMap = {};
                    transformedDates.forEach((dateObj) => {
                        const slotsObject = {};
                        (dateObj.time_slots || []).forEach((slot) => {
                            slotsObject[slot] = formatTimeSlot(slot);
                        });
                        dateSlotsMap[dateObj.date] = slotsObject;
                    });
                    window.wpdDateTimeSlots = dateSlotsMap;
                    setAvailableDates(transformedDates);
                } else {
                    setNotice({ type: 'error', message: datesData.data?.message || __('Unable to load pickup dates', 'eux-pad') });
                }
            } else {
                setNotice({ type: 'error', message: data.data?.message || __('Local pickup not configured', 'eux-pad') });
            }
        } catch (error) {
            setNotice({ type: 'error', message: __('An error occurred. Please try again.', 'eux-pad') });
        }
        setDatesLoading(false);
    };

    useEffect(() => {
        if (customerAddress && customerAddress.street_address) {
            const rawSub = customerAddress.suburb || '';
            let suburb = rawSub;
            if (deliverySuburbs.length > 0) {
                const hit = deliverySuburbs.find((s) => wpdNormSuburb(s) === wpdNormSuburb(rawSub));
                suburb = hit !== undefined ? hit : '';
            }
            setDeliveryForm((prev) => ({
                ...prev,
                streetAddress: customerAddress.street_address || '',
                suburb,
                state: customerAddress.state || 'NSW',
                postcode: customerAddress.postcode || '',
            }));
        }
    }, []);

    const progressPercentage = timerDuration > 0 ? (timeRemaining / timerDuration) * 100 : 100;
    const timerWarnSeconds = Math.min(30, Math.max(5, Math.floor(timerDuration / 4)));
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleTabChange = (tab) => {
        if (tab === activeTab) return;
        if (tab === 'delivery' && !enabledDelivery) return;
        if (tab === 'pickup' && !enabledPickup) return;
        setIsTabTransitioning(true);
        setTimeout(() => {
            setActiveTab(tab);
            setSelectedDate(null);
            setSelectedTimeSlot(null);
            setNotice(null);
            setShowDeliveryDates(false);
            setAvailableDates([]);
            setTimeSlots({});
            if (tab === 'pickup') setDatesLoading(true);
            setTimeout(() => setIsTabTransitioning(false), 50);
        }, 300);
    };

    const validateDeliveryForm = () => {
        const errors = {};
        if (!deliveryForm.streetAddress.trim()) errors.streetAddress = true;
        // Delivery instructions are optional
        if (!deliveryForm.suburb.trim()) {
            errors.suburb = true;
        } else if (
            deliverySuburbs.length > 0 &&
            !deliverySuburbs.some((s) => wpdNormSuburb(s) === wpdNormSuburb(deliveryForm.suburb))
        ) {
            errors.suburb = true;
        }
        if (!deliveryForm.postcode.trim()) errors.postcode = true;
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleGetDeliveryDays = async () => {
        setNotice(null);
        if (!validateDeliveryForm()) {
            const first = document.querySelector('.wpd-field-error');
            if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        setDatesLoading(true);
        setShowDeliveryDates(false);
        setAvailableDates([]);
        try {
            const streetForAPI = deliveryForm.streetAddressBackend || deliveryForm.streetAddress;
            const formData = new FormData();
            formData.append('action', 'wpd_calculate_shipping');
            formData.append('nonce', wpdData.nonce);
            formData.append('type', 'delivery');
            formData.append('street_address', streetForAPI);
            formData.append('suburb', deliveryForm.suburb);
            formData.append('state', deliveryForm.state);
            formData.append('postcode', deliveryForm.postcode);

            const response = await fetch(wpdData.ajaxUrl, { method: 'POST', body: formData });
            const data = await response.json();

            if (data.success && data.data.shipping_methods) {
                window.wpdShippingMethods = data.data.shipping_methods;
                const datesFormData = new FormData();
                datesFormData.append('action', 'wpd_get_delivery_dates');
                datesFormData.append('nonce', wpdData.nonce);
                datesFormData.append('street_address', streetForAPI);
                datesFormData.append('suburb', deliveryForm.suburb);
                datesFormData.append('state', deliveryForm.state);
                datesFormData.append('postcode', deliveryForm.postcode);

                const datesResponse = await fetch(wpdData.ajaxUrl, { method: 'POST', body: datesFormData });
                const datesData = await datesResponse.json();

                if (datesData.success && datesData.data.dates) {
                    const apiDates = datesData.data.dates;
                    const transformedDates = apiDates.map((dateObj) => {
                        const dateInstance = new Date(dateObj.date);
                        const fullDayName = dateInstance.toLocaleDateString('en-US', { weekday: 'long' });
                        const fullMonthName = dateInstance.toLocaleDateString('en-US', { month: 'long' });
                        const dayNumber = dateInstance.getDate();
                        const year = dateInstance.getFullYear();
                        return {
                            date: dateObj.date,
                            display: dateInstance.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                            full: `${fullDayName}, ${fullMonthName} ${dayNumber}, ${year}`,
                            day_of_week: fullDayName,
                        };
                    });
                    setAvailableDates(transformedDates);
                    setShowDeliveryDates(true);
                    setTimeRemaining(timerDuration);
                } else {
                    setNotice({ type: 'error', message: datesData.data?.message || __('Unable to load delivery dates', 'eux-pad') });
                }
            } else {
                setNotice({ type: 'error', message: data.data?.message || __('Unable to calculate shipping', 'eux-pad') });
            }
        } catch (error) {
            setNotice({ type: 'error', message: __('An error occurred while calculating shipping', 'eux-pad') });
        }
        setDatesLoading(false);
    };

    useEffect(() => {
        const shouldRunTimer =
            showDateRefreshTimer && (activeTab === 'pickup' || (activeTab === 'delivery' && showDeliveryDates));
        if (!shouldRunTimer) return;
        const timer = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    setNotice({ type: 'info', message: __('Session refreshed - updating available dates...', 'eux-pad') });
                    if (activeTab === 'delivery' && showDeliveryDates) {
                        handleGetDeliveryDays();
                    } else if (activeTab === 'pickup') {
                        setDatesLoading(true);
                        setAvailableDates([]);
                        fetchLocalPickup();
                    }
                    setTimeout(() => setNotice(null), 3000);
                    return timerDuration;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [activeTab, showDeliveryDates, showDateRefreshTimer, timerDuration]);

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        setSelectedTimeSlot(null);
        if (activeTab === 'pickup') {
            setTimeSlotsLoading(true);
            if (window.wpdDateTimeSlots && window.wpdDateTimeSlots[date.date]) {
                setTimeSlots(window.wpdDateTimeSlots[date.date]);
            } else {
                setTimeSlots({});
            }
            setTimeout(() => setTimeSlotsLoading(false), 300);
        }
    };

    const handleDeliveryFormChange = (field, value) => {
        if (field === '__bulk_update__' && typeof value === 'object') {
            setDeliveryForm((prev) => ({ ...prev, ...value }));
            return;
        }
        setDeliveryForm((prev) => ({ ...prev, [field]: value }));
        if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: false }));
    };

    const handleProceed = async () => {
        if (!selectedDate) {
            setNotice({ type: 'error', message: __('Please select a date', 'eux-pad') });
            return;
        }
        if (activeTab === 'pickup' && !selectedTimeSlot) {
            setNotice({ type: 'error', message: __('Please select a time slot', 'eux-pad') });
            return;
        }
        if (activeTab === 'delivery' && !validateDeliveryForm()) {
            const first = document.querySelector('.wpd-field-error');
            if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        setIsLoading(true);
        setNotice(null);
        try {
            const formData = new FormData();
            formData.append('action', 'wpd_save_selection');
            formData.append('nonce', wpdData.nonce);
            formData.append('type', activeTab);
            // Use machine-readable Y-m-d so server stores consistent _wpd_date meta.
            formData.append('date', selectedDate.date);
            formData.append('time_slot', selectedTimeSlot || '');
            formData.append('shipping_method', selectedShippingMethod || '');

            if (activeTab === 'delivery') {
                const streetForCheckout = deliveryForm.streetAddressBackend || deliveryForm.streetAddress;
                formData.append('street_address', streetForCheckout);
                formData.append('suburb', deliveryForm.suburb);
                formData.append('state', deliveryForm.state);
                formData.append('postcode', deliveryForm.postcode);
                formData.append('instructions', deliveryForm.instructions);
            }

            const response = await fetch(wpdData.ajaxUrl, { method: 'POST', body: formData });
            const data = await response.json();

            if (data.success) {
                window.location.href = data.data.checkout_url;
            } else {
                setNotice({ type: 'error', message: data.data?.message || __('An error occurred', 'eux-pad') });
                setIsLoading(false);
            }
        } catch (error) {
            setNotice({ type: 'error', message: __('An error occurred. Please try again.', 'eux-pad') });
            setIsLoading(false);
        }
    };

    return (
        <div
            className="wpd-app"
            style={{
                '--wpd-tab-hover-bg': globalSettings.colors?.tab_hover_bg,
                '--wpd-tab-selected-bg': globalSettings.colors?.tab_selected_bg,
                '--wpd-tab-selected-text': globalSettings.colors?.tab_selected_text,
                '--wpd-tab-text': globalSettings.colors?.tab_text,
                '--wpd-day-name': globalSettings.colors?.day_name,
                '--wpd-day-number': globalSettings.colors?.day_number,
                '--wpd-day-name-selected': globalSettings.colors?.day_name_selected,
                '--wpd-day-number-selected': globalSettings.colors?.day_number_selected,
                '--wpd-day-selector-bg': globalSettings.colors?.day_selector_bg,
                '--wpd-day-selector-bg-selected': globalSettings.colors?.day_selector_bg_selected,
                '--wpd-time-bg': globalSettings.colors?.time_selector_bg,
                '--wpd-time-text': globalSettings.colors?.time_selector_text,
                '--wpd-time-bg-selected': globalSettings.colors?.time_selector_bg_selected,
                '--wpd-time-text-selected': globalSettings.colors?.time_selector_text_selected,
                '--wpd-continue-bg': globalSettings.colors?.continue_button_bg,
                '--wpd-continue-text': globalSettings.colors?.continue_button_text,
                '--wpd-continue-bg-hover': globalSettings.colors?.continue_button_bg_hover,
                '--wpd-continue-text-hover': globalSettings.colors?.continue_button_text_hover,
            }}
        >
            {notice && (
                <div className={`wpd-notice ${notice.type}`}>{notice.message}</div>
            )}
            <div className="wpd-tabs">
                <div className="wpd-tab-list">
                    {enabledDelivery && (
                        <button
                            type="button"
                            className={`wpd-tab-button ${activeTab === 'delivery' ? 'active' : ''}`}
                            onClick={() => handleTabChange('delivery')}
                        >
                            <DeliveryIcon src={deliveryIconUrl} />
                            {deliveryTitle}
                        </button>
                    )}
                    {enabledPickup && (
                        <button
                            type="button"
                            className={`wpd-tab-button ${activeTab === 'pickup' ? 'active' : ''}`}
                            onClick={() => handleTabChange('pickup')}
                        >
                            <PickupIcon src={pickupIconUrl} />
                            {pickupTitle}
                        </button>
                    )}
                </div>
            </div>

            <div className={`wpd-content-wrapper ${isTabTransitioning ? 'wpd-content-transitioning' : ''}`}>
                {activeTab === 'delivery' ? (
                    <DeliveryForm
                        form={deliveryForm}
                        onChange={handleDeliveryFormChange}
                        states={australianStates}
                        onGetDays={handleGetDeliveryDays}
                        fieldErrors={fieldErrors}
                        deliverySuburbs={deliverySuburbs}
                    />
                ) : (
                    <StoreInfo address={storeAddress} pickupSettings={pickupSettings} />
                )}

                <DateSelection
                    dates={(availableDates || []).slice(0, daysDisplayed)}
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    timeSlots={timeSlots}
                    selectedTimeSlot={selectedTimeSlot}
                    onTimeSlotSelect={setSelectedTimeSlot}
                    showTimeSlots={activeTab === 'pickup'}
                    showDateRefreshTimer={showDateRefreshTimer}
                    timerWarnSeconds={timerWarnSeconds}
                    timeRemaining={timeRemaining}
                    formatTime={formatTime}
                    progressPercentage={progressPercentage}
                    datesLoading={datesLoading}
                    timeSlotsLoading={timeSlotsLoading}
                    activeTab={activeTab}
                    isLoading={isLoading}
                    handleProceed={handleProceed}
                    showDeliveryDates={showDeliveryDates}
                    selectedShippingMethod={selectedShippingMethod}
                    onShippingMethodSelect={setSelectedShippingMethod}
                    pickupShippingMethod={pickupShippingMethod}
                    continueText={continueText}
                />
            </div>
        </div>
    );
}
