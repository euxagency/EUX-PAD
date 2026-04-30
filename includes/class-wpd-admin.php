<?php
/**
 * Admin Class
 * Registers admin menu pages for Pickup & Delivery.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPD_Admin {
	/**
	 * Single instance
	 *
	 * @var WPD_Admin|null
	 */
	private static $instance = null;

	/**
	 * Get instance
	 *
	 * @return WPD_Admin
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
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
	}

	/**
	 * Enqueue admin assets for WPD pages
	 *
	 * @param string $hook_suffix Current admin page hook.
	 */
	public function enqueue_assets( $hook_suffix ) {
		if ( ! is_admin() ) {
			return;
		}

		$page      = isset( $_GET['page'] ) ? sanitize_text_field( wp_unslash( $_GET['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Admin ?page= slug for asset loading only.
		$wpd_pages = apply_filters(
			'wpd_admin_enqueue_app_slugs',
			array( 'wpd-pickup-delivery', 'wpd-pickup-setting', 'wpd-delivery-setting', 'wpd-rules' )
		);
		if ( ! in_array( $page, (array) $wpd_pages, true ) ) {
			return;
		}

		$css_path = WPD_PLUGIN_DIR . 'assets/css/wpd-admin-app.css';
		if ( file_exists( $css_path ) ) {
			$css_ver = (string) filemtime( $css_path );
			wp_enqueue_style(
				'wpd-admin-app',
				WPD_PLUGIN_URL . 'assets/css/wpd-admin-app.css',
				array( 'wp-components' ),
				$css_ver
			);
		}

		$js_path = WPD_PLUGIN_DIR . 'assets/js/wpd-admin-app.js';
		$js_ver  = file_exists( $js_path ) ? (string) filemtime( $js_path ) : ( defined( 'WPD_VERSION' ) ? WPD_VERSION : time() );
		wp_enqueue_script(
			'wpd-admin-app',
			WPD_PLUGIN_URL . 'assets/js/wpd-admin-app.js',
			array( 'wp-element', 'wp-components', 'wp-i18n', 'wp-api-fetch' ),
			$js_ver,
			true
		);

		// Needed for wp.media (icon upload).
		wp_enqueue_media();

		$wpd_admin = array(
			'restUrl'                => esc_url_raw( rest_url() ),
			'nonce'                  => wp_create_nonce( 'wp_rest' ),
			'pageSlug'               => $page,
			'colorHelpImageBase'     => esc_url_raw( trailingslashit( WPD_PLUGIN_URL ) . 'assets/img/color-help/' ),
			'multiPickupStoresAddon' => class_exists( 'WPD_Multi_Store' ),
			'pickupStores'           => array(),
			'wcCountries'            => array(),
			'wcCountryStates'        => array(),
		);

		if ( class_exists( 'WPD_Multi_Store' ) && method_exists( 'WPD_Multi_Store', 'sanitize_stores_list' ) ) {
			$rows = WPD_Multi_Store::sanitize_stores_list( get_option( 'wpd_multi_pickup_stores', array() ) );
			$out  = array();
			foreach ( $rows as $r ) {
				if ( empty( $r['enabled'] ) ) {
					continue;
				}
				$id   = isset( $r['id'] ) ? (string) $r['id'] : '';
				$name = isset( $r['name'] ) ? (string) $r['name'] : '';
				if ( '' === $id ) {
					continue;
				}
				if ( '' === trim( $name ) ) {
					$name = $id;
				}
				$out[] = array(
					'id'   => $id,
					'name' => $name,
				);
			}
			$wpd_admin['pickupStores'] = $out;
		}

		if ( function_exists( 'WC' ) && WC()->countries ) {
			$wc_countries = WC()->countries->get_countries();
			$wc_countries = is_array( $wc_countries ) ? $wc_countries : array();
			uasort(
				$wc_countries,
				static function ( $a, $b ) {
					return strnatcasecmp( (string) $a, (string) $b );
				}
			);
			$states_by_country = array();
			foreach ( array_keys( $wc_countries ) as $cc ) {
				if ( ! is_string( $cc ) || 2 !== strlen( $cc ) ) {
					continue;
				}
				$states = WC()->countries->get_states( $cc );
				if ( is_array( $states ) && ! empty( $states ) ) {
					$states_by_country[ strtoupper( $cc ) ] = $states;
				}
			}
			$wpd_admin['wcCountries']     = $wc_countries;
			$wpd_admin['wcCountryStates'] = $states_by_country;
		} else {
			$wpd_admin['wcCountries'] = array(
				'AU' => __( 'Australia', 'eux-pickup-delivery' ),
			);
		}

		/**
		 * Extend localized `wpdAdmin` for admin React apps.
		 *
		 * @param array $wpd_admin Localized data.
		 * @return array
		 */
		$wpd_admin = apply_filters( 'wpd_admin_localize_script', $wpd_admin );

		wp_localize_script(
			'wpd-admin-app',
			'wpdAdmin',
			$wpd_admin
		);
	}

	/**
	 * Register admin menu and pages
	 */
	public function register_menu() {
		$capability = 'manage_options';

		add_menu_page(
			__( 'Pickup & Delivery', 'eux-pickup-delivery' ),
			__( 'Pickup & Delivery', 'eux-pickup-delivery' ),
			$capability,
			'wpd-pickup-delivery',
			array( $this, 'render_global_settings_page' ),
			'dashicons-location-alt',
			56
		);

		add_submenu_page(
			'wpd-pickup-delivery',
			__( 'Global Settings', 'eux-pickup-delivery' ),
			__( 'Global Settings', 'eux-pickup-delivery' ),
			$capability,
			'wpd-pickup-delivery',
			array( $this, 'render_global_settings_page' )
		);

		add_submenu_page(
			'wpd-pickup-delivery',
			__( 'Pickup Settings', 'eux-pickup-delivery' ),
			__( 'Pickup Settings', 'eux-pickup-delivery' ),
			$capability,
			'wpd-pickup-setting',
			array( $this, 'render_pickup_settings_page' )
		);

		add_submenu_page(
			'wpd-pickup-delivery',
			__( 'Delivery Settings', 'eux-pickup-delivery' ),
			__( 'Delivery Settings', 'eux-pickup-delivery' ),
			$capability,
			'wpd-delivery-setting',
			array( $this, 'render_delivery_settings_page' )
		);

		add_submenu_page(
			'wpd-pickup-delivery',
			__( 'Rules', 'eux-pickup-delivery' ),
			__( 'Rules', 'eux-pickup-delivery' ),
			$capability,
			'wpd-rules',
			array( $this, 'render_rules_page' )
		);
	}

	/**
	 * Blank: Global Setting page
	 */
	public function render_global_settings_page() {
		echo '<div class="wrap"><div id="wpd-admin-global-settings" class="wpd-admin-app"></div></div>';
	}

	/**
	 * Blank: Pickup Setting page
	 */
	public function render_pickup_settings_page() {
		echo '<div class="wrap"><div id="wpd-admin-pickup-settings" class="wpd-admin-app"></div></div>';
	}

	/**
	 * Blank: Delivery Setting page
	 */
	public function render_delivery_settings_page() {
		echo '<div class="wrap"><div id="wpd-admin-delivery-settings" class="wpd-admin-app"></div></div>';
	}

	/**
	 * Blank: Rules page
	 */
	public function render_rules_page() {
		echo '<div class="wrap"><div id="wpd-admin-rules" class="wpd-admin-app"></div></div>';
	}
}
