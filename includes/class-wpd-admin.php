<?php
/**
 * Admin Class
 * Registers admin menu pages for Pickup & Delivery.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class EUXPIDE_Admin {
	/**
	 * Single instance
	 *
	 * @var EUXPIDE_Admin|null
	 */
	private static $instance = null;

	/**
	 * Get instance
	 *
	 * @return EUXPIDE_Admin
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
	 * Enqueue admin assets for plugin pages
	 *
	 * @param string $hook_suffix Current admin page hook.
	 */
	public function enqueue_assets( $hook_suffix ) {
		if ( ! is_admin() ) {
			return;
		}

		$page          = isset( $_GET['page'] ) ? sanitize_text_field( wp_unslash( $_GET['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Admin ?page= slug for asset loading only.
		$euxpide_pages = apply_filters(
			'euxpide_admin_enqueue_app_slugs',
			array( 'euxpide-pickup-delivery', 'euxpide-pickup-setting', 'euxpide-delivery-setting', 'euxpide-rules' )
		);
		if ( ! in_array( $page, (array) $euxpide_pages, true ) ) {
			return;
		}

		$css_path = EUXPIDE_PLUGIN_DIR . 'assets/css/wpd-admin-app.css';
		if ( file_exists( $css_path ) ) {
			$css_ver = (string) filemtime( $css_path );
			wp_enqueue_style(
				'euxpide-admin-app',
				EUXPIDE_PLUGIN_URL . 'assets/css/wpd-admin-app.css',
				array( 'wp-components' ),
				$css_ver
			);
		}

		$js_path = EUXPIDE_PLUGIN_DIR . 'assets/js/wpd-admin-app.js';
		$js_ver  = file_exists( $js_path ) ? (string) filemtime( $js_path ) : ( defined( 'EUXPIDE_VERSION' ) ? EUXPIDE_VERSION : time() );
		wp_enqueue_script(
			'euxpide-admin-app',
			EUXPIDE_PLUGIN_URL . 'assets/js/wpd-admin-app.js',
			array( 'wp-element', 'wp-components', 'wp-i18n', 'wp-api-fetch' ),
			$js_ver,
			true
		);

		// Needed for wp.media (icon upload).
		wp_enqueue_media();

		$euxpide_admin = array(
			'restUrl'                => esc_url_raw( rest_url() ),
			'nonce'                  => wp_create_nonce( 'wp_rest' ),
			'pageSlug'               => $page,
			'colorHelpImageBase'     => esc_url_raw( trailingslashit( EUXPIDE_PLUGIN_URL ) . 'assets/img/color-help/' ),
			'multiPickupStoresAddon' => class_exists( 'WPD_Multi_Store' ),
			'pickupStores'           => array(),
			'wcCountries'            => array(),
			'wcCountryStates'        => array(),
		);

		if ( class_exists( 'WPD_Multi_Store' ) && method_exists( 'WPD_Multi_Store', 'sanitize_stores_list' ) ) {
			$rows = WPD_Multi_Store::sanitize_stores_list( get_option( 'euxpide_multi_pickup_stores', array() ) );
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
			$euxpide_admin['pickupStores'] = $out;
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
			$euxpide_admin['wcCountries']     = $wc_countries;
			$euxpide_admin['wcCountryStates'] = $states_by_country;
		} else {
			$euxpide_admin['wcCountries'] = array(
				'AU' => __( 'Australia', 'eux-pickup-delivery' ),
			);
		}

		$euxpide_admin['allowFreeSuburbInput']     = false;
		$euxpide_admin['restrictDeliveryStates']   = false;
		$euxpide_admin['storeCountry']             = 'AU';
		$euxpide_admin['storeCountryStateOptions'] = array();
		$euxpide_admin['australianStateOptions']   = array();
		if ( class_exists( 'EUXPIDE_Settings' ) ) {
			$settings                                = EUXPIDE_Settings::get_instance();
			$saved_d                                 = get_option( EUXPIDE_Settings::OPTION_DELIVERY, array() );
			$def_d                                   = $settings->get_delivery_defaults();
			$merged_d                                = $settings->merge_delivery_settings(
				$def_d,
				is_array( $saved_d ) ? $saved_d : array()
			);
			$euxpide_admin['allowFreeSuburbInput']   = ! empty( $merged_d['allow_free_suburb_input'] );
			$euxpide_admin['restrictDeliveryStates'] = ! empty( $merged_d['restrict_delivery_states'] );
			$euxpide_admin['storeCountry']           = $settings->get_store_base_country();
			$state_opts                              = array();
			foreach ( $settings->get_wc_states_for_store_country() as $code => $label ) {
				$state_opts[] = array(
					'value' => (string) $code,
					'label' => html_entity_decode( wp_strip_all_tags( (string) $label ), ENT_QUOTES, 'UTF-8' ),
				);
			}
			if ( empty( $state_opts ) ) {
				$state_opts = array(
					array(
						'value' => 'NSW',
						'label' => __( 'New South Wales', 'eux-pickup-delivery' ),
					),
					array(
						'value' => 'VIC',
						'label' => __( 'Victoria', 'eux-pickup-delivery' ),
					),
					array(
						'value' => 'QLD',
						'label' => __( 'Queensland', 'eux-pickup-delivery' ),
					),
					array(
						'value' => 'WA',
						'label' => __( 'Western Australia', 'eux-pickup-delivery' ),
					),
					array(
						'value' => 'SA',
						'label' => __( 'South Australia', 'eux-pickup-delivery' ),
					),
					array(
						'value' => 'TAS',
						'label' => __( 'Tasmania', 'eux-pickup-delivery' ),
					),
					array(
						'value' => 'ACT',
						'label' => __( 'Australian Capital Territory', 'eux-pickup-delivery' ),
					),
					array(
						'value' => 'NT',
						'label' => __( 'Northern Territory', 'eux-pickup-delivery' ),
					),
				);
			}
			$euxpide_admin['storeCountryStateOptions'] = $state_opts;
			$euxpide_admin['australianStateOptions']   = $state_opts;
		} else {
			$euxpide_admin['storeCountryStateOptions'] = array(
				array(
					'value' => 'NSW',
					'label' => __( 'New South Wales', 'eux-pickup-delivery' ),
				),
				array(
					'value' => 'VIC',
					'label' => __( 'Victoria', 'eux-pickup-delivery' ),
				),
				array(
					'value' => 'QLD',
					'label' => __( 'Queensland', 'eux-pickup-delivery' ),
				),
				array(
					'value' => 'WA',
					'label' => __( 'Western Australia', 'eux-pickup-delivery' ),
				),
				array(
					'value' => 'SA',
					'label' => __( 'South Australia', 'eux-pickup-delivery' ),
				),
				array(
					'value' => 'TAS',
					'label' => __( 'Tasmania', 'eux-pickup-delivery' ),
				),
				array(
					'value' => 'ACT',
					'label' => __( 'Australian Capital Territory', 'eux-pickup-delivery' ),
				),
				array(
					'value' => 'NT',
					'label' => __( 'Northern Territory', 'eux-pickup-delivery' ),
				),
			);
			$euxpide_admin['australianStateOptions']   = $euxpide_admin['storeCountryStateOptions'];
		}

		/**
		 * Extra Rules UI from add-ons: `conditionTypes` [{ value, label }], `conditionGuide` [{ id, term, desc }].
		 *
		 * @param array $extensions Keys conditionTypes, conditionGuide.
		 */
		$euxpide_admin['ruleExtensions'] = apply_filters(
			'euxpide_admin_rule_extensions',
			array(
				'conditionTypes' => array(),
				'conditionGuide' => array(),
			)
		);

		/**
		 * Extend localized `euxpideAdmin` for admin React apps.
		 *
	 * @param array $euxpide_admin Localized data.
		 * @return array
		 */
		$euxpide_admin = apply_filters( 'euxpide_admin_localize_script', $euxpide_admin );

		wp_localize_script(
			'euxpide-admin-app',
			'euxpideAdmin',
			$euxpide_admin
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
			'euxpide-pickup-delivery',
			array( $this, 'render_global_settings_page' ),
			'dashicons-location-alt',
			56
		);

		add_submenu_page(
			'euxpide-pickup-delivery',
			__( 'Global Settings', 'eux-pickup-delivery' ),
			__( 'Global Settings', 'eux-pickup-delivery' ),
			$capability,
			'euxpide-pickup-delivery',
			array( $this, 'render_global_settings_page' )
		);

		add_submenu_page(
			'euxpide-pickup-delivery',
			__( 'Pickup Settings', 'eux-pickup-delivery' ),
			__( 'Pickup Settings', 'eux-pickup-delivery' ),
			$capability,
			'euxpide-pickup-setting',
			array( $this, 'render_pickup_settings_page' )
		);

		add_submenu_page(
			'euxpide-pickup-delivery',
			__( 'Delivery Settings', 'eux-pickup-delivery' ),
			__( 'Delivery Settings', 'eux-pickup-delivery' ),
			$capability,
			'euxpide-delivery-setting',
			array( $this, 'render_delivery_settings_page' )
		);

		add_submenu_page(
			'euxpide-pickup-delivery',
			__( 'Rules', 'eux-pickup-delivery' ),
			__( 'Rules', 'eux-pickup-delivery' ),
			$capability,
			'euxpide-rules',
			array( $this, 'render_rules_page' )
		);
	}

	/**
	 * Blank: Global Setting page
	 */
	public function render_global_settings_page() {
		echo '<div class="wrap"><div id="euxpide-admin-global-settings" class="euxpide-admin-app"></div></div>';
	}

	/**
	 * Blank: Pickup Setting page
	 */
	public function render_pickup_settings_page() {
		echo '<div class="wrap"><div id="euxpide-admin-pickup-settings" class="euxpide-admin-app"></div></div>';
	}

	/**
	 * Blank: Delivery Setting page
	 */
	public function render_delivery_settings_page() {
		echo '<div class="wrap"><div id="euxpide-admin-delivery-settings" class="euxpide-admin-app"></div></div>';
	}

	/**
	 * Blank: Rules page
	 */
	public function render_rules_page() {
		echo '<div class="wrap"><div id="euxpide-admin-rules" class="euxpide-admin-app"></div></div>';
	}
}
