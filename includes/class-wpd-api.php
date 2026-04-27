<?php

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class EUX_PAD_API {

	private static $instance = null;

	/**
	 * Optional pickup store id from REST request (for multi-store add-ons).
	 *
	 * @var string
	 */
	private $pickup_store_id = '';

	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register REST API routes
	 */
	public function register_routes() {
		// Pickup dates endpoint
		register_rest_route(
			'eux-pad/v1',
			'/pickup-dates',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'get_pickup_dates' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'cart_items' => array(
						'required'    => true,
						'type'        => 'array',
						'description' => 'Cart items data',
					),
					'store_id'   => array(
						'required'    => false,
						'type'        => 'string',
						'description' => 'Pickup store id (multi-store)',
					),
				),
			)
		);

		// Delivery dates endpoint
		register_rest_route(
			'eux-pad/v1',
			'/delivery-dates',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'get_delivery_dates' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'cart_items'       => array(
						'required'    => true,
						'type'        => 'array',
						'description' => 'Cart items data',
					),
					'delivery_address' => array(
						'required'    => true,
						'type'        => 'object',
						'description' => 'Delivery address details',
					),
				),
			)
		);
	}

	/**
	 * Get pickup dates with time slots
	 */
	public function get_pickup_dates( $request ) {
		$cart_items = $request->get_param( 'cart_items' );

		// Validate cart items
		if ( empty( $cart_items ) ) {
			return new WP_Error(
				'empty_cart',
				'Cart items are required',
				array( 'status' => 400 )
			);
		}

		$this->pickup_store_id = sanitize_text_field( (string) $request->get_param( 'store_id' ) );

		// Dates from today through global "days displayed" window (then rules applied)
		$dates = $this->generate_pickup_dates( $cart_items );
		$dates = $this->apply_rules_to_dates( $dates, 'pickup', $cart_items, null );

		$response              = rest_ensure_response(
			array(
				'success' => true,
				'data'    => array(
					'dates'      => $dates,
					'total_days' => count( $dates ),
				),
			)
		);
		$this->pickup_store_id = '';
		return $response;
	}

	/**
	 * Get delivery dates
	 */
	public function get_delivery_dates( $request ) {
		$cart_items       = $request->get_param( 'cart_items' );
		$delivery_address = $request->get_param( 'delivery_address' );

		// Validate inputs
		if ( empty( $cart_items ) ) {
			return new WP_Error(
				'empty_cart',
				'Cart items are required',
				array( 'status' => 400 )
			);
		}

		if ( empty( $delivery_address ) ) {
			return new WP_Error(
				'missing_address',
				'Delivery address is required',
				array( 'status' => 400 )
			);
		}

		// Validate address fields
		$required_fields = array( 'street_address', 'suburb', 'state', 'postcode' );
		foreach ( $required_fields as $field ) {
			if ( empty( $delivery_address[ $field ] ) ) {
				return new WP_Error(
					'invalid_address',
					"Address field '{$field}' is required",
					array( 'status' => 400 )
				);
			}
		}

		// Same calendar window as pickup (global days_displayed)
		$dates = $this->generate_delivery_dates( $cart_items, $delivery_address );
		$dates = $this->apply_rules_to_dates( $dates, 'delivery', $cart_items, $delivery_address );

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => array(
					'dates'      => $dates,
					'total_days' => count( $dates ),
				),
			)
		);
	}

	/**
	 * Global setting: how many calendar days forward from today to consider (clamped 1–60).
	 *
	 * @return int
	 */
	private function get_global_days_displayed() {
		$fallback = 15;
		if ( ! class_exists( 'WPD_Settings' ) ) {
			return $fallback;
		}
		$defaults = WPD_Settings::get_instance()->get_global_defaults();
		$saved    = get_option( WPD_Settings::OPTION_GLOBAL, array() );
		$n        = isset( $saved['days_displayed'] ) ? (int) $saved['days_displayed'] : ( isset( $defaults['days_displayed'] ) ? (int) $defaults['days_displayed'] : $fallback );
		return max( 1, min( 60, $n ) );
	}

	/**
	 * Start of "today" in WordPress timezone for booking windows.
	 *
	 * @return DateTime
	 */
	private function get_booking_window_start() {
		$tz = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$d  = new DateTime( 'now', $tz );
		$d->setTime( 0, 0, 0 );
		return $d;
	}

	/**
	 * Generate pickup dates with time slots (NEW FORMAT)
	 */
	private function generate_pickup_dates( $cart_items ) {
		$dates  = array();
		$today  = $this->get_booking_window_start();
		$window = $this->get_global_days_displayed();

		// Always return exactly `window` consecutive calendar days (rules may mark days non-bookable later).
		for ( $i = 0; $i < $window; $i++ ) {
			$current_date = clone $today;
			$current_date->modify( '+' . $i . ' days' );
			$date_string = $current_date->format( 'Y-m-d' );

			$base_ok    = $this->is_date_available( $current_date, $cart_items, 'pickup', null );
			$time_slots = array();
			if ( $base_ok ) {
				$time_slots = $this->generate_time_slots_array( $current_date, $cart_items );
			}

			$dates[] = array(
				'date'       => $date_string,
				'time_slots' => $time_slots,
				'bookable'   => $base_ok && ! empty( $time_slots ),
			);
		}

		return $dates;
	}

	/**
	 * Generate delivery dates (NEW FORMAT - dates only, no time slots)
	 */
	private function generate_delivery_dates( $cart_items, $delivery_address ) {
		$dates  = array();
		$today  = $this->get_booking_window_start();
		$window = $this->get_global_days_displayed();

		// Always return exactly `window` consecutive calendar days (rules may mark days non-bookable later).
		for ( $i = 0; $i < $window; $i++ ) {
			$current_date = clone $today;
			$current_date->modify( '+' . $i . ' days' );
			$date_string = $current_date->format( 'Y-m-d' );

			$dates[] = array(
				'date'     => $date_string,
				'bookable' => $this->is_date_available( $current_date, $cart_items, 'delivery', $delivery_address ),
			);
		}

		return $dates;
	}

	/**
	 * Generate time slots array for pickup (NEW FORMAT)
	 */
	private function generate_time_slots_array( $date, $cart_items ) {
		$slots       = array();
		$day_name    = $date->format( 'l' ); // Monday, Tuesday, ...
		$date_string = $date->format( 'Y-m-d' );

		// Load pickup settings (opening hours + interval).
		$interval = 60;
		$opening  = array();
		if ( class_exists( 'WPD_Settings' ) ) {
			$settings = get_option( WPD_Settings::OPTION_PICKUP, array() );
			$defaults = WPD_Settings::get_instance()->get_pickup_defaults();
			$merged   = WPD_Settings::get_instance()->merge_pickup_settings( $defaults, is_array( $settings ) ? $settings : array() );
			$store_id = isset( $this->pickup_store_id ) ? (string) $this->pickup_store_id : '';
			/**
			 * Adjust merged pickup settings used to build time slots (e.g. per-store hours).
			 *
			 * @param array  $merged     Merged pickup settings.
			 * @param array  $cart_items Cart line payload.
			 * @param string $store_id   Store id from pickup-dates request, if any.
			 */
			$merged   = apply_filters( 'wpd_pickup_time_slot_settings', $merged, $cart_items, $store_id );
			$interval = max( 5, (int) $merged['interval'] );
			$opening  = isset( $merged['opening_hours'] ) && is_array( $merged['opening_hours'] ) ? $merged['opening_hours'] : array();
		}

		// Find opening hours for this weekday.
		$day_open = null;
		foreach ( $opening as $row ) {
			if ( isset( $row['day'] ) && strcasecmp( trim( $row['day'] ), $day_name ) === 0 ) {
				if ( ! empty( $row['start'] ) && ! empty( $row['end'] ) ) {
					$day_open = $row;
					break;
				}
			}
		}

		if ( ! $day_open ) {
			return array();
		}

		$start_time = DateTime::createFromFormat( 'Y-m-d H:i', $date_string . ' ' . $day_open['start'] );
		$end_time   = DateTime::createFromFormat( 'Y-m-d H:i', $date_string . ' ' . $day_open['end'] );

		if ( ! $start_time || ! $end_time || $start_time >= $end_time ) {
			return array();
		}

		$current = clone $start_time;
		while ( $current < $end_time ) {
			$slot_start = clone $current;
			$slot_end   = clone $current;
			$slot_end->modify( '+' . $interval . ' minutes' );

			if ( $slot_end > $end_time ) {
				break;
			}

			$slot = $slot_start->format( 'H:i' ) . '-' . $slot_end->format( 'H:i' );

			if ( $this->is_time_slot_available( $date_string, $slot, $cart_items ) ) {
				$slots[] = $slot;
			}

			$current = $slot_end;
		}

		return $slots;
	}

	/**
	 * Apply rules to filter dates. Delegates to WPD_Rules.
	 *
	 * @param array  $dates            Dates from generate_*.
	 * @param string $type             'pickup' or 'delivery'.
	 * @param array  $cart_items       Cart items.
	 * @param array  $delivery_address Delivery address or null.
	 * @return array Filtered dates.
	 */
	private function apply_rules_to_dates( $dates, $type, $cart_items, $delivery_address = null ) {
		if ( ! class_exists( 'WPD_Rules' ) ) {
			return $dates;
		}
		return WPD_Rules::get_instance()->apply_rules( $dates, $type, $cart_items, $delivery_address );
	}

	/**
	 * Check if date is available based on business logic
	 */
	private function is_date_available( $date, $cart_items, $type, $delivery_address = null ) {
		// 1. No dates before "today" (WP timezone)
		$today    = $this->get_booking_window_start();
		$date_mid = clone $date;
		$date_mid->setTime( 0, 0, 0 );
		if ( $date_mid < $today ) {
			return false;
		}

		// 2. Check if date is a holiday
		$holidays    = $this->get_holidays();
		$date_string = $date->format( 'Y-m-d' );

		if ( in_array( $date_string, $holidays, true ) ) {
			return false;
		}

		// 3. Check cart weight/volume for delivery capacity
		if ( 'delivery' === $type && $delivery_address ) {
			$total_weight = $this->calculate_cart_weight( $cart_items );

			if ( $total_weight > 50 ) {
				$existing_orders = $this->get_orders_for_date( $date_string, $type );
				if ( count( $existing_orders ) >= 10 ) {
					return false;
				}
			}
		}

		// 4. Check if postcode is serviced for this date
		if ( 'delivery' === $type && $delivery_address ) {
			$postcode    = $delivery_address['postcode'];
			$day_of_week = $date->format( 'l' );

			if ( ! $this->is_postcode_serviced( $postcode, $day_of_week ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Check if time slot is available
	 */
	private function is_time_slot_available( $date, $slot, $cart_items ) {
		global $wpdb;

		$count = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->postmeta} pm1
            INNER JOIN {$wpdb->postmeta} pm2 ON pm1.post_id = pm2.post_id
            INNER JOIN {$wpdb->posts} p ON pm1.post_id = p.ID
            WHERE pm1.meta_key = '_wpd_date'
            AND pm1.meta_value = %s
            AND pm2.meta_key = '_wpd_time_slot'
            AND pm2.meta_value = %s
            AND p.post_type = 'shop_order'
            AND p.post_status NOT IN ('wc-cancelled', 'wc-refunded', 'trash')",
				$date,
				$slot
			)
		);

		$max_capacity = 5;
		return ( $count < $max_capacity );
	}

	/**
	 * Calculate total cart weight
	 */
	private function calculate_cart_weight( $cart_items ) {
		$total_weight = 0;

		foreach ( $cart_items as $item ) {
			$product_id = isset( $item['product_id'] ) ? $item['product_id'] : 0;
			$quantity   = isset( $item['quantity'] ) ? $item['quantity'] : 1;

			if ( $product_id ) {
				$product = wc_get_product( $product_id );
				if ( $product ) {
					$weight        = floatval( $product->get_weight() );
					$total_weight += ( $weight * $quantity );
				}
			}
		}

		return $total_weight;
	}

	/**
	 * Get holidays list
	 */
	private function get_holidays() {
		return apply_filters(
			'eux_pad_holidays',
			array(
				'2025-01-01', // New Year's Day
				'2025-01-27', // Australia Day
				'2025-04-18', // Good Friday
				'2025-04-19', // Easter Saturday
				'2025-04-20', // Easter Sunday
				'2025-04-21', // Easter Monday
				'2025-04-25', // ANZAC Day
				'2025-12-25', // Christmas Day
				'2025-12-26', // Boxing Day
			)
		);
	}

	/**
	 * Get orders for a specific date
	 */
	private function get_orders_for_date( $date, $type ) {
		global $wpdb;

		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.ID FROM {$wpdb->postmeta} pm1
            INNER JOIN {$wpdb->postmeta} pm2 ON pm1.post_id = pm2.post_id
            INNER JOIN {$wpdb->posts} p ON pm1.post_id = p.ID
            WHERE pm1.meta_key = '_wpd_date'
            AND pm1.meta_value = %s
            AND pm2.meta_key = '_wpd_type'
            AND pm2.meta_value = %s
            AND p.post_type = 'shop_order'
            AND p.post_status NOT IN ('wc-cancelled', 'wc-refunded', 'trash')",
				$date,
				$type
			)
		);

		return $results;
	}

	/**
	 * Check if postcode is serviced on a specific day
	 */
	private function is_postcode_serviced( $postcode, $day_of_week ) {
		$postcode = intval( $postcode );

		// Example: Postcodes 4000-4499 serviced Mon-Fri
		if ( $postcode >= 4000 && $postcode <= 4499 ) {
			return ! in_array( $day_of_week, array( 'Saturday', 'Sunday' ), true );
		}

		// Example: Postcodes 4500-4999 serviced Mon, Wed, Fri
		if ( $postcode >= 4500 && $postcode <= 4999 ) {
			return in_array( $day_of_week, array( 'Monday', 'Wednesday', 'Friday' ), true );
		}

		// Default: all days including Sunday
		return true;
	}
}

// Initialize the API
EUX_PAD_API::get_instance();
