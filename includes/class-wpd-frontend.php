<?php
/**
 * Frontend Class
 * Handles frontend scripts and styles
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPD_Frontend {

	/**
	 * Single instance
	 */
	private static $instance = null;

	/**
	 * Get instance
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
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_checkout_styles' ) );

		// Hide shipping on cart page
		add_filter( 'woocommerce_cart_ready_to_calc_shipping', array( $this, 'hide_cart_shipping' ), 99 );
	}

	/**
	 * Hide shipping calculator on cart page only (not checkout)
	 */
	public function hide_cart_shipping() {
		// Only hide on cart page, NOT on checkout
		if ( is_cart() ) {
			return false;
		}
		return true;
	}


	/**
	 * Enqueue checkout styles to hide shipping method selector
	 */
	public function enqueue_checkout_styles() {
		if ( ! is_checkout() ) {
			return;
		}

		$selection = WC()->session->get( 'wpd_pad_selection' );

		// Only hide selector if shipping method already selected
		if ( ! empty( $selection ) && ! empty( $selection['shipping_method'] ) ) {
			$shipping_method_id = esc_js( $selection['shipping_method'] );
			$is_pickup          = ( 'pickup' === $selection['type'] );

			$custom_css = "
                /* Hide all shipping method radio buttons */
                .woocommerce-shipping-methods input[type='radio'] {
                    display: none !important;
                    visibility: hidden !important;
                }
                
                /* Hide all shipping method options */
                .woocommerce-shipping-methods li {
                    display: none !important;
                }
                
                /* Show only the selected one */
                .woocommerce-shipping-methods li.wpd-selected-method {
                    display: list-item !important;
                }
                
                /* Keep the shipping cost row visible */
                .woocommerce-shipping-totals {
                    display: table-row !important;
                }
                
                .woocommerce-shipping-totals td {
                    display: table-cell !important;
                }
                
                /* Style as plain text */
                .woocommerce-shipping-methods {
                    list-style: none !important;
                    padding-left: 0 !important;
                }
                
                .woocommerce-shipping-methods li label {
                    cursor: default !important;
                }
            ";

			// For pickup, hide shipping address section entirely
			if ( $is_pickup ) {
				$custom_css .= '
                    /* Hide ship to different address for pickup */
                    .woocommerce-shipping-fields,
                    #ship-to-different-address-checkbox,
                    .shipping_address {
                        display: none !important;
                    }
                    
                    /* Hide shipping totals row for pickup */
                    .woocommerce-shipping-totals,
                    tr.woocommerce-shipping-totals {
                        display: none !important;
                    }
                ';
			}

			wp_add_inline_style( 'woocommerce-general', $custom_css );

			// Add JavaScript to hide non-selected options and manage shipping address
			$inline_js = '
            jQuery(document).ready(function($) {
                var isPick = ' . ( $is_pickup ? 'true' : 'false' ) . ";
                var selType = '" . esc_js( $selection['type'] ) . "';
                
                console.log('WPD Checkout - Type:', selType);
                console.log('WPD Checkout - Selected Method:', '{$shipping_method_id}');
                console.log('WPD Checkout - Is Pickup:', isPick);
                
                function hideShippingOptions() {
                    var selectedMethod = '{$shipping_method_id}';
                    
                    console.log('Hiding shipping options, selected:', selectedMethod);
                    
                    // Find and mark the selected method
                    var foundMethod = false;
                    $('.woocommerce-shipping-methods li').each(function() {
                        var input = $(this).find('input[type=\"radio\"]');
                        if (input.length) {
                            var methodId = input.val();
                            console.log('Available method:', methodId);
                            
                            if (methodId === selectedMethod || methodId.indexOf(selectedMethod) !== -1) {
                                $(this).addClass('wpd-selected-method').show();
                                input.prop('checked', true);
                                foundMethod = true;
                                console.log('Found and selected:', methodId);
                            } else {
                                $(this).removeClass('wpd-selected-method').hide();
                            }
                        }
                    });
                    
                    if (!foundMethod) {
                        console.warn('Selected method not found in available methods');
                    }
                    
                    // Hide all radio buttons
                    $('.woocommerce-shipping-methods input[type=\"radio\"]').hide();
                    
                    // Handle shipping address visibility
                    if (isPick) {
                        // For pickup: hide everything including shipping totals
                        $('.woocommerce-shipping-totals').hide();
                        $('tr.woocommerce-shipping-totals').hide();
                    }
                }
                
                // Run immediately
                hideShippingOptions();
                
                // Run again after AJAX updates
                $(document.body).on('updated_checkout', function() {
                    console.log('Checkout updated via AJAX');
                    hideShippingOptions();
                });
            });
            ";
			wp_add_inline_script( 'jquery', $inline_js );
		}
	}

	/**
	 * Enqueue scripts and styles
	 */
	public function enqueue_scripts() {
		$pad_page_id   = WPD_Page_Manager::get_pad_page_id();
		$on_pad_page   = $pad_page_id && is_page( $pad_page_id );
		$on_flow_pages = is_cart() || is_checkout() || is_order_received_page();

		$show_progress = ! class_exists( 'WPD_Settings' ) || WPD_Settings::get_instance()->is_checkout_progress_bar_enabled();

		// Checkout step indicator (JS in class-wpd-page-manager.php) needs CSS on cart / checkout / thank-you — not only PAD.
		$steps_css_path          = WPD_PLUGIN_DIR . 'assets/css/wpd-checkout-steps.css';
		$have_checkout_steps_css = file_exists( $steps_css_path );
		if ( $show_progress && ( $on_pad_page || $on_flow_pages ) && $have_checkout_steps_css ) {
			wp_enqueue_style(
				'wpd-checkout-steps',
				WPD_PLUGIN_URL . 'assets/css/wpd-checkout-steps.css',
				array(),
				(string) filemtime( $steps_css_path )
			);
		}

		// Only load PAD app assets on PAD page
		if ( ! $on_pad_page ) {
			return;
		}

		// Enqueue WordPress components
		wp_enqueue_script( 'wp-element' );
		wp_enqueue_script( 'wp-components' );
		wp_enqueue_script( 'wp-i18n' );

		$pad_style_deps = array( 'wp-components' );
		// Must match the enqueue above: only depend on wpd-checkout-steps when that handle is registered.
		if ( $show_progress && $have_checkout_steps_css ) {
			$pad_style_deps[] = 'wpd-checkout-steps';
		}

		wp_enqueue_style(
			'wpd-styles',
			WPD_PLUGIN_URL . 'assets/css/pad-styles.css',
			$pad_style_deps,
			file_exists( WPD_PLUGIN_DIR . 'assets/css/pad-styles.css' ) ? (string) filemtime( WPD_PLUGIN_DIR . 'assets/css/pad-styles.css' ) : ( defined( 'WPD_VERSION' ) ? WPD_VERSION : time() )
		);
		$pad_app_css = WPD_PLUGIN_DIR . 'assets/css/pad-app.css';
		if ( file_exists( $pad_app_css ) ) {
			wp_enqueue_style(
				'wpd-pad-app',
				WPD_PLUGIN_URL . 'assets/css/pad-app.css',
				array( 'wp-components', 'wpd-styles' ),
				(string) filemtime( $pad_app_css )
			);
		}

		wp_enqueue_script(
			'wpd-pad-app',
			WPD_PLUGIN_URL . 'assets/js/pad-app.js',
			array( 'wp-element', 'wp-components', 'wp-i18n' ),
			file_exists( WPD_PLUGIN_DIR . 'assets/js/pad-app.js' ) ? (string) filemtime( WPD_PLUGIN_DIR . 'assets/js/pad-app.js' ) : ( defined( 'WPD_VERSION' ) ? WPD_VERSION : time() ),
			true
		);

		$pad_data = array(
			'ajaxUrl'          => admin_url( 'admin-ajax.php' ),
			'nonce'            => wp_create_nonce( 'wpd_nonce' ),
			'checkoutUrl'      => wc_get_checkout_url(),
			'storeAddress'     => $this->get_store_address(),
			'australianStates' => $this->get_australian_states(),
			'customerAddress'  => $this->get_customer_shipping_address(),
			'shippingMethods'  => $this->get_shipping_methods(),
			'globalSettings'   => $this->get_global_settings(),
			'pickupSettings'   => $this->get_pickup_settings(),
			'deliverySuburbs'  => $this->get_delivery_suburbs_for_pad(),
		);

		/**
		 * Extend PAD localized `wpdData` (e.g. multi-store add-on).
		 *
		 * @param array $pad_data Localized data.
		 * @return array
		 */
		$pad_data = apply_filters( 'wpd_pad_localize_script_data', $pad_data );

		wp_localize_script(
			'wpd-pad-app',
			'wpdData',
			$pad_data
		);
	}

	/**
	 * Get merged global settings for frontend.
	 *
	 * @return array
	 */
	private function get_global_settings() {
		if ( class_exists( 'WPD_Settings' ) ) {
			return WPD_Settings::get_instance()->get_effective_global_for_pad();
		}

		return array();
	}

	/**
	 * Get pickup settings for frontend.
	 *
	 * @return array
	 */
	private function get_pickup_settings() {
		if ( class_exists( 'WPD_Settings' ) ) {
			$settings             = get_option( WPD_Settings::OPTION_PICKUP, array() );
			$defaults             = WPD_Settings::get_instance()->get_pickup_defaults();
			$merged               = WPD_Settings::get_instance()->merge_pickup_settings( $defaults, is_array( $settings ) ? $settings : array() );
			$iframe               = self::pickup_map_iframe_html( isset( $merged['address'] ) ? $merged['address'] : '' );
			$merged['map_iframe'] = wp_kses(
				$iframe,
				array(
					'iframe' => array(
						'title'           => true,
						'src'             => true,
						'width'           => true,
						'height'          => true,
						'style'           => true,
						'loading'         => true,
						'referrerpolicy'  => true,
						'allowfullscreen' => true,
					),
				)
			);
			return $merged;
		}
		return array();
	}

	/**
	 * Suburb names from Delivery settings for PAD delivery address dropdown.
	 *
	 * @return string[] Non-empty unique suburbs in saved order.
	 */
	private function get_delivery_suburbs_for_pad() {
		if ( ! class_exists( 'WPD_Settings' ) ) {
			return array();
		}
		$settings = get_option( WPD_Settings::OPTION_DELIVERY, array() );
		$defaults = WPD_Settings::get_instance()->get_delivery_defaults();
		$merged   = WPD_Settings::get_instance()->merge_delivery_settings(
			$defaults,
			is_array( $settings ) ? $settings : array()
		);
		$list     = isset( $merged['suburbs'] ) && is_array( $merged['suburbs'] ) ? $merged['suburbs'] : array();
		$out      = array();
		foreach ( $list as $s ) {
			$s = is_string( $s ) ? trim( $s ) : '';
			if ( '' !== $s ) {
				$out[] = $s;
			}
		}
		return $out;
	}

	/**
	 * Build a Google Maps iframe embed from address text.
	 *
	 * @param string $address Multiline address.
	 * @return string Iframe HTML (sanitize with wp_kses iframe allowlist before output).
	 */
	public static function pickup_map_iframe_html( $address ) {
		$address = trim( (string) $address );
		if ( '' === $address ) {
			return '';
		}

		$query = rawurlencode( preg_replace( '/\\s+/', ' ', $address ) );
		$src   = 'https://www.google.com/maps?q=' . $query . '&output=embed';

		return sprintf(
			'<iframe title="%s" src="%s" width="100%%" height="509" style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>',
			esc_attr__( 'Pickup map', 'eux-pad' ),
			esc_url( $src )
		);
	}

	/**
	 * Get store address
	 */
	private function get_store_address() {
		return array(
			'name'     => 'Main Store',
			'address'  => '728 Old Gympie Rd',
			'suburb'   => 'Narangba',
			'state'    => 'QLD',
			'postcode' => '4504',
			'phone'    => '1300 477 024',
			'hours'    => 'Monday – Friday : 6:30am – 4:00pm',
		);
	}

	// REMOVE OR COMMENT OUT these methods - not needed anymore
	/*
	private function get_dates() {
		// Not used anymore - dates come from API
	}

	private function get_time_slots() {
		// Not used anymore - time slots come from API
	}
	*/

	/**
	 * Get Australian states
	 */
	private function get_australian_states() {
		return array(
			'NSW' => 'New South Wales',
			'VIC' => 'Victoria',
			'QLD' => 'Queensland',
			'WA'  => 'Western Australia',
			'SA'  => 'South Australia',
			'TAS' => 'Tasmania',
			'ACT' => 'Australian Capital Territory',
			'NT'  => 'Northern Territory',
		);
	}

	/**
	 * Get customer shipping address if logged in
	 */
	private function get_customer_shipping_address() {
		$address = array(
			'street_address' => '',
			'suburb'         => '',
			'state'          => 'NSW',
			'postcode'       => '',
		);

		if ( is_user_logged_in() ) {
			$customer = WC()->customer;
			if ( $customer ) {
				$address['street_address'] = $customer->get_shipping_address_1();
				$address['suburb']         = $customer->get_shipping_city();
				$ship_state                = $customer->get_shipping_state();
				$address['state']          = $ship_state ? $ship_state : 'NSW';
				$address['postcode']       = $customer->get_shipping_postcode();
			}
		}

		return $address;
	}

	/**
	 * Get available shipping methods (from WooCommerce shipping zones)
	 */
	private function get_shipping_methods() {
		$shipping_methods = array();

		// Get all shipping zones
		$zones = WC_Shipping_Zones::get_zones();

		// Add methods from each zone
		foreach ( $zones as $zone ) {
			if ( ! empty( $zone['shipping_methods'] ) ) {
				foreach ( $zone['shipping_methods'] as $method ) {
					if ( 'yes' === $method->enabled ) {
						$cost = $method->get_option( 'cost' );

						// Format cost display
						$cost_display = 'Free';
						if ( ! empty( $cost ) && $cost > 0 ) {
							$cost_display = wc_price( $cost );
						} elseif ( 'free_shipping' === $method->id ) {
							$cost_display = 'Free';
						} elseif ( 'flat_rate' === $method->id ) {
							$cost_display = ! empty( $cost ) ? wc_price( $cost ) : wc_price( 0 );
						} else {
							$cost_display = __( 'Calculated at checkout', 'eux-pad' );
						}

						$shipping_methods[] = array(
							'id'        => $method->instance_id,
							'method_id' => $method->id,
							'title'     => $method->get_title(),
							'cost'      => $cost_display,
						);
					}
				}
			}
		}

		// Add methods from "Rest of the World" zone (zone 0)
		$zone_0    = new WC_Shipping_Zone( 0 );
		$methods_0 = $zone_0->get_shipping_methods( true );

		foreach ( $methods_0 as $method ) {
			if ( 'yes' === $method->enabled ) {
				$cost = $method->get_option( 'cost' );

				// Format cost display
				$cost_display = 'Free';
				if ( ! empty( $cost ) && $cost > 0 ) {
					$cost_display = wc_price( $cost );
				} elseif ( 'free_shipping' === $method->id ) {
					$cost_display = 'Free';
				} elseif ( 'flat_rate' === $method->id ) {
					$cost_display = ! empty( $cost ) ? wc_price( $cost ) : wc_price( 0 );
				} else {
					$cost_display = __( 'Calculated at checkout', 'eux-pad' );
				}

				$shipping_methods[] = array(
					'id'        => $method->instance_id,
					'method_id' => $method->id,
					'title'     => $method->get_title(),
					'cost'      => $cost_display,
				);
			}
		}

		// Remove duplicates based on instance_id
		$unique_methods = array();
		$seen_ids       = array();

		foreach ( $shipping_methods as $method ) {
			if ( ! in_array( $method['id'], $seen_ids, true ) ) {
				$unique_methods[] = $method;
				$seen_ids[]       = $method['id'];
			}
		}

		return $unique_methods;
	}
}
