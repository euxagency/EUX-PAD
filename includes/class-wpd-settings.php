<?php
/**
 * Settings / REST API for Pickup & Delivery.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPD_Settings {
	/**
	 * Single instance
	 *
	 * @var WPD_Settings|null
	 */
	private static $instance = null;

	/**
	 * Option name for global settings.
	 */
	const OPTION_GLOBAL = 'wpd_global_settings';

	/**
	 * Option name for pickup settings.
	 */
	const OPTION_PICKUP = 'wpd_pickup_settings';

	/**
	 * Option name for delivery settings (allowed suburbs for rules / PAD).
	 */
	const OPTION_DELIVERY = 'wpd_delivery_settings';

	/**
	 * Option name for delivery/pickup rules.
	 */
	const OPTION_RULES = 'wpd_rules';

	/**
	 * Get instance
	 *
	 * @return WPD_Settings
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor
	 */
	private function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register REST routes.
	 */
	public function register_routes() {
		register_rest_route(
			'wpd/v1',
			'/settings/global',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_global_settings' ),
					'permission_callback' => array( $this, 'can_manage' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'save_global_settings' ),
					'permission_callback' => array( $this, 'can_manage' ),
				),
			)
		);

		register_rest_route(
			'wpd/v1',
			'/settings/global/reset',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'reset_global_settings' ),
				'permission_callback' => array( $this, 'can_manage' ),
			)
		);

		register_rest_route(
			'wpd/v1',
			'/pages/pad',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_pad_pages' ),
				'permission_callback' => array( $this, 'can_manage' ),
			)
		);

		register_rest_route(
			'wpd/v1',
			'/pad-page',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_pad_page_status' ),
				'permission_callback' => array( $this, 'can_manage' ),
			)
		);

		register_rest_route(
			'wpd/v1',
			'/pad-page/ensure',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'ensure_pad_page' ),
				'permission_callback' => array( $this, 'can_manage' ),
			)
		);

		register_rest_route(
			'wpd/v1',
			'/settings/pickup',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_pickup_settings' ),
					'permission_callback' => array( $this, 'can_manage' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'save_pickup_settings' ),
					'permission_callback' => array( $this, 'can_manage' ),
				),
			)
		);

		register_rest_route(
			'wpd/v1',
			'/settings/pickup/reset',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'reset_pickup_settings' ),
				'permission_callback' => array( $this, 'can_manage' ),
			)
		);

		register_rest_route(
			'wpd/v1',
			'/settings/delivery',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_delivery_settings' ),
					'permission_callback' => array( $this, 'can_manage' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'save_delivery_settings' ),
					'permission_callback' => array( $this, 'can_manage' ),
				),
			)
		);

		register_rest_route(
			'wpd/v1',
			'/settings/delivery/reset',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'reset_delivery_settings' ),
				'permission_callback' => array( $this, 'can_manage' ),
			)
		);

		register_rest_route(
			'wpd/v1',
			'/settings/rules',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_rules' ),
					'permission_callback' => array( $this, 'can_manage' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'save_rules' ),
					'permission_callback' => array( $this, 'can_manage' ),
				),
			)
		);
	}

	/**
	 * Permission callback.
	 *
	 * @return bool
	 */
	public function can_manage() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Whether the cart/checkout step indicator (PAD progress bar) is enabled.
	 *
	 * @return bool
	 */
	public function is_checkout_progress_bar_enabled() {
		$defaults = $this->get_global_defaults();
		$saved    = get_option( self::OPTION_GLOBAL, array() );
		if ( ! is_array( $saved ) || ! array_key_exists( 'show_checkout_progress_bar', $saved ) ) {
			return (bool) $defaults['show_checkout_progress_bar'];
		}
		return (bool) $saved['show_checkout_progress_bar'];
	}

	/**
	 * Defaults for global settings.
	 *
	 * @return array
	 */
	public function get_global_defaults() {
		return array(
			'pad_page_id'                => 0,
			/** Show Shopping cart → Pickup & Delivery → Checkout → Order complete on cart, PAD, checkout, thank-you. */
			'show_checkout_progress_bar' => true,
			/** Countdown on PAD delivery/pickup date step; interval in seconds (WooCommerce date refresh). */
			'show_date_refresh_timer'    => true,
			'date_refresh_timer_seconds' => 300,
			'tabs'                       => array(
				'enable_delivery' => true,
				'enable_pickup'   => true,
			),
			'labels'                     => array(
				'delivery_title'       => 'Delivery',
				'pickup_title'         => 'Pickup',
				'continue_button_text' => 'Continue',
			),
			'icons'                      => array(
				'pickup_icon_id'    => 0,
				'pickup_icon_url'   => '',
				'delivery_icon_id'  => 0,
				'delivery_icon_url' => '',
			),
			'colors'                     => array(
				// "WooCommerce standard" feel (WP admin blues + neutral grays).
				'tab_hover_bg'                => '#F6F7F7',
				'tab_selected_bg'             => '#FFFFFF',
				'tab_selected_text'           => '#2271B1',
				'tab_text'                    => '#1D2327',
				'day_name'                    => '#6B7280',
				'day_number'                  => '#1D2327',
				'day_name_selected'           => '#FFFFFF',
				'day_number_selected'         => '#FFFFFF',
				'day_selector_bg'             => '#FFFFFF',
				'day_selector_bg_selected'    => '#2271B1',
				'time_selector_bg'            => '#FFFFFF',
				'time_selector_text'          => '#1D2327',
				'time_selector_bg_selected'   => '#2271B1',
				'time_selector_text_selected' => '#FFFFFF',
				'continue_button_bg'          => '#2271B1',
				'continue_button_text'        => '#FFFFFF',
				'continue_button_bg_hover'    => '#135E96',
				'continue_button_text_hover'  => '#FFFFFF',
			),
			'days_displayed'             => 15,
		);
	}

	/**
	 * Global option merged with defaults (used for admin fallbacks and PAD overlay base).
	 *
	 * @return array
	 */
	private function get_global_config_merged() {
		$saved = get_option( self::OPTION_GLOBAL, array() );
		return $this->merge_settings( $this->get_global_defaults(), is_array( $saved ) ? $saved : array() );
	}

	/**
	 * Remove keys that are edited on Delivery / Pickup settings pages from Global Settings REST responses.
	 *
	 * @param array $data Merged global settings.
	 * @return array
	 */
	private function strip_tab_fields_from_global_admin_payload( $data ) {
		if ( ! is_array( $data ) ) {
			return $data;
		}
		if ( isset( $data['tabs'] ) && is_array( $data['tabs'] ) ) {
			unset( $data['tabs']['enable_delivery'], $data['tabs']['enable_pickup'] );
		}
		if ( isset( $data['labels'] ) && is_array( $data['labels'] ) ) {
			unset( $data['labels']['delivery_title'], $data['labels']['pickup_title'] );
		}
		return $data;
	}

	/**
	 * Global settings as used on the PAD frontend (delivery/pickup tab options override legacy global when set).
	 *
	 * @return array
	 */
	public function get_effective_global_for_pad() {
		return $this->apply_delivery_pickup_tab_overlays( $this->get_global_config_merged() );
	}

	/**
	 * Apply saved delivery/pickup tab fields onto merged global config.
	 *
	 * @param array $merged Merged global.
	 * @return array
	 */
	private function apply_delivery_pickup_tab_overlays( array $merged ) {
		$d_saved = get_option( self::OPTION_DELIVERY, array() );
		$p_saved = get_option( self::OPTION_PICKUP, array() );
		$d_saved = is_array( $d_saved ) ? $d_saved : array();
		$p_saved = is_array( $p_saved ) ? $p_saved : array();
		$d       = $this->merge_delivery_settings( $this->get_delivery_defaults(), $d_saved );
		$p       = $this->merge_pickup_settings( $this->get_pickup_defaults(), $p_saved );

		if ( array_key_exists( 'tab_enabled', $d_saved ) ) {
			$merged['tabs']['enable_delivery'] = (bool) $d['tab_enabled'];
		}
		if ( array_key_exists( 'tab_title', $d_saved ) ) {
			$merged['labels']['delivery_title'] = (string) $d['tab_title'];
		}
		if ( array_key_exists( 'tab_enabled', $p_saved ) ) {
			$merged['tabs']['enable_pickup'] = (bool) $p['tab_enabled'];
		}
		if ( array_key_exists( 'tab_title', $p_saved ) ) {
			$merged['labels']['pickup_title'] = (string) $p['tab_title'];
		}
		return $merged;
	}

	/**
	 * Whether the PAD step should appear (at least one of delivery or pickup tab is enabled).
	 *
	 * @return bool
	 */
	public function is_pad_step_enabled() {
		$g  = $this->get_effective_global_for_pad();
		$ed = isset( $g['tabs']['enable_delivery'] ) ? (bool) $g['tabs']['enable_delivery'] : true;
		$ep = isset( $g['tabs']['enable_pickup'] ) ? (bool) $g['tabs']['enable_pickup'] : true;
		return $ed || $ep;
	}

	/**
	 * Defaults for pickup settings.
	 *
	 * @return array
	 */
	public function get_pickup_defaults() {
		return array(
			'street_number' => '155',
			'street_name'   => 'George St',
			'city'          => 'SYDNEY',
			'state'         => 'NSW',
			'postcode'      => '2000',
			'country'       => 'AU',
			'address'       => "155 George St\nSYDNEY NSW 2000",
			'phone'         => '(02) 5550 4321',
			'interval'      => 60,
			'opening_hours' => array(
				array(
					'day'   => 'Monday',
					'start' => '07:00',
					'end'   => '17:00',
				),
				array(
					'day'   => 'Tuesday',
					'start' => '07:00',
					'end'   => '17:00',
				),
				array(
					'day'   => 'Wednesday',
					'start' => '07:00',
					'end'   => '17:00',
				),
				array(
					'day'   => 'Thursday',
					'start' => '07:00',
					'end'   => '17:00',
				),
				array(
					'day'   => 'Friday',
					'start' => '07:00',
					'end'   => '17:00',
				),
			),
			'tab_enabled'   => true,
			'tab_title'     => 'Pickup',
		);
	}

	/**
	 * Defaults for delivery settings.
	 *
	 * @return array
	 */
	public function get_delivery_defaults() {
		return array(
			'suburbs'     => array(),
			'tab_enabled' => true,
			'tab_title'   => 'Delivery',
		);
	}

	/**
	 * Merge saved delivery settings into defaults.
	 *
	 * @param array $defaults Defaults.
	 * @param array $saved    Saved.
	 * @return array
	 */
	public function merge_delivery_settings( $defaults, $saved ) {
		$out = $defaults;
		if ( isset( $saved['suburbs'] ) && is_array( $saved['suburbs'] ) ) {
			$out['suburbs'] = $this->normalize_suburbs_list( $saved['suburbs'] );
		}
		if ( is_array( $saved ) && array_key_exists( 'tab_enabled', $saved ) ) {
			$out['tab_enabled'] = (bool) $saved['tab_enabled'];
		}
		if ( is_array( $saved ) && array_key_exists( 'tab_title', $saved ) ) {
			$out['tab_title'] = sanitize_text_field( wp_unslash( (string) $saved['tab_title'] ) );
		}
		return $out;
	}

	/**
	 * Get delivery settings (merged with defaults).
	 *
	 * @return WP_REST_Response
	 */
	public function get_delivery_settings() {
		$saved    = get_option( self::OPTION_DELIVERY, array() );
		$saved    = is_array( $saved ) ? $saved : array();
		$defaults = $this->get_delivery_defaults();
		$data     = $this->merge_delivery_settings( $defaults, $saved );
		$global   = $this->get_global_config_merged();
		if ( ! array_key_exists( 'tab_enabled', $saved ) ) {
			$data['tab_enabled'] = isset( $global['tabs']['enable_delivery'] ) ? (bool) $global['tabs']['enable_delivery'] : true;
		}
		if ( ! array_key_exists( 'tab_title', $saved ) ) {
			$data['tab_title'] = isset( $global['labels']['delivery_title'] ) ? (string) $global['labels']['delivery_title'] : $defaults['tab_title'];
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $data,
			)
		);
	}

	/**
	 * Save delivery settings.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function save_delivery_settings( $request ) {
		$params   = $request->get_json_params();
		$params   = is_array( $params ) ? $params : array();
		$defaults = $this->get_delivery_defaults();
		$clean    = $this->sanitize_delivery_settings( $params, $defaults );

		update_option( self::OPTION_DELIVERY, $clean, false );

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $clean,
			)
		);
	}

	/**
	 * Reset delivery settings to defaults.
	 *
	 * @return WP_REST_Response
	 */
	public function reset_delivery_settings() {
		$defaults = $this->get_delivery_defaults();
		update_option( self::OPTION_DELIVERY, $defaults, false );
		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $defaults,
			)
		);
	}

	/**
	 * Get global settings (merged with defaults).
	 *
	 * @return WP_REST_Response
	 */
	public function get_global_settings() {
		$data = $this->strip_tab_fields_from_global_admin_payload( $this->get_global_config_merged() );

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $data,
			)
		);
	}

	/**
	 * Save global settings.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function save_global_settings( $request ) {
		$params   = $request->get_json_params();
		$params   = is_array( $params ) ? $params : array();
		$defaults = $this->get_global_defaults();
		$clean    = $this->sanitize_global_settings( $params, $defaults );

		update_option( self::OPTION_GLOBAL, $clean, false );
		$g_after       = get_option( self::OPTION_GLOBAL, array() );
		$response_data = $this->strip_tab_fields_from_global_admin_payload(
			$this->merge_settings( $defaults, is_array( $g_after ) ? $g_after : array() )
		);
		// Also update the PAD page option used by the frontend/router.
		if ( isset( $clean['pad_page_id'] ) ) {
			update_option( 'wpd_pad_page_id', absint( $clean['pad_page_id'] ), false );
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $response_data,
			)
		);
	}

	/**
	 * Reset only global color settings to defaults (tabs, labels, icons, PAD page, etc. unchanged).
	 *
	 * @return WP_REST_Response
	 */
	public function reset_global_settings() {
		$defaults = $this->get_global_defaults();
		$saved    = get_option( self::OPTION_GLOBAL, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		$saved['colors'] = $defaults['colors'];
		update_option( self::OPTION_GLOBAL, $saved, false );

		$data = $this->strip_tab_fields_from_global_admin_payload( $this->merge_settings( $defaults, $saved ) );
		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $data,
			)
		);
	}

	/**
	 * Get pickup settings (merged with defaults).
	 *
	 * @return WP_REST_Response
	 */
	public function get_pickup_settings() {
		$saved    = get_option( self::OPTION_PICKUP, array() );
		$saved    = is_array( $saved ) ? $saved : array();
		$defaults = $this->get_pickup_defaults();
		$data     = $this->merge_pickup_settings( $defaults, $saved );
		$global   = $this->get_global_config_merged();
		if ( ! array_key_exists( 'tab_enabled', $saved ) ) {
			$data['tab_enabled'] = isset( $global['tabs']['enable_pickup'] ) ? (bool) $global['tabs']['enable_pickup'] : true;
		}
		if ( ! array_key_exists( 'tab_title', $saved ) ) {
			$data['tab_title'] = isset( $global['labels']['pickup_title'] ) ? (string) $global['labels']['pickup_title'] : $defaults['tab_title'];
		}

		$data            = $this->apply_inactive_multi_store_pickup_fallback( $data );
		$data['address'] = $this->format_pickup_location_multiline( $data );

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $data,
			)
		);
	}

	/**
	 * When Multi-Store is off but its option still exists, surface the first enabled store on GET so
	 * Pickup Settings shows an address (deactivation sync or legacy installs).
	 *
	 * @param array $data Merged pickup settings.
	 * @return array
	 */
	public function apply_inactive_multi_store_pickup_fallback( array $data ) {
		if ( class_exists( 'WPD_Multi_Store' ) ) {
			return $data;
		}
		if ( '' !== trim( (string) ( $data['address'] ?? '' ) ) ) {
			return $data;
		}
		// Option name matches WPD_Multi_Store::OPTION in the Multi-Store add-on.
		$raw = get_option( 'wpd_multi_pickup_stores', array() );
		if ( ! is_array( $raw ) || empty( $raw ) ) {
			return $data;
		}
		foreach ( $raw as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$enabled = ! array_key_exists( 'enabled', $row ) || ! empty( $row['enabled'] );
			if ( ! $enabled ) {
				continue;
			}
			$addr = $this->format_pickup_location_multiline( $row );
			if ( '' === $addr ) {
				continue;
			}
			$data['address'] = $addr;
			if ( ( ! isset( $data['phone'] ) || '' === trim( (string) $data['phone'] ) ) && ! empty( $row['phone'] ) ) {
				$data['phone'] = sanitize_text_field( (string) $row['phone'] );
			}
			if ( ! empty( $row['opening_hours'] ) && is_array( $row['opening_hours'] ) ) {
				$oh = array();
				foreach ( $row['opening_hours'] as $slot ) {
					if ( ! is_array( $slot ) ) {
						continue;
					}
					$d = isset( $slot['day'] ) ? sanitize_text_field( (string) $slot['day'] ) : '';
					$s = isset( $slot['start'] ) ? sanitize_text_field( (string) $slot['start'] ) : '';
					$e = isset( $slot['end'] ) ? sanitize_text_field( (string) $slot['end'] ) : '';
					if ( '' !== $d && '' !== $s && '' !== $e ) {
						$oh[] = array(
							'day'   => $d,
							'start' => $s,
							'end'   => $e,
						);
					}
					if ( count( $oh ) >= 7 ) {
						break;
					}
				}
				if ( ! empty( $oh ) ) {
					$data['opening_hours'] = $oh;
				}
			}
			if ( isset( $row['interval'] ) ) {
				$data['interval'] = max( 5, min( 360, absint( $row['interval'] ) ) );
			}
			break;
		}
		if ( '' !== trim( (string) ( $data['address'] ?? '' ) ) ) {
			return $data;
		}
		foreach ( $raw as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$addr = $this->format_pickup_location_multiline( $row );
			if ( '' === $addr ) {
				continue;
			}
			$data['address'] = $addr;
			if ( ( ! isset( $data['phone'] ) || '' === trim( (string) $data['phone'] ) ) && ! empty( $row['phone'] ) ) {
				$data['phone'] = sanitize_text_field( (string) $row['phone'] );
			}
			break;
		}

		return $data;
	}

	/**
	 * Multiline pickup address from structured fields, else legacy `address` textarea (single-store or store row).
	 *
	 * @param array $pickup Pickup settings or store row.
	 * @return string
	 */
	public function format_pickup_location_multiline( array $pickup ) {
		$sn    = trim( (string) ( $pickup['street_number'] ?? '' ) );
		$st    = trim( (string) ( $pickup['street_name'] ?? '' ) );
		$city  = trim( (string) ( $pickup['city'] ?? '' ) );
		$state = trim( (string) ( $pickup['state'] ?? '' ) );
		$pc    = trim( (string) ( $pickup['postcode'] ?? '' ) );
		$cc    = strtoupper( sanitize_text_field( (string) ( $pickup['country'] ?? '' ) ) );
		if ( 2 !== strlen( $cc ) || ! preg_match( '/^[A-Z]{2}$/', $cc ) ) {
			$cc = '';
		}
		$line1 = trim( $sn . ' ' . $st );
		$lines = array();
		if ( '' !== $line1 ) {
			$lines[] = $line1;
		}
		if ( '' !== $city ) {
			$lines[] = $city;
		}
		$tail = array_filter( array( $state, $pc, $cc ) );
		if ( ! empty( $tail ) ) {
			$lines[] = implode( ' ', $tail );
		}
		$out = implode( "\n", array_filter( $lines ) );
		if ( '' !== $out ) {
			return $out;
		}
		$legacy = isset( $pickup['address'] ) ? trim( (string) $pickup['address'] ) : '';
		return $legacy;
	}

	/**
	 * Map merged pickup settings (same shape as a multi-store row) to WooCommerce shipping field keys.
	 *
	 * @param array<string, mixed> $pickup Merged pickup option row.
	 * @return array{street_address:string,suburb:string,state:string,postcode:string,country:string}
	 */
	public function pickup_location_to_checkout_address( array $pickup ) {
		$sn    = trim( (string) ( $pickup['street_number'] ?? '' ) );
		$st    = trim( (string) ( $pickup['street_name'] ?? '' ) );
		$city  = trim( (string) ( $pickup['city'] ?? '' ) );
		$state = trim( (string) ( $pickup['state'] ?? '' ) );
		$pc    = trim( (string) ( $pickup['postcode'] ?? '' ) );
		$cc    = strtoupper( sanitize_text_field( (string) ( $pickup['country'] ?? '' ) ) );
		if ( 2 !== strlen( $cc ) || ! preg_match( '/^[A-Z]{2}$/', $cc ) ) {
			$cc = 'AU';
		}
		$line1 = trim( $sn . ' ' . $st );
		if ( '' === $line1 && ! empty( $pickup['address'] ) ) {
			$raw_lines = preg_split( '/\r\n|\r|\n/', trim( (string) $pickup['address'] ) );
			$line1     = isset( $raw_lines[0] ) ? trim( (string) $raw_lines[0] ) : '';
			if ( '' === $city && isset( $raw_lines[1] ) ) {
				$city = trim( (string) $raw_lines[1] );
			}
		}
		return array(
			'street_address' => $line1,
			'suburb'         => $city,
			'state'          => $state,
			'postcode'       => $pc,
			'country'        => $cc,
		);
	}

	/**
	 * Save pickup settings.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function save_pickup_settings( $request ) {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$body = $request->get_body();
			if ( is_string( $body ) && '' !== $body ) {
				$decoded = json_decode( $body, true );
				$params  = is_array( $decoded ) ? $decoded : array();
			} else {
				$params = array();
			}
		}
		$defaults = $this->get_pickup_defaults();
		$saved    = get_option( self::OPTION_PICKUP, array() );
		$saved    = is_array( $saved ) ? $saved : array();
		$base     = $this->merge_pickup_settings( $defaults, $saved );
		$clean    = $this->sanitize_pickup_settings( $params, $base, $defaults );

		update_option( self::OPTION_PICKUP, $clean, false );

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $clean,
			)
		);
	}

	/**
	 * Reset pickup settings to defaults.
	 *
	 * @return WP_REST_Response
	 */
	public function reset_pickup_settings() {
		$defaults = $this->get_pickup_defaults();
		update_option( self::OPTION_PICKUP, $defaults, false );
		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $defaults,
			)
		);
	}

	/**
	 * Get delivery/pickup rules.
	 *
	 * @return WP_REST_Response
	 */
	public function get_rules() {
		$rules = get_option( self::OPTION_RULES, array() );
		$rules = is_array( $rules ) ? $rules : array();
		if ( class_exists( 'WPD_Rules' ) && ! WPD_Rules::has_pro_features() ) {
			$rules = $this->strip_pro_conditions_from_rules( $rules );
		}
		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $rules,
			)
		);
	}

	/**
	 * Remove Pro-only conditions from each rule (free plugin REST responses).
	 *
	 * @param array $rules Rules list.
	 * @return array
	 */
	private function strip_pro_conditions_from_rules( $rules ) {
		if ( ! class_exists( 'WPD_Rules' ) ) {
			return $rules;
		}
		$pro_types = WPD_Rules::get_pro_condition_types();
		$out       = array();
		foreach ( $rules as $rule ) {
			if ( ! is_array( $rule ) ) {
				continue;
			}
			$conds = isset( $rule['conditions'] ) && is_array( $rule['conditions'] ) ? $rule['conditions'] : array();
			$keep  = array();
			foreach ( $conds as $c ) {
				if ( ! is_array( $c ) ) {
					continue;
				}
				$t = isset( $c['type'] ) ? (string) $c['type'] : '';
				if ( in_array( $t, $pro_types, true ) ) {
					continue;
				}
				$keep[] = $c;
			}
			$rule['conditions'] = $keep;
			$out[]              = $rule;
		}
		return $out;
	}

	/**
	 * Save delivery/pickup rules.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function save_rules( $request ) {
		$params = $request->get_json_params();
		$rules  = isset( $params['rules'] ) && is_array( $params['rules'] ) ? $params['rules'] : array();
		$clean  = $this->sanitize_rules( $rules );

		$validation = $this->validate_rules_primary_conditions( $clean );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		$validation = $this->validate_rules_lead_cutoff_objective( $clean );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		update_option( self::OPTION_RULES, $clean, false );
		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $clean,
			)
		);
	}

	/**
	 * Each enabled rule must include (1) Days of Week or Specific Dates and (2) Method.
	 *
	 * @param array $rules Sanitized rules.
	 * @return true|WP_Error
	 */
	private function validate_rules_primary_conditions( $rules ) {
		$date_scope_types = array( 'days_of_week', 'specific_dates' );
		foreach ( $rules as $rule ) {
			if ( empty( $rule['enabled'] ) ) {
				continue;
			}
			$conditions     = isset( $rule['conditions'] ) && is_array( $rule['conditions'] ) ? $rule['conditions'] : array();
			$has_date_scope = false;
			$has_method     = false;
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
				return new WP_Error(
					'wpd_rules_primary_required',
					__( 'Every enabled rule must include at least one Days of Week or Specific Dates condition and one Method condition.', 'eux-pad' ),
					array( 'status' => 400 )
				);
			}
		}
		return true;
	}

	/**
	 * Lead time and cutoff conditions require Disable Day objective.
	 *
	 * @param array $rules Sanitized rules.
	 * @return true|WP_Error
	 */
	private function validate_rules_lead_cutoff_objective( $rules ) {
		if ( ! class_exists( 'WPD_Rules' ) || ! WPD_Rules::has_pro_features() ) {
			return true;
		}
		foreach ( $rules as $rule ) {
			if ( empty( $rule['enabled'] ) ) {
				continue;
			}
			$conditions = isset( $rule['conditions'] ) && is_array( $rule['conditions'] ) ? $rule['conditions'] : array();
			$has        = false;
			foreach ( $conditions as $c ) {
				$t = isset( $c['type'] ) ? $c['type'] : '';
				if ( 'lead_time' === $t || 'cutoff_time' === $t ) {
					$has = true;
					break;
				}
			}
			if ( $has && isset( $rule['objective'] ) && 'disable_day' !== $rule['objective'] ) {
				return new WP_Error(
					'wpd_rules_lead_cutoff_objective',
					__( 'Rules that include Lead Time or Cutoff Time must use the Disable Day objective.', 'eux-pad' ),
					array( 'status' => 400 )
				);
			}
		}
		return true;
	}

	/**
	 * Sanitize rules payload.
	 *
	 * @param array $rules Raw rules.
	 * @return array
	 */
	private function sanitize_rules( $rules ) {
		$out = array();
		$i   = 0;
		foreach ( $rules as $rule ) {
			if ( ! is_array( $rule ) ) {
				continue;
			}
			$r = array(
				'id'         => isset( $rule['id'] ) ? sanitize_text_field( (string) $rule['id'] ) : (string) wp_generate_uuid4(),
				'name'       => isset( $rule['name'] ) ? sanitize_text_field( wp_unslash( $rule['name'] ) ) : '',
				'enabled'    => isset( $rule['enabled'] ) ? (bool) $rule['enabled'] : true,
				'order'      => (int) $i,
				'objective'  => isset( $rule['objective'] ) && in_array( $rule['objective'], array( 'enable_day', 'disable_day' ), true ) ? $rule['objective'] : 'disable_day',
				'conditions' => array(),
			);
			if ( isset( $rule['conditions'] ) && is_array( $rule['conditions'] ) ) {
				foreach ( $rule['conditions'] as $c ) {
					if ( ! is_array( $c ) || empty( $c['type'] ) ) {
						continue;
					}
					$ctype = sanitize_text_field( wp_unslash( $c['type'] ) );
					if ( class_exists( 'WPD_Rules' ) && ! WPD_Rules::has_pro_features() && WPD_Rules::is_pro_condition_type( $ctype ) ) {
						continue;
					}
					$cop = isset( $c['operator'] ) ? sanitize_text_field( wp_unslash( $c['operator'] ) ) : 'matches_any_of';
					if ( 'suburb' === $ctype && ! in_array( $cop, array( 'equal', 'not_equal' ), true ) ) {
						$cop = 'equal';
					}
					$clean_val         = $this->sanitize_condition_value( isset( $c['value'] ) ? $c['value'] : '', $ctype, $cop );
					$r['conditions'][] = array(
						'type'     => $ctype,
						'operator' => $cop,
						'value'    => $clean_val,
					);
				}
			}
			$out[] = $r;
			++$i;
		}
		return $out;
	}

	/**
	 * Sanitize condition value based on type.
	 *
	 * @param mixed  $value    Raw value.
	 * @param string $type     Condition type.
	 * @param string $operator Operator (e.g. between).
	 * @return mixed Sanitized value.
	 */
	private function sanitize_condition_value( $value, $type, $operator ) {
		if ( is_array( $value ) ) {
			if ( 'between' === $operator && count( $value ) >= 2 ) {
				if ( 'specific_dates' === $type ) {
					$a = sanitize_text_field( wp_unslash( (string) ( isset( $value[0] ) ? $value[0] : '' ) ) );
					$b = sanitize_text_field( wp_unslash( (string) ( isset( $value[1] ) ? $value[1] : '' ) ) );
					if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $a ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $b ) ) {
						return array( $a, $b );
					}
					return array( '', '' );
				}
				return array(
					(float) ( isset( $value[0] ) ? $value[0] : 0 ),
					(float) ( isset( $value[1] ) ? $value[1] : 0 ),
				);
			}
			$out = array();
			foreach ( $value as $v ) {
				$out[] = sanitize_text_field( wp_unslash( (string) $v ) );
			}
			return $out;
		}
		if ( in_array( $type, array( 'order_value', 'total_orders', 'lead_time' ), true ) ) {
			return is_numeric( $value ) ? (float) $value : (float) preg_replace( '/[^0-9.-]/', '', (string) $value );
		}
		if ( 'cutoff_time' === $type ) {
			$v = sanitize_text_field( wp_unslash( (string) $value ) );
			return preg_match( '/^\d{1,2}:\d{2}$/', $v ) ? $v : '';
		}
		if ( 'suburb' === $type ) {
			return $this->sanitize_suburb_condition_value( $value );
		}
		return sanitize_text_field( wp_unslash( (string) $value ) );
	}

	/**
	 * Shortcode token used on the PAD page.
	 */
	const PAD_SHORTCODE_TOKEN = 'wpd_pickup_delivery';

	/**
	 * Find a published page whose content includes the PAD shortcode.
	 *
	 * @return int Post ID or 0.
	 */
	private function find_page_with_pad_shortcode() {
		$pages = get_posts(
			array(
				'post_type'      => 'page',
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'orderby'        => 'ID',
				'order'          => 'ASC',
				'fields'         => 'ids',
			)
		);
		$token = self::PAD_SHORTCODE_TOKEN;
		foreach ( $pages as $page_id ) {
			$content = (string) get_post_field( 'post_content', $page_id, 'raw' );
			if ( false !== strpos( $content, $token ) ) {
				return (int) $page_id;
			}
		}
		return 0;
	}

	/**
	 * Store PAD page ID in standalone option and global settings blob.
	 *
	 * @param int $page_id Page ID.
	 */
	private function sync_pad_page_to_options( $page_id ) {
		$page_id = absint( $page_id );
		if ( $page_id <= 0 ) {
			return;
		}
		update_option( 'wpd_pad_page_id', $page_id, false );
		$saved = get_option( self::OPTION_GLOBAL, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		$saved['pad_page_id'] = $page_id;
		update_option( self::OPTION_GLOBAL, $saved, false );
	}

	/**
	 * GET: PAD page status (shortcode page exists or not).
	 *
	 * @return WP_REST_Response
	 */
	public function get_pad_page_status() {
		$page_id = $this->find_page_with_pad_shortcode();
		$data    = array(
			'has_pad_page' => $page_id > 0,
			'page_id'      => $page_id,
			'title'        => '',
			'slug'         => '',
			'url'          => '',
		);
		if ( $page_id > 0 ) {
			$data['title'] = get_the_title( $page_id );
			$data['slug']  = get_post_field( 'post_name', $page_id );
			$data['url']   = get_permalink( $page_id );
		}
		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $data,
			)
		);
	}

	/**
	 * POST: If a page with the shortcode exists, sync options; else create /pad page.
	 *
	 * @return WP_REST_Response
	 */
	public function ensure_pad_page() {
		$existing_id = $this->find_page_with_pad_shortcode();
		if ( $existing_id > 0 ) {
			$this->sync_pad_page_to_options( $existing_id );
			return rest_ensure_response(
				array(
					'success' => true,
					'status'  => 'exists',
					'message' => __( 'A page with the PAD shortcode already exists.', 'eux-pad' ),
					'data'    => array(
						'pad_page_id' => $existing_id,
						'title'       => get_the_title( $existing_id ),
						'slug'        => get_post_field( 'post_name', $existing_id ),
						'url'         => get_permalink( $existing_id ),
					),
				)
			);
		}

		$page_id = wp_insert_post(
			array(
				'post_title'     => 'PAD',
				'post_name'      => 'pad',
				'post_content'   => '[wpd_pickup_delivery]',
				'post_status'    => 'publish',
				'post_type'      => 'page',
				'post_author'    => get_current_user_id(),
				'comment_status' => 'closed',
				'ping_status'    => 'closed',
			),
			true
		);

		if ( is_wp_error( $page_id ) ) {
			return new WP_Error(
				'wpd_pad_create_failed',
				$page_id->get_error_message(),
				array( 'status' => 500 )
			);
		}

		if ( ! $page_id ) {
			return new WP_Error(
				'wpd_pad_create_failed',
				__( 'Could not create the PAD page.', 'eux-pad' ),
				array( 'status' => 500 )
			);
		}

		$this->sync_pad_page_to_options( (int) $page_id );
		flush_rewrite_rules( false );

		return rest_ensure_response(
			array(
				'success' => true,
				'status'  => 'created',
				'message' => __( 'PAD page created.', 'eux-pad' ),
				'data'    => array(
					'pad_page_id' => (int) $page_id,
					'title'       => get_the_title( $page_id ),
					'slug'        => get_post_field( 'post_name', $page_id ),
					'url'         => get_permalink( $page_id ),
				),
			)
		);
	}

	/**
	 * List candidate PAD pages (all published pages excluding WooCommerce core pages).
	 *
	 * @return WP_REST_Response
	 */
	public function get_pad_pages() {
		$exclude_ids = array();
		if ( function_exists( 'wc_get_page_id' ) ) {
			foreach ( array( 'shop', 'cart', 'checkout', 'myaccount', 'terms' ) as $key ) {
				$id = (int) wc_get_page_id( $key );
				if ( $id > 0 ) {
					$exclude_ids[] = $id;
				}
			}
		}
		$exclude_ids = array_values( array_unique( $exclude_ids ) );

		$posts = get_posts(
			array(
				'post_type'        => 'page',
				'post_status'      => 'publish',
				'numberposts'      => -1,
				'orderby'          => 'title',
				'order'            => 'ASC',
				'exclude'          => $exclude_ids,
				'suppress_filters' => false,
			)
		);

		$items = array();
		foreach ( $posts as $p ) {
			$items[] = array(
				'id'    => (int) $p->ID,
				'title' => get_the_title( $p->ID ),
			);
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $items,
			)
		);
	}

	/**
	 * Merge saved settings into defaults, shallow per-section.
	 *
	 * @param array $defaults Defaults.
	 * @param array $saved Saved.
	 * @return array
	 */
	private function merge_settings( $defaults, $saved ) {
		$out = $defaults;

		if ( isset( $saved['pad_page_id'] ) ) {
			$out['pad_page_id'] = (int) $saved['pad_page_id'];
		}
		if ( is_array( $saved ) && array_key_exists( 'show_checkout_progress_bar', $saved ) ) {
			$out['show_checkout_progress_bar'] = (bool) $saved['show_checkout_progress_bar'];
		}
		if ( is_array( $saved ) && array_key_exists( 'show_date_refresh_timer', $saved ) ) {
			$out['show_date_refresh_timer'] = (bool) $saved['show_date_refresh_timer'];
		}
		if ( isset( $saved['date_refresh_timer_seconds'] ) ) {
			$out['date_refresh_timer_seconds'] = max( 15, min( 3600, absint( $saved['date_refresh_timer_seconds'] ) ) );
		}
		if ( isset( $saved['tabs'] ) && is_array( $saved['tabs'] ) ) {
			$out['tabs'] = array_merge( $out['tabs'], $saved['tabs'] );
		}
		if ( isset( $saved['days_displayed'] ) ) {
			$out['days_displayed'] = (int) $saved['days_displayed'];
		}
		if ( isset( $saved['labels'] ) && is_array( $saved['labels'] ) ) {
			$out['labels'] = array_merge( $out['labels'], $saved['labels'] );
		}
		if ( isset( $saved['icons'] ) && is_array( $saved['icons'] ) ) {
			$out['icons'] = array_merge( $out['icons'], $saved['icons'] );
		}
		if ( isset( $saved['colors'] ) && is_array( $saved['colors'] ) ) {
			$out['colors'] = array_merge( $out['colors'], $saved['colors'] );
		}

		return $out;
	}

	/**
	 * Merge saved pickup settings into defaults.
	 *
	 * @param array $defaults Defaults.
	 * @param array $saved Saved.
	 * @return array
	 */
	public function merge_pickup_settings( $defaults, $saved ) {
		$out = $defaults;

		if ( isset( $saved['address'] ) ) {
			$out['address'] = (string) $saved['address'];
		}
		foreach ( array( 'street_number', 'street_name', 'city', 'state', 'postcode', 'country' ) as $sk ) {
			if ( isset( $saved[ $sk ] ) ) {
				$out[ $sk ] = (string) $saved[ $sk ];
			}
		}
		if ( isset( $saved['phone'] ) ) {
			$out['phone'] = (string) $saved['phone'];
		}
		if ( isset( $saved['interval'] ) ) {
			$out['interval'] = max( 5, min( 360, absint( $saved['interval'] ) ) );
		}
		if ( isset( $saved['opening_hours'] ) && is_array( $saved['opening_hours'] ) ) {
			$out['opening_hours'] = array_values( array_slice( $saved['opening_hours'], 0, 7 ) );
		}
		if ( is_array( $saved ) && array_key_exists( 'tab_enabled', $saved ) ) {
			$out['tab_enabled'] = (bool) $saved['tab_enabled'];
		}
		if ( is_array( $saved ) && array_key_exists( 'tab_title', $saved ) ) {
			$out['tab_title'] = sanitize_text_field( wp_unslash( (string) $saved['tab_title'] ) );
		}

		if ( '' === trim( (string) ( $out['phone'] ?? '' ) ) ) {
			$out['phone'] = $defaults['phone'];
		}
		if ( '' === trim( $this->format_pickup_location_multiline( $out ) ) ) {
			foreach ( array( 'street_number', 'street_name', 'city', 'state', 'postcode', 'country', 'address' ) as $addr_key ) {
				if ( array_key_exists( $addr_key, $defaults ) ) {
					$out[ $addr_key ] = $defaults[ $addr_key ];
				}
			}
		}

		return $out;
	}

	/**
	 * Sanitize payload for global settings.
	 *
	 * @param array $params Input.
	 * @param array $defaults Defaults.
	 * @return array
	 */
	private function sanitize_global_settings( $params, $defaults ) {
		$saved = get_option( self::OPTION_GLOBAL, array() );
		$out   = $this->merge_settings( $defaults, is_array( $saved ) ? $saved : array() );

		$out['pad_page_id']                = isset( $params['pad_page_id'] ) ? absint( $params['pad_page_id'] ) : $out['pad_page_id'];
		$out['days_displayed']             = isset( $params['days_displayed'] ) ? max( 1, min( 60, absint( $params['days_displayed'] ) ) ) : $out['days_displayed'];
		$out['show_checkout_progress_bar'] = isset( $params['show_checkout_progress_bar'] ) ? (bool) $params['show_checkout_progress_bar'] : $out['show_checkout_progress_bar'];
		$out['show_date_refresh_timer']    = isset( $params['show_date_refresh_timer'] ) ? (bool) $params['show_date_refresh_timer'] : $out['show_date_refresh_timer'];
		$out['date_refresh_timer_seconds'] = isset( $params['date_refresh_timer_seconds'] )
			? max( 15, min( 3600, absint( $params['date_refresh_timer_seconds'] ) ) )
			: $out['date_refresh_timer_seconds'];

		// enable_delivery / enable_pickup and delivery/pickup titles are stored under Delivery / Pickup settings; keep legacy values in the global option unless migrated.

		if ( isset( $params['labels'] ) && is_array( $params['labels'] ) ) {
			foreach ( $out['labels'] as $k => $v ) {
				if ( 'delivery_title' === $k || 'pickup_title' === $k ) {
					continue;
				}
				if ( isset( $params['labels'][ $k ] ) ) {
					$out['labels'][ $k ] = sanitize_text_field( wp_unslash( $params['labels'][ $k ] ) );
				}
			}
		}

		if ( isset( $params['icons'] ) && is_array( $params['icons'] ) ) {
			if ( isset( $params['icons']['pickup_icon_id'] ) ) {
				$out['icons']['pickup_icon_id'] = absint( $params['icons']['pickup_icon_id'] );
			}
			if ( isset( $params['icons']['delivery_icon_id'] ) ) {
				$out['icons']['delivery_icon_id'] = absint( $params['icons']['delivery_icon_id'] );
			}
			if ( isset( $params['icons']['pickup_icon_url'] ) ) {
				$out['icons']['pickup_icon_url'] = esc_url_raw( wp_unslash( $params['icons']['pickup_icon_url'] ) );
			}
			if ( isset( $params['icons']['delivery_icon_url'] ) ) {
				$out['icons']['delivery_icon_url'] = esc_url_raw( wp_unslash( $params['icons']['delivery_icon_url'] ) );
			}
		}

		if ( isset( $params['colors'] ) && is_array( $params['colors'] ) ) {
			foreach ( $out['colors'] as $k => $v ) {
				if ( isset( $params['colors'][ $k ] ) ) {
					$color               = sanitize_text_field( wp_unslash( $params['colors'][ $k ] ) );
					$out['colors'][ $k ] = $this->sanitize_hex_color_loose( $color, $v );
				}
			}
		}

		return $out;
	}

	/**
	 * Normalize suburb names for storage (dedupe case-insensitively, cap count/length).
	 *
	 * @param array $arr Raw list.
	 * @return array
	 */
	private function normalize_suburbs_list( $arr ) {
		if ( ! is_array( $arr ) ) {
			return array();
		}
		$seen = array();
		$out  = array();
		foreach ( $arr as $s ) {
			$s = sanitize_text_field( wp_unslash( (string) $s ) );
			if ( '' === $s ) {
				continue;
			}
			if ( strlen( $s ) > 120 ) {
				$s = substr( $s, 0, 120 );
			}
			$k = strtolower( $s );
			if ( isset( $seen[ $k ] ) ) {
				continue;
			}
			$seen[ $k ] = true;
			$out[]      = $s;
			if ( count( $out ) >= 300 ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * Restrict rule suburb values to names configured in Delivery settings.
	 *
	 * @param mixed $value Raw condition value.
	 * @return array
	 */
	private function sanitize_suburb_condition_value( $value ) {
		$saved    = get_option( self::OPTION_DELIVERY, array() );
		$defaults = $this->get_delivery_defaults();
		$merged   = $this->merge_delivery_settings( $defaults, is_array( $saved ) ? $saved : array() );
		$allowed  = isset( $merged['suburbs'] ) && is_array( $merged['suburbs'] ) ? $merged['suburbs'] : array();
		$map      = array();
		foreach ( $allowed as $a ) {
			$map[ strtolower( (string) $a ) ] = $a;
		}
		$arr = is_array( $value ) ? $value : ( is_string( $value ) ? array_map( 'trim', explode( ',', $value ) ) : array() );
		$out = array();
		foreach ( $arr as $raw ) {
			$s = sanitize_text_field( wp_unslash( (string) $raw ) );
			$k = strtolower( $s );
			if ( isset( $map[ $k ] ) ) {
				$out[] = $map[ $k ];
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * Sanitize payload for delivery settings.
	 *
	 * @param array $params   Input.
	 * @param array $defaults Defaults.
	 * @return array
	 */
	private function sanitize_delivery_settings( $params, $defaults ) {
		$out = $defaults;
		if ( isset( $params['suburbs'] ) && is_array( $params['suburbs'] ) ) {
			$out['suburbs'] = $this->normalize_suburbs_list( $params['suburbs'] );
		}
		if ( array_key_exists( 'tab_enabled', $params ) ) {
			$out['tab_enabled'] = (bool) $params['tab_enabled'];
		}
		if ( isset( $params['tab_title'] ) ) {
			$out['tab_title'] = sanitize_text_field( wp_unslash( (string) $params['tab_title'] ) );
		}
		return $out;
	}

	/**
	 * Sanitize payload for pickup settings.
	 *
	 * Starts from merged saved settings (`$base`) so omitted keys are not reset to hardcoded defaults
	 * (important when Multi-Store UI only sends tab fields and stores are saved separately).
	 *
	 * @param array $params   Request body.
	 * @param array $base     Merged defaults + current DB (pickup option).
	 * @param array $defaults Plugin defaults (opening hours fallback).
	 * @return array
	 */
	private function sanitize_pickup_settings( $params, $base, $defaults ) {
		$out = $base;

		$multi_store = class_exists( 'WPD_Multi_Store' );

		// Multi-Store admin sends the same pickup payload as single-store; empty address/phone/hours
		// must not wipe DB values (those fields are edited per store, not on this screen).
		if ( array_key_exists( 'address', $params ) ) {
			$addr = sanitize_textarea_field( wp_unslash( (string) $params['address'] ) );
			if ( '' !== trim( $addr ) ) {
				$out['address'] = $addr;
			} elseif ( ! $multi_store ) {
				$out['address'] = $addr;
			}
		}
		if ( array_key_exists( 'phone', $params ) ) {
			$ph = sanitize_text_field( wp_unslash( (string) $params['phone'] ) );
			if ( '' !== trim( $ph ) ) {
				$out['phone'] = $ph;
			} elseif ( ! $multi_store ) {
				$out['phone'] = $ph;
			}
		}
		if ( isset( $params['interval'] ) ) {
			$out['interval'] = max( 5, min( 360, absint( $params['interval'] ) ) );
		}

		if ( isset( $params['opening_hours'] ) && is_array( $params['opening_hours'] ) ) {
			if ( $multi_store && empty( $params['opening_hours'] ) ) {
				// Keep saved global opening hours; empty array is React defaults, not "clear".
			} else {
				$out['opening_hours'] = array();
				$max_opening_rows     = 7;
				foreach ( $params['opening_hours'] as $row ) {
					if ( count( $out['opening_hours'] ) >= $max_opening_rows ) {
						break;
					}
					if ( empty( $row['day'] ) ) {
						continue;
					}
					$day   = sanitize_text_field( wp_unslash( $row['day'] ) );
					$start = isset( $row['start'] ) ? sanitize_text_field( wp_unslash( $row['start'] ) ) : '';
					$end   = isset( $row['end'] ) ? sanitize_text_field( wp_unslash( $row['end'] ) ) : '';

					if ( '' === $start || '' === $end ) {
						continue;
					}

					$out['opening_hours'][] = array(
						'day'   => $day,
						'start' => $start,
						'end'   => $end,
					);
				}
				if ( empty( $out['opening_hours'] ) ) {
					$out['opening_hours'] = $defaults['opening_hours'];
				}
			}
		}

		if ( array_key_exists( 'tab_enabled', $params ) ) {
			$out['tab_enabled'] = (bool) $params['tab_enabled'];
		}
		if ( isset( $params['tab_title'] ) ) {
			$out['tab_title'] = sanitize_text_field( wp_unslash( (string) $params['tab_title'] ) );
		}

		if ( ! $multi_store ) {
			$struct_keys = array( 'street_number', 'street_name', 'city', 'state', 'postcode' );
			foreach ( $struct_keys as $k ) {
				if ( array_key_exists( $k, $params ) ) {
					$out[ $k ] = sanitize_text_field( wp_unslash( (string) $params[ $k ] ) );
				}
			}
			if ( array_key_exists( 'country', $params ) ) {
				$c              = strtoupper( sanitize_text_field( wp_unslash( (string) $params['country'] ) ) );
				$out['country'] = ( 2 === strlen( $c ) && preg_match( '/^[A-Z]{2}$/', $c ) ) ? $c : 'AU';
			}
		}

		if ( empty( $out['opening_hours'] ) || ! is_array( $out['opening_hours'] ) ) {
			$out['opening_hours'] = $defaults['opening_hours'];
		}

		$out['address'] = $this->format_pickup_location_multiline( $out );

		return $out;
	}

	/**
	 * Sanitize hex color (accepts #RGB/#RRGGBB, falls back to default).
	 *
	 * @param string $color Input.
	 * @param string $fallback Fallback if invalid.
	 * @return string
	 */
	/**
	 * Sanitize a PAD color: #RGB, #RRGGBB, #RRGGBBAA, rgb(), or rgba().
	 *
	 * @param string $color    Raw value.
	 * @param string $fallback Default if invalid.
	 * @return string
	 */
	private function sanitize_hex_color_loose( $color, $fallback ) {
		$color = trim( (string) $color );
		if ( '' === $color ) {
			return $fallback;
		}

		// rgba( r, g, b, a ) — a is 0–1 (CSS).
		if ( preg_match( '/^rgba\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([\d.]+)\s*\)\s*$/i', $color, $m ) ) {
			$r = min( 255, max( 0, (int) $m[1] ) );
			$g = min( 255, max( 0, (int) $m[2] ) );
			$b = min( 255, max( 0, (int) $m[3] ) );
			$a = (float) $m[4];
			$a = min( 1, max( 0, $a ) );
			if ( $a >= 0.999 ) {
				return sprintf( '#%02x%02x%02x', $r, $g, $b );
			}
			$a_rounded = round( $a, 3 );
			return sprintf( 'rgba(%d, %d, %d, %s)', $r, $g, $b, $a_rounded );
		}

		// rgb( r, g, b ).
		if ( preg_match( '/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)\s*$/i', $color, $m ) ) {
			$r = min( 255, max( 0, (int) $m[1] ) );
			$g = min( 255, max( 0, (int) $m[2] ) );
			$b = min( 255, max( 0, (int) $m[3] ) );
			return sprintf( '#%02x%02x%02x', $r, $g, $b );
		}

		if ( 0 !== strpos( $color, '#' ) ) {
			$color = '#' . $color;
		}

		// #RRGGBBAA.
		if ( preg_match( '/^#([0-9a-fA-F]{8})$/', $color, $m ) ) {
			$hex = $m[1];
			$r   = hexdec( substr( $hex, 0, 2 ) );
			$g   = hexdec( substr( $hex, 2, 2 ) );
			$b   = hexdec( substr( $hex, 4, 2 ) );
			$a   = hexdec( substr( $hex, 6, 2 ) ) / 255;
			$a   = min( 1, max( 0, $a ) );
			if ( $a >= 0.999 ) {
				return sprintf( '#%02x%02x%02x', $r, $g, $b );
			}
			$a_rounded = round( $a, 3 );
			return sprintf( 'rgba(%d, %d, %d, %s)', $r, $g, $b, $a_rounded );
		}

		$san = sanitize_hex_color( $color );
		return $san ? $san : $fallback;
	}
}
