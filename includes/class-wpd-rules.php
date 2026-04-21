<?php
/**
 * Rules engine for Pickup & Delivery.
 *
 * Base dates come from global/pickup settings. Each enabled rule may show or hide dates for its
 * Method (pickup/delivery) according to Rule Objective (enable_day / disable_day). All conditions
 * on a rule are ANDed. Rules are sorted by order (ascending): the first matching rule wins when
 * several would affect the same date.
 *
 * Condition summary (free): days of week, specific dates, method (pickup/delivery).
 * Pro-only conditions (order value, total orders, suburb, lead time, cutoff) are implemented by
 * the EUX Pickup & Delivery Pro add-on via the `wpd_rules_has_pro` and `wpd_rules_evaluate_pro_condition` filters.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPD_Rules {
	private static $instance = null;

	/**
	 * Whether Pro rule conditions (order value, suburb, lead time, etc.) are active.
	 *
	 * @return bool
	 */
	public static function has_pro_features() {
		return (bool) apply_filters( 'wpd_rules_has_pro', false );
	}

	/**
	 * Condition types implemented by EUX Pickup & Delivery Pro.
	 *
	 * @return string[]
	 */
	public static function get_pro_condition_types() {
		return array( 'order_value', 'total_orders', 'suburb', 'lead_time', 'cutoff_time' );
	}

	/**
	 * @param string $type Condition type slug.
	 * @return bool
	 */
	public static function is_pro_condition_type( $type ) {
		return in_array( (string) $type, self::get_pro_condition_types(), true );
	}

	/**
	 * Strip Pro-only conditions when the Pro add-on is not active.
	 *
	 * @param array $conditions Rule conditions.
	 * @return array
	 */
	private function filter_conditions_by_license( $conditions ) {
		if ( ! is_array( $conditions ) ) {
			return array();
		}
		if ( self::has_pro_features() ) {
			return $conditions;
		}
		$out = array();
		foreach ( $conditions as $c ) {
			if ( ! is_array( $c ) ) {
				continue;
			}
			$t = isset( $c['type'] ) ? (string) $c['type'] : '';
			if ( self::is_pro_condition_type( $t ) ) {
				continue;
			}
			$out[] = $c;
		}
		return $out;
	}

	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {}

	/**
	 * Apply rules to filter dates. Works on top of base availability.
	 *
	 * @param array  $dates           Array of date items (e.g. ['date' => 'Y-m-d', 'time_slots' => [...]]).
	 * @param string $type            'pickup' or 'delivery'.
	 * @param array  $cart_items      Cart items for order value etc.
	 * @param array  $delivery_address Delivery address (for suburb) or null.
	 * @return array Filtered dates.
	 */
	public function apply_rules( $dates, $type, $cart_items, $delivery_address = null ) {
		$rules = $this->get_rules();
		if ( empty( $rules ) ) {
			return $dates;
		}

		// Sort by order (ascending = highest priority first).
		usort(
			$rules,
			function ( $a, $b ) {
				return ( isset( $a['order'] ) ? (int) $a['order'] : 0 ) - ( isset( $b['order'] ) ? (int) $b['order'] : 0 );
			}
		);

		$cart_total  = $this->get_cart_total( $cart_items );
		$wp_tz       = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$today_now   = new DateTime( 'now', $wp_tz );
		$today_start = clone $today_now;
		$today_start->setTime( 0, 0, 0 );

		$result = array();
		foreach ( $dates as $item ) {
			$date_str = isset( $item['date'] ) ? $item['date'] : '';
			if ( empty( $date_str ) ) {
				continue;
			}

			$date_obj = DateTime::createFromFormat( 'Y-m-d', $date_str, $wp_tz );
			if ( ! $date_obj ) {
				$result[] = $item;
				continue;
			}

			$day_name = $date_obj->format( 'l' );
			$d_start  = clone $date_obj;
			$d_start->setTime( 0, 0, 0 );
			if ( $d_start < $today_start ) {
				$days_ahead = -1;
			} else {
				$days_ahead = (int) $today_start->diff( $d_start )->days;
			}

			$rule_action = null; // enable_day, disable_day, or null = no match.
			foreach ( $rules as $rule ) {
				if ( empty( $rule['enabled'] ) ) {
					continue;
				}
				if ( $this->rule_matches( $rule, $date_str, $day_name, $type, $cart_total, $cart_items, $delivery_address, $days_ahead, $today_now ) ) {
					$rule_action = isset( $rule['objective'] ) ? $rule['objective'] : 'disable_day';
					break; // First matching rule wins (highest priority).
				}
			}

			if ( 'enable_day' === $rule_action ) {
				$result[] = $item;
			} elseif ( 'disable_day' === $rule_action ) {
				// Exclude this date.
				continue;
			} else {
				// No rule matched – keep original availability.
				$result[] = $item;
			}
		}

		return $result;
	}

	/**
	 * Check if a rule matches for the given date/context.
	 *
	 * @param array    $rule             Rule.
	 * @param string   $date_str         Date Y-m-d.
	 * @param string   $day_name         Day name (e.g. Monday).
	 * @param string   $type             pickup or delivery.
	 * @param float    $cart_total       Cart total.
	 * @param array    $cart_items       Cart items.
	 * @param array    $delivery_address Delivery address or null.
	 * @param int      $days_ahead       Whole days from today (WP tz) to date; -1 if date is in the past.
	 * @param DateTime $today_now        Current moment in WP timezone (for cutoff).
	 * @return bool
	 */
	private function rule_matches( $rule, $date_str, $day_name, $type, $cart_total, $cart_items, $delivery_address, $days_ahead, $today_now ) {
		$raw_conditions = isset( $rule['conditions'] ) && is_array( $rule['conditions'] ) ? $rule['conditions'] : array();
		$conditions     = $this->filter_conditions_by_license( $raw_conditions );
		if ( empty( $conditions ) ) {
			return false;
		}

		// Lead time / cutoff only support disable_day (admin validation; enforce at runtime too).
		foreach ( $conditions as $c ) {
			$ct = isset( $c['type'] ) ? $c['type'] : '';
			if ( ( 'lead_time' === $ct || 'cutoff_time' === $ct ) && isset( $rule['objective'] ) && 'disable_day' !== $rule['objective'] ) {
				return false;
			}
		}

		// Require (days_of_week OR specific_dates) AND method — same as save validation.
		$date_scope_types = array( 'days_of_week', 'specific_dates' );
		$has_date_scope   = false;
		$has_method       = false;
		foreach ( $conditions as $c ) {
			$t = isset( $c['type'] ) ? $c['type'] : '';
			if ( in_array( $t, $date_scope_types, true ) ) {
				$has_date_scope = true;
			}
			if ( 'method' === $t ) {
				$has_method = true;
			}
		}
		if ( ! $has_date_scope || ! $has_method ) {
			return false;
		}

		// All conditions must match (AND).
		foreach ( $conditions as $c ) {
			$cond_type     = isset( $c['type'] ) ? $c['type'] : '';
			$cond_operator = isset( $c['operator'] ) ? $c['operator'] : 'matches_any_of';
			$cond_value    = isset( $c['value'] ) ? $c['value'] : '';

			if ( ! $this->condition_matches( $cond_type, $cond_operator, $cond_value, $date_str, $day_name, $type, $cart_total, $cart_items, $delivery_address, $days_ahead, $today_now ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Evaluate a single condition.
	 *
	 * @param DateTime $today_now Current time in WP timezone.
	 */
	private function condition_matches( $type, $operator, $value, $date_str, $day_name, $method_type, $cart_total, $cart_items, $delivery_address, $days_ahead, $today_now ) {
		switch ( $type ) {
			case 'days_of_week':
				$days = is_array( $value ) ? $value : ( is_string( $value ) ? array_map( 'trim', explode( ',', $value ) ) : array() );
				return $this->compare_value( $day_name, $operator, $days );

			case 'specific_dates':
				$dates = is_array( $value ) ? $value : ( is_string( $value ) ? array_map( 'trim', explode( ',', $value ) ) : array() );
				return $this->compare_value( $date_str, $operator, $dates );

			case 'method':
				$target = is_string( $value ) ? strtolower( trim( $value ) ) : '';
				if ( empty( $target ) ) {
					return false;
				}
				return ( $method_type === $target );

			default:
				if ( self::is_pro_condition_type( $type ) ) {
					if ( ! self::has_pro_features() ) {
						return true;
					}
					$result = apply_filters(
						'wpd_rules_evaluate_pro_condition',
						null,
						$this,
						$type,
						$operator,
						$value,
						$date_str,
						$day_name,
						$method_type,
						$cart_total,
						$cart_items,
						$delivery_address,
						$days_ahead,
						$today_now
					);
					return null !== $result ? (bool) $result : false;
				}
				return true;
		}
	}

	private function compare_value( $subject, $operator, $compare_list ) {
		$compare_list = array_map( 'trim', array_filter( (array) $compare_list ) );
		switch ( $operator ) {
			case 'matches_any_of':
				return in_array( trim( (string) $subject ), $compare_list, true );
			case 'equal':
				return in_array( trim( (string) $subject ), $compare_list, true );
			case 'not_equal':
				return ! in_array( trim( (string) $subject ), $compare_list, true );
			case 'contain':
				$subject_lower = strtolower( (string) $subject );
				foreach ( $compare_list as $v ) {
					if ( false !== strpos( $subject_lower, strtolower( (string) $v ) ) ) {
						return true;
					}
				}
				return false;
			case 'between':
				// Date range (Y-m-d); $compare_list must be two dates (specific_dates).
				if ( count( $compare_list ) < 2 ) {
					return false;
				}
				$d0  = (string) $compare_list[0];
				$d1  = (string) $compare_list[1];
				$sub = trim( (string) $subject );
				if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $d0 ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $d1 ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $sub ) ) {
					return false;
				}
				$low  = min( $d0, $d1 );
				$high = max( $d0, $d1 );
				return $sub >= $low && $sub <= $high;
			default:
				return in_array( trim( (string) $subject ), $compare_list, true );
		}
	}

	private function get_cart_total( $cart_items ) {
		$total = 0.0;
		foreach ( $cart_items as $item ) {
			$price  = isset( $item['price'] ) ? (float) $item['price'] : 0;
			$qty    = isset( $item['quantity'] ) ? max( 1, (int) $item['quantity'] ) : 1;
			$total += $price * $qty;
		}
		return $total;
	}

	private function get_rules() {
		if ( ! class_exists( 'WPD_Settings' ) ) {
			return array();
		}
		$rules = get_option( WPD_Settings::OPTION_RULES, array() );
		return is_array( $rules ) ? $rules : array();
	}
}
