/**
 * Date picker, time slots (pickup), shipping methods (delivery), and proceed button.
 */

import { __ } from '@wordpress/i18n';
import { useState, useEffect, useMemo } from '@wordpress/element';
import CalendarIcon from '../icons/CalendarIcon';
import ArrowLeftIcon from '../icons/ArrowLeftIcon';
import ArrowRightIcon from '../icons/ArrowRightIcon';

const DATES_PER_PAGE = 10;

export default function DateSelection({
    dates,
    selectedDate,
    onDateSelect,
    timeSlots,
    selectedTimeSlot,
    onTimeSlotSelect,
    showTimeSlots,
    showDateRefreshTimer = true,
    timerWarnSeconds = 30,
    timeRemaining,
    formatTime,
    progressPercentage,
    datesLoading,
    timeSlotsLoading,
    activeTab,
    isLoading,
    handleProceed,
    showDeliveryDates,
    selectedShippingMethod,
    onShippingMethodSelect,
    continueText,
}) {
    const [currentPage, setCurrentPage] = useState(0);
    const [isPageTransitioning, setIsPageTransitioning] = useState(false);

    useEffect(() => {
        setCurrentPage(0);
        setIsPageTransitioning(false);
    }, [dates.length]);

    const paginatedDates = useMemo(() => {
        const pages = [];
        for (let i = 0; i < dates.length; i += DATES_PER_PAGE) {
            pages.push(dates.slice(i, i + DATES_PER_PAGE));
        }
        return pages;
    }, [dates]);

    const currentDates = paginatedDates[currentPage] || [];
    const totalPages = paginatedDates.length;

    const handlePrevPage = () => {
        if (currentPage > 0) {
            setIsPageTransitioning(true);
            setTimeout(() => {
                setCurrentPage((prev) => prev - 1);
                setIsPageTransitioning(false);
            }, 300);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages - 1) {
            setIsPageTransitioning(true);
            setTimeout(() => {
                setCurrentPage((prev) => prev + 1);
                setIsPageTransitioning(false);
            }, 300);
        }
    };

    const shippingMethods = typeof window !== 'undefined' ? window.wpdShippingMethods : null;

    return (
        <div className={`wpd-date-selection ${activeTab === 'delivery' && !showDeliveryDates ? 'wpd-no-dates-state' : ''}`}>
            {(activeTab === 'pickup' || showDeliveryDates) && (
                <div className="wpd-date-header">
                    <h3 className="wpd-date-title">
                        {activeTab === 'pickup' ? __('Pickup Date', 'eux-pickup-delivery') : __('Delivery Date', 'eux-pickup-delivery')}
                    </h3>
                    {showDateRefreshTimer && (
                        <div className="wpd-timer-wrapper">
                            <span className="wpd-timer-label">{__('Dates will auto-refresh in', 'eux-pickup-delivery')}</span>
                            <div
                                className={`wpd-countdown-timer ${timeRemaining <= timerWarnSeconds ? 'wpd-timer-warning' : ''}`}
                            >
                                <svg className="wpd-countdown-circle" viewBox="0 0 36 36">
                                    <path className="wpd-countdown-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path
                                        className={`wpd-countdown-progress ${timeRemaining <= timerWarnSeconds ? 'wpd-progress-warning' : ''}`}
                                        strokeDasharray={`${progressPercentage}, 100`}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <div className="wpd-countdown-text">{formatTime(timeRemaining)}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="wpd-dates-container">
                {activeTab === 'delivery' && !showDeliveryDates && !datesLoading ? (
                    <div className="wpd-no-dates">
                        <p>
                            {__('Please fill the delivery details', 'eux-pickup-delivery')}
                            <br />
                            {__('to get the available dates', 'eux-pickup-delivery')}
                        </p>
                    </div>
                ) : (
                    <div className="wpd-dates-slider-wrapper">
                        <div className={`wpd-dates-slider ${isPageTransitioning ? 'wpd-dates-transitioning' : ''}`}>
                            {datesLoading
                                ? Array(10).fill(0).map((_, i) => <div key={`skeleton-${i}`} className="wpd-skeleton wpd-skeleton-date" />)
                                : currentDates.map((date) => {
                                      const parts = String(date.full || '').split(',');
                                      const dayName = (parts[0] || '').trim();
                                      const monthDay = (parts[1] || '').trim().split(' ').filter(Boolean);
                                      const month = monthDay[0] || '';
                                      const dayNumber = (monthDay[1] || '').replace(',', '');

                                      const bookable = date.bookable !== false;
                                      return (
                                          <div
                                              key={date.date}
                                              className={`wpd-date-box ${selectedDate && selectedDate.date === date.date ? 'selected' : ''}${bookable ? '' : ' wpd-date-box--unavailable'}`}
                                              onClick={() => bookable && onDateSelect(date)}
                                              role={bookable ? 'button' : 'presentation'}
                                              tabIndex={bookable ? 0 : -1}
                                              onKeyDown={(e) => bookable && e.key === 'Enter' && onDateSelect(date)}
                                              aria-disabled={bookable ? undefined : 'true'}
                                          >
                                              <div className="wpd-date-day">{dayName}</div>
                                              <div className="wpd-date-month">{dayNumber}</div>
                                              <div className="wpd-date-day">{month}</div>
                                              
                                          </div>
                                      );
                                  })}
                        </div>
                        {!datesLoading && totalPages > 0 && (
                            <div className="wpd-month-navigation">
                                <button type="button" className="wpd-slider-arrow wpd-slider-arrow-left" onClick={handlePrevPage} disabled={currentPage === 0} aria-label="Previous">
                                    <ArrowLeftIcon />
                                </button>
                                <button type="button" className="wpd-slider-arrow wpd-slider-arrow-right" onClick={handleNextPage} disabled={currentPage === totalPages - 1} aria-label="Next">
                                    <ArrowRightIcon />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {activeTab === 'delivery' && selectedDate && (
                <div className="wpd-selected-info-wrapper">
                    <div className="wpd-selected-info">
                        <p>{selectedDate.full}</p>
                    </div>
                </div>
            )}

            {activeTab === 'delivery' && showDeliveryDates && !datesLoading && shippingMethods && shippingMethods.length > 0 && (
                <div className="wpd-shipping-methods">
                     <div className="wpd-delivery-slots-divider" />
                    <h4>{__('Choose Delivery Option', 'eux-pickup-delivery')}</h4>
                    <div className="wpd-shipping-methods-list">
                        {shippingMethods.map((method) => (
                            <div
                                key={method.id}
                                className={`wpd-shipping-method ${selectedShippingMethod === method.id ? 'selected' : ''}`}
                                onClick={() => onShippingMethodSelect(method.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && onShippingMethodSelect(method.id)}
                            >
                                <div className="wpd-shipping-method-left">
                                    <div className="wpd-shipping-method-title-circle" />
                                    <div className="wpd-shipping-method-title">{method.title}</div>
                                </div>
                                <div className="wpd-shipping-method-cost">{method.cost}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showTimeSlots && selectedDate && (
                <div className="wpd-time-slots">
                    <div className="wpd-time-slots-divider" />
                    <h4>{__('Select a pickup time', 'eux-pickup-delivery')}</h4>
                    <div className="wpd-time-slots-grid">
                        {timeSlotsLoading
                            ? Array(8).fill(0).map((_, i) => <div key={`skeleton-time-${i}`} className="wpd-skeleton wpd-skeleton-time" />)
                            : Object.entries(timeSlots || {}).map(([slot, display]) => (
                                  <div
                                      key={slot}
                                      className={`wpd-time-slot ${selectedTimeSlot === slot ? 'selected' : ''}`}
                                      onClick={() => onTimeSlotSelect(slot)}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => e.key === 'Enter' && onTimeSlotSelect(slot)}
                                  >
                                      {display}
                                  </div>
                              ))}
                    </div>
                </div>
            )}

            {showTimeSlots && selectedDate && selectedTimeSlot && (
                <div className="wpd-selected-info-wrapper wpd-pickup-selected">
                    <div className="wpd-selected-info">
                        <p>{selectedDate.full} at {timeSlots[selectedTimeSlot]}</p>
                    </div>
                </div>
            )}

            {selectedDate && (
                <div className="wpd-proceed-container">
                    <button
                        type="button"
                        className="wpd-proceed-button"
                        onClick={handleProceed}
                        disabled={
                            isLoading ||
                            !selectedDate ||
                            selectedDate.bookable === false ||
                            !selectedShippingMethod ||
                            (activeTab === 'pickup' && !selectedTimeSlot)
                        }
                    >
                        {isLoading ? <span className="wpd-loading" /> : (continueText || __('Continue', 'eux-pickup-delivery'))}
                    </button>
                </div>
            )}
        </div>
    );
}
