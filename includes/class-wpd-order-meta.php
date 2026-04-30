<?php
/**
 * Order Meta Class
 * Handles saving PAD data to order meta
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPD_Order_Meta {

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
		// Save order meta
		add_action( 'woocommerce_checkout_update_order_meta', array( $this, 'save_order_meta' ) );

		// Update shipping address with delivery data
		add_action( 'woocommerce_checkout_create_order', array( $this, 'update_shipping_address' ), 10, 2 );

		// Pre-fill shipping address on checkout page
		add_filter( 'woocommerce_checkout_get_value', array( $this, 'prefill_shipping_address' ), 10, 2 );

		// Set chosen shipping method (only on checkout load)
		add_action( 'template_redirect', array( $this, 'set_chosen_shipping_method' ), 1 );

		// Filter to force our chosen shipping method
		add_filter( 'woocommerce_shipping_chosen_method', array( $this, 'force_chosen_shipping_method' ), 10, 3 );

		// Ensure shipping is added to cart total (only after totals calculated)
		add_action( 'woocommerce_after_calculate_totals', array( $this, 'add_shipping_to_cart_total' ) );

		// Hide shipping address section for pickup orders
		add_filter( 'woocommerce_cart_needs_shipping_address', array( $this, 'maybe_hide_shipping_address' ) );

		// Display on checkout page after order review
		add_action( 'woocommerce_review_order_after_order_total', array( $this, 'display_checkout_details' ) );

		// Display order meta in admin (after General section)
		add_action( 'woocommerce_admin_order_data_after_order_details', array( $this, 'display_order_meta_admin' ) );

		// Display order meta in emails
		add_action( 'woocommerce_email_after_order_table', array( $this, 'display_order_meta_email' ), 10, 4 );

		// Display order meta on order received page
		add_action( 'woocommerce_order_details_after_order_table', array( $this, 'display_order_meta_frontend' ) );

		// Save edits from admin order screen.
		add_action( 'woocommerce_process_shop_order_meta', array( $this, 'save_admin_order_meta' ), 20, 2 );

		// Add columns in admin orders list (legacy + HPOS).
		add_filter( 'manage_edit-shop_order_columns', array( $this, 'add_admin_order_columns' ), 20 );
		add_action( 'manage_shop_order_posts_custom_column', array( $this, 'render_admin_order_columns' ), 20, 2 );
		add_filter( 'woocommerce_shop_order_list_table_columns', array( $this, 'add_admin_order_columns' ), 20 );
		add_action( 'woocommerce_shop_order_list_table_custom_column', array( $this, 'render_hpos_order_columns' ), 20, 2 );

		// Add columns in My Account > Orders list.
		add_filter( 'woocommerce_my_account_my_orders_columns', array( $this, 'add_my_account_order_columns' ), 20 );
		add_action( 'woocommerce_my_account_my_orders_column_wpd_type', array( $this, 'render_my_account_type_column' ) );
		add_action( 'woocommerce_my_account_my_orders_column_wpd_date', array( $this, 'render_my_account_date_column' ) );

		add_action( 'woocommerce_before_checkout_billing_form', array( $this, 'add_copy_shipping_button' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue_copy_shipping_assets' ), 20 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_order_pad_scripts' ) );

		// Remove shipping checkbox for shipping address for delivery
		add_filter( 'woocommerce_ship_to_different_address_checked', array( $this, 'check_ship_to_different_for_delivery' ) );

		// WooCommerce REST: expose PAD meta in order `meta_data` (private `_` keys are often omitted otherwise).
		add_action( 'init', array( $this, 'register_order_meta_for_rest' ), 20 );
		add_filter( 'woocommerce_rest_prepare_shop_order_object', array( $this, 'rest_prepare_shop_order_pad_meta' ), 10, 3 );
	}

	/**
	 * Enqueue checkout assets for the “copy shipping to billing” control (delivery PAD flow).
	 */
	public function maybe_enqueue_copy_shipping_assets() {
		if ( ! function_exists( 'is_checkout' ) || ! is_checkout() || is_order_received_page() ) {
			return;
		}
		if ( ! function_exists( 'WC' ) || ! WC()->session ) {
			return;
		}
		$selection = WC()->session->get( 'wpd_pad_selection' );
		if ( empty( $selection ) || ! isset( $selection['type'] ) || 'delivery' !== $selection['type'] ) {
			return;
		}
		$css_path = WPD_PLUGIN_DIR . 'assets/css/wpd-copy-shipping.css';
		$js_path  = WPD_PLUGIN_DIR . 'assets/js/wpd-copy-shipping.js';
		if ( file_exists( $css_path ) ) {
			wp_enqueue_style(
				'wpd-copy-shipping',
				WPD_PLUGIN_URL . 'assets/css/wpd-copy-shipping.css',
				array(),
				(string) filemtime( $css_path )
			);
		}
		if ( file_exists( $js_path ) ) {
			wp_enqueue_script(
				'wpd-copy-shipping',
				WPD_PLUGIN_URL . 'assets/js/wpd-copy-shipping.js',
				array( 'jquery' ),
				(string) filemtime( $js_path ),
				true
			);
		}
	}

	/**
	 * Admin order edit: PAD type toggle script (enqueued asset, no inline script tags).
	 */
	public function enqueue_admin_order_pad_scripts( $hook ) {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen ) {
			return;
		}
		$allowed = array( 'shop_order', 'woocommerce_page_wc-orders' );
		if ( ! in_array( $screen->id, $allowed, true ) ) {
			return;
		}
		$path = WPD_PLUGIN_DIR . 'assets/js/wpd-admin-order-pad.js';
		if ( ! file_exists( $path ) ) {
			return;
		}
		wp_enqueue_script(
			'wpd-admin-order-pad',
			WPD_PLUGIN_URL . 'assets/js/wpd-admin-order-pad.js',
			array(),
			(string) filemtime( $path ),
			true
		);
	}

	/**
	 * Meta keys stored by this plugin (order object / HPOS).
	 *
	 * @return string[]
	 */
	private function get_pad_order_meta_keys() {
		return array(
			'_wpd_date',
			'_wpd_type',
			'_wpd_time_slot',
			'_wpd_shipping_method',
			'_wpd_pickup_store_id',
			'_wpd_pickup_store_name',
			'_wpd_delivery_address',
			'_wpd_delivery_instructions',
		);
	}

	/**
	 * Register order meta so WordPress/WooCommerce REST can include it in `meta_data`.
	 */
	public function register_order_meta_for_rest() {
		if ( ! function_exists( 'register_post_meta' ) ) {
			return;
		}

		// String meta only; _wpd_delivery_address is an array and is still merged via rest_prepare_shop_order_pad_meta.
		$keys = array(
			'_wpd_date'                  => 'string',
			'_wpd_type'                  => 'string',
			'_wpd_time_slot'             => 'string',
			'_wpd_shipping_method'       => 'string',
			'_wpd_pickup_store_id'       => 'string',
			'_wpd_pickup_store_name'     => 'string',
			'_wpd_delivery_instructions' => 'string',
		);

		foreach ( $keys as $key => $type ) {
			register_post_meta(
				'shop_order',
				$key,
				array(
					'type'          => $type,
					'single'        => true,
					'show_in_rest'  => true,
					'auth_callback' => array( $this, 'rest_pad_meta_auth' ),
				)
			);
		}
	}

	/**
	 * Whether the current user may read PAD meta for this order in REST contexts.
	 *
	 * @param bool   $allowed   Whether the user can add this meta.
	 * @param string $meta_key  Meta key.
	 * @param int    $object_id Order ID.
	 * @return bool
	 */
	public function rest_pad_meta_auth( $allowed, $meta_key, $object_id ) {
		if ( ! $object_id ) {
			return false;
		}
		if ( function_exists( 'wc_rest_check_user_permissions' ) ) {
			return wc_rest_check_user_permissions( 'orders', 'read', $object_id );
		}
		return current_user_can( 'edit_shop_orders' ) || current_user_can( 'manage_woocommerce' );
	}

	/**
	 * Ensure PAD keys appear in WC REST order `meta_data` with values from WC_Order (HPOS-safe).
	 *
	 * @param WP_REST_Response $response Response.
	 * @param WC_Order         $order    Order.
	 * @param WP_REST_Request  $request  Request.
	 * @return WP_REST_Response
	 */
	public function rest_prepare_shop_order_pad_meta( $response, $order, $request ) {
		if ( ! $order instanceof \WC_Order ) {
			return $response;
		}

		$data = $response->get_data();
		if ( ! isset( $data['meta_data'] ) || ! is_array( $data['meta_data'] ) ) {
			$data['meta_data'] = array();
		}

		$keys = apply_filters( 'wpd_rest_order_meta_keys', $this->get_pad_order_meta_keys() );

		foreach ( $keys as $key ) {
			$value = $order->get_meta( $key, true );
			if ( '' === $value || null === $value ) {
				continue;
			}

			$found = false;
			foreach ( $data['meta_data'] as $i => $row ) {
				if ( isset( $row['key'] ) && $row['key'] === $key ) {
					$data['meta_data'][ $i ]['value'] = $value;
					$found                            = true;
					break;
				}
			}

			if ( ! $found ) {
				$data['meta_data'][] = array(
					'id'    => 0,
					'key'   => $key,
					'value' => $value,
				);
			}
		}

		$response->set_data( $data );
		return $response;
	}

	/**
	 * Add admin order list columns.
	 */
	public function add_admin_order_columns( $columns ) {
		$new = array();
		foreach ( $columns as $key => $label ) {
			$new[ $key ] = $label;
			if ( 'order_status' === $key ) {
				$new['wpd_type'] = __( 'Type', 'eux-pickup-delivery' );
				$new['wpd_date'] = __( 'Shipping/Pickup Date', 'eux-pickup-delivery' );
			}
		}
		return $new;
	}

	/**
	 * Render admin order list columns (legacy post list table).
	 */
	public function render_admin_order_columns( $column, $post_id ) {
		if ( 'wpd_type' === $column ) {
			$order = function_exists( 'wc_get_order' ) ? wc_get_order( $post_id ) : null;
			$type  = $order ? (string) $order->get_meta( '_wpd_type', true ) : (string) get_post_meta( $post_id, '_wpd_type', true );
			if ( $type ) {
				$label        = ucfirst( $type );
				$status_class = 'status-processing';
				if ( 'delivery' === $type ) {
					$status_class = 'status-completed';
				}
				echo '<mark class="order-status ' . esc_attr( $status_class ) . '"><span>' . esc_html( $label ) . '</span></mark>';
			}
		}
		if ( 'wpd_date' === $column ) {
			$order = function_exists( 'wc_get_order' ) ? wc_get_order( $post_id ) : null;
			if ( $order ) {
				$type = (string) $order->get_meta( '_wpd_type', true );
				$date = (string) $order->get_meta( '_wpd_date', true );
				$slot = (string) $order->get_meta( '_wpd_time_slot', true );
			} else {
				$type = (string) get_post_meta( $post_id, '_wpd_type', true );
				$date = (string) get_post_meta( $post_id, '_wpd_date', true );
				$slot = (string) get_post_meta( $post_id, '_wpd_time_slot', true );
			}
			if ( 'pickup' === $type && $slot ) {
				echo esc_html( $date . ' ' . $slot );
			} else {
				echo esc_html( $date );
			}
		}
	}

	/**
	 * Render admin order list columns (HPOS list table).
	 */
	public function render_hpos_order_columns( $column, $order ) {
		if ( ! is_object( $order ) || ! method_exists( $order, 'get_id' ) ) {
			return;
		}
		$order_id = $order->get_id();
		if ( 'wpd_type' === $column ) {
			$type = (string) $order->get_meta( '_wpd_type', true );
			if ( $type ) {
				$label        = ucfirst( $type );
				$status_class = 'status-processing';
				if ( 'delivery' === $type ) {
					$status_class = 'status-completed';
				}
				echo '<mark class="order-status ' . esc_attr( $status_class ) . '"><span>' . esc_html( $label ) . '</span></mark>';
			}
		}
		if ( 'wpd_date' === $column ) {
			$type = (string) $order->get_meta( '_wpd_type', true );
			$date = (string) $order->get_meta( '_wpd_date', true );
			$slot = (string) $order->get_meta( '_wpd_time_slot', true );
			if ( 'pickup' === $type && $slot ) {
				echo esc_html( $date . ' ' . $slot );
			} else {
				echo esc_html( $date );
			}
		}
	}

	/**
	 * Add My Account orders list columns.
	 */
	public function add_my_account_order_columns( $columns ) {
		$new = array();
		foreach ( $columns as $key => $label ) {
			$new[ $key ] = $label;
			if ( 'order-status' === $key || 'order-status' === str_replace( '_', '-', $key ) ) {
				$new['wpd_type'] = __( 'Type', 'eux-pickup-delivery' );
				$new['wpd_date'] = __( 'Shipping/Pickup Date', 'eux-pickup-delivery' );
			}
		}
		// Fallback: if no status key matched, append.
		if ( ! isset( $new['wpd_type'] ) ) {
			$new['wpd_type'] = __( 'Type', 'eux-pickup-delivery' );
			$new['wpd_date'] = __( 'Shipping/Pickup Date', 'eux-pickup-delivery' );
		}
		return $new;
	}

	public function render_my_account_type_column( $order ) {
		if ( ! is_object( $order ) || ! method_exists( $order, 'get_id' ) ) {
			return;
		}
		echo esc_html( ucfirst( (string) $order->get_meta( '_wpd_type', true ) ) );
	}

	public function render_my_account_date_column( $order ) {
		if ( ! is_object( $order ) || ! method_exists( $order, 'get_id' ) ) {
			return;
		}
		$type = (string) $order->get_meta( '_wpd_type', true );
		$date = (string) $order->get_meta( '_wpd_date', true );
		$slot = (string) $order->get_meta( '_wpd_time_slot', true );
		if ( 'pickup' === $type && $slot ) {
			echo esc_html( $date . ' ' . $slot );
		} else {
			echo esc_html( $date );
		}
	}

	/**
	 * Force our chosen shipping method
	 */
	public function force_chosen_shipping_method( $chosen_method, $rates, $package_key ) {
		$selection = WC()->session->get( 'wpd_pad_selection' );

		if ( ! empty( $selection ) && ! empty( $selection['shipping_method'] ) ) {
			// Check if our method exists in available rates
			if ( isset( $rates[ $selection['shipping_method'] ] ) ) {
				return $selection['shipping_method'];
			}
		}

		return $chosen_method;
	}

	/**
	 * Check "ship to different address" checkbox for delivery orders
	 */
	public function check_ship_to_different_for_delivery( $checked ) {
		$selection = WC()->session->get( 'wpd_pad_selection' );

		// For delivery orders, check the box by default
		if ( ! empty( $selection ) && 'delivery' === $selection['type'] ) {
			return false;
		}

		return $checked;
	}

	/**
	 * Ensure shipping cost is added to cart totals
	 */
	public function add_shipping_to_cart_total() {
		if ( ! is_checkout() ) {
			return;
		}

		$selection = WC()->session->get( 'wpd_pad_selection' );

		if ( empty( $selection ) || empty( $selection['shipping_method'] ) ) {
			return;
		}

		$shipping_method_id = $selection['shipping_method'];

		// Get shipping packages
		$packages = WC()->shipping()->get_packages();

		if ( ! empty( $packages ) ) {
			foreach ( $packages as $package ) {
				if ( isset( $package['rates'][ $shipping_method_id ] ) ) {
					$rate          = $package['rates'][ $shipping_method_id ];
					$shipping_cost = floatval( $rate->get_cost() );

					// If cart shipping total is 0 but we have a cost, set it manually
					if ( 0.0 === (float) WC()->cart->get_shipping_total() && $shipping_cost > 0 ) {
						WC()->cart->set_shipping_total( $shipping_cost );

						// Also set shipping taxes if any
						$shipping_taxes = $rate->get_taxes();
						if ( ! empty( $shipping_taxes ) ) {
							WC()->cart->set_shipping_tax( array_sum( $shipping_taxes ) );
						}
					}
					break;
				}
			}
		}
	}

	/**
	 * Hide shipping address section for pickup orders
	 */
	public function maybe_hide_shipping_address( $needs_address ) {
		$selection = WC()->session->get( 'wpd_pad_selection' );

		// Hide shipping address for pickup orders
		if ( ! empty( $selection ) && 'pickup' === $selection['type'] ) {
			return false;
		}

		return $needs_address;
	}

	/**
	 * Pre-fill shipping address on checkout page with delivery form data
	 */
	public function prefill_shipping_address( $value, $input ) {
		$selection = WC()->session->get( 'wpd_pad_selection' );

		if ( empty( $selection ) || empty( $selection['address'] ) || ! is_array( $selection['address'] ) ) {
			return $value;
		}

		$type = isset( $selection['type'] ) ? (string) $selection['type'] : '';
		if ( 'delivery' !== $type && 'pickup' !== $type ) {
			return $value;
		}

		$address = $selection['address'];

		// Map PAD fields to WooCommerce shipping fields (delivery + pickup store).
		$field_map = array(
			'shipping_address_1' => 'street_address',
			'shipping_city'      => 'suburb',
			'shipping_state'     => 'state',
			'shipping_postcode'  => 'postcode',
			'shipping_country'   => 'country',
		);

		// Check if current field should be prefilled
		if ( isset( $field_map[ $input ] ) ) {
			$form_field = $field_map[ $input ];

			if ( 'country' === $form_field ) {
				if ( isset( $address['country'] ) && '' !== (string) $address['country'] ) {
					return (string) $address['country'];
				}
				return 'AU';
			} elseif ( isset( $address[ $form_field ] ) && '' !== (string) $address[ $form_field ] ) {
				return (string) $address[ $form_field ];
			}
		}

		// Uncheck "ship to different address" checkbox
		if ( 'ship_to_different_address' === $input ) {
			return 0; // Unchecked
		}

		return $value;
	}

	/**
	 * Set the chosen shipping method from PAD selection
	 */
	public function set_chosen_shipping_method() {
		// Only run on checkout page or AJAX
		if ( ! is_checkout() && ! wp_doing_ajax() ) {
			return;
		}

		$selection = WC()->session->get( 'wpd_pad_selection' );

		if ( empty( $selection ) || empty( $selection['shipping_method'] ) ) {
			return;
		}

		$shipping_method_id = $selection['shipping_method'];

		// Sync customer shipping from PAD (delivery or pickup store).
		if ( ! empty( $selection['address'] ) && is_array( $selection['address'] ) ) {
			$address  = $selection['address'];
			$customer = WC()->customer;

			if ( $customer && ( 'delivery' === $selection['type'] || 'pickup' === $selection['type'] ) ) {
				$country = isset( $address['country'] ) && '' !== (string) $address['country'] ? (string) $address['country'] : 'AU';
				$customer->set_shipping_address_1( isset( $address['street_address'] ) ? (string) $address['street_address'] : '' );
				$customer->set_shipping_city( isset( $address['suburb'] ) ? (string) $address['suburb'] : '' );
				$customer->set_shipping_state( isset( $address['state'] ) ? (string) $address['state'] : '' );
				$customer->set_shipping_postcode( isset( $address['postcode'] ) ? (string) $address['postcode'] : '' );
				$customer->set_shipping_country( $country );
				$customer->save();
			}
		}

		// Ensure cart knows it needs shipping
		WC()->cart->needs_shipping_address( true );

		// Clear any cached shipping
		WC()->session->set( 'shipping_for_package_0', false );

		// Calculate shipping first to get available rates
		WC()->cart->calculate_shipping();

		// Get the packages to verify our method exists
		$packages      = WC()->shipping()->get_packages();
		$method_exists = false;

		if ( ! empty( $packages ) ) {
			foreach ( $packages as $package ) {
				if ( isset( $package['rates'][ $shipping_method_id ] ) ) {
					$method_exists = true;
					break;
				}
			}
		}

		// Only set if method exists in available rates
		if ( $method_exists ) {
			// Set as array with package key 0
			WC()->session->set( 'chosen_shipping_methods', array( 0 => $shipping_method_id ) );

			// Force cart to use this method by directly setting it
			add_filter(
				'woocommerce_package_rates',
				function ( $rates, $package ) use ( $shipping_method_id ) {
					// Mark our chosen method
					if ( isset( $rates[ $shipping_method_id ] ) ) {
						// Force this rate to be chosen
						WC()->session->set( 'chosen_shipping_methods', array( 0 => $shipping_method_id ) );
					}
					return $rates;
				},
				999,
				2
			);

			// Recalculate totals with the chosen shipping
			WC()->cart->calculate_totals();
		}
	}

	/**
	 * Display PAD details on checkout page
	 */
	public function display_checkout_details() {
		$selection = WC()->session->get( 'wpd_pad_selection' );

		if ( empty( $selection ) ) {
			return;
		}

		$type      = isset( $selection['type'] ) ? $selection['type'] : '';
		$date      = isset( $selection['date'] ) ? $selection['date'] : '';
		$time_slot = isset( $selection['time_slot'] ) ? $selection['time_slot'] : '';

		echo '<tr class="wpd-checkout-details">';
		echo '<th colspan="2" style="text-align: left; padding-top: 20px;">';
		echo '<strong>' . esc_html__( 'Pickup & Delivery Details', 'eux-pickup-delivery' ) . '</strong>';
		echo '</th>';
		echo '</tr>';

		echo '<tr class="wpd-checkout-type">';
		echo '<th>' . esc_html__( 'Type:', 'eux-pickup-delivery' ) . '</th>';
		echo '<td>' . esc_html( ucfirst( $type ) ) . '</td>';
		echo '</tr>';

		echo '<tr class="wpd-checkout-date">';
		echo '<th>' . esc_html__( 'Date:', 'eux-pickup-delivery' ) . '</th>';
		echo '<td>' . esc_html( $date ) . '</td>';
		echo '</tr>';

		if ( 'pickup' === $type && ! empty( $selection['pickup_store_name'] ) ) {
			echo '<tr class="wpd-checkout-store">';
			echo '<th>' . esc_html__( 'Store:', 'eux-pickup-delivery' ) . '</th>';
			echo '<td>' . esc_html( (string) $selection['pickup_store_name'] ) . '</td>';
			echo '</tr>';
		}

		if ( ! empty( $time_slot ) && 'pickup' === $type ) {
			echo '<tr class="wpd-checkout-time">';
			echo '<th>' . esc_html__( 'Time Slot:', 'eux-pickup-delivery' ) . '</th>';
			echo '<td>' . esc_html( $time_slot ) . '</td>';
			echo '</tr>';
		}

		if ( 'delivery' === $type && ! empty( $selection['address'] ) ) {
			$address = $selection['address'];

			if ( ! empty( $address['instructions'] ) ) {
				echo '<tr class="wpd-checkout-instructions">';
				echo '<th>' . esc_html__( 'Instructions:', 'eux-pickup-delivery' ) . '</th>';
				echo '<td>' . esc_html( $address['instructions'] ) . '</td>';
				echo '</tr>';
			}
		}
	}

	/**
	 * Update shipping address with delivery form data
	 */
	public function update_shipping_address( $order, $data ) {
		$selection = WC()->session->get( 'wpd_pad_selection' );

		if ( empty( $selection ) ) {
			return;
		}

		$type = isset( $selection['type'] ) ? (string) $selection['type'] : '';
		if ( 'delivery' !== $type && 'pickup' !== $type ) {
			return;
		}

		$address = isset( $selection['address'] ) && is_array( $selection['address'] ) ? $selection['address'] : array();

		if ( empty( $address ) ) {
			return;
		}

		$country = isset( $address['country'] ) && '' !== (string) $address['country'] ? (string) $address['country'] : 'AU';

		$order->set_shipping_address_1( isset( $address['street_address'] ) ? (string) $address['street_address'] : '' );
		$order->set_shipping_address_2( '' );
		$order->set_shipping_city( isset( $address['suburb'] ) ? (string) $address['suburb'] : '' );
		$order->set_shipping_state( isset( $address['state'] ) ? (string) $address['state'] : '' );
		$order->set_shipping_postcode( isset( $address['postcode'] ) ? (string) $address['postcode'] : '' );
		$order->set_shipping_country( $country );

		if ( 'delivery' === $type && ! empty( $address['instructions'] ) ) {
			$order->set_customer_note( $address['instructions'] );
		}

		$customer_id = $order->get_customer_id();
		if ( $customer_id ) {
			update_user_meta( $customer_id, 'shipping_address_1', isset( $address['street_address'] ) ? (string) $address['street_address'] : '' );
			update_user_meta( $customer_id, 'shipping_address_2', '' );
			update_user_meta( $customer_id, 'shipping_city', isset( $address['suburb'] ) ? (string) $address['suburb'] : '' );
			update_user_meta( $customer_id, 'shipping_state', isset( $address['state'] ) ? (string) $address['state'] : '' );
			update_user_meta( $customer_id, 'shipping_postcode', isset( $address['postcode'] ) ? (string) $address['postcode'] : '' );
			update_user_meta( $customer_id, 'shipping_country', $country );
		}
	}

	/**
	 * Save order meta
	 */
	public function save_order_meta( $order_id ) {
		$selection = WC()->session->get( 'wpd_pad_selection' );

		if ( empty( $selection ) ) {
			return;
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		// Use WC order meta API so values persist in HPOS (wc_orders_meta), not only wp_postmeta.
		if ( ! empty( $selection['type'] ) ) {
			$order->update_meta_data( '_wpd_type', sanitize_text_field( $selection['type'] ) );
		}

		if ( ! empty( $selection['date'] ) ) {
			$order->update_meta_data( '_wpd_date', sanitize_text_field( $selection['date'] ) );
		}

		if ( ! empty( $selection['time_slot'] ) ) {
			$order->update_meta_data( '_wpd_time_slot', sanitize_text_field( $selection['time_slot'] ) );
		}

		if ( 'pickup' === $selection['type'] ) {
			if ( ! empty( $selection['pickup_store_id'] ) ) {
				$order->update_meta_data( '_wpd_pickup_store_id', sanitize_text_field( (string) $selection['pickup_store_id'] ) );
			}
			if ( ! empty( $selection['pickup_store_name'] ) ) {
				$order->update_meta_data( '_wpd_pickup_store_name', sanitize_text_field( (string) $selection['pickup_store_name'] ) );
			}
		}

		if ( ! empty( $selection['shipping_method'] ) ) {
			$order->update_meta_data( '_wpd_shipping_method', sanitize_text_field( $selection['shipping_method'] ) );
		}

		if ( 'delivery' === $selection['type'] && ! empty( $selection['address'] ) ) {
			$order->update_meta_data( '_wpd_delivery_address', $selection['address'] );

			if ( ! empty( $selection['address']['instructions'] ) ) {
				$order->update_meta_data( '_wpd_delivery_instructions', sanitize_textarea_field( $selection['address']['instructions'] ) );
			}
		}

		$order->save();

		// Clear session
		WC()->session->__unset( 'wpd_pad_selection' );
	}

	/**
	 * Display order meta in admin (view + toggleable edit).
	 */
	public function display_order_meta_admin( $order ) {
		if ( ! $order instanceof \WC_Order ) {
			return;
		}

		$order_id     = $order->get_id();
		$type         = (string) $order->get_meta( '_wpd_type', true );
		$date_raw     = (string) $order->get_meta( '_wpd_date', true );
		$time_slot    = (string) $order->get_meta( '_wpd_time_slot', true );
		$instructions = (string) $order->get_meta( '_wpd_delivery_instructions', true );
		$pickup_store = (string) $order->get_meta( '_wpd_pickup_store_name', true );

		// Prepare date value for <input type="date">.
		$date_value = '';
		if ( ! empty( $date_raw ) ) {
			// Try to parse any stored format into Y-m-d for the date input.
			$ts = strtotime( $date_raw );
			if ( $ts ) {
				$date_value = gmdate( 'Y-m-d', $ts );
			}
		}

		// Try to split stored time slot into from/to if it uses "start - end" format.
		$time_from = '';
		$time_to   = '';
		if ( ! empty( $time_slot ) && strpos( $time_slot, '-' ) !== false ) {
			$parts = array_map( 'trim', explode( '-', $time_slot ) );
			if ( count( $parts ) >= 2 ) {
				$time_from = $parts[0];
				$time_to   = $parts[1];
			}
		}

		$view_id      = 'wpd-pad-view-' . $order_id;
		$edit_id      = 'wpd-pad-edit-' . $order_id;
		$time_row_id  = 'wpd-time-row-' . $order_id;
		$store_row_id = 'wpd-store-row-' . $order_id;
		$multistore   = class_exists( 'WPD_Multi_Store' ) ? '1' : '0';

		echo '<div class="wpd-order-meta form-field form-field-wide" style="margin-top:20px; padding-top:12px; border-top:1px solid #eee;">';

		// Heading + Edit link.
		echo '<h3 style="display:flex; align-items:center; justify-content:space-between; gap:10px;">';
		echo '<span>' . esc_html__( 'Pickup & Delivery Details', 'eux-pickup-delivery' ) . '</span>';
		echo '<a href="#" class="wpd-pad-edit-link" data-wpd-view="' . esc_attr( $view_id ) . '" data-wpd-edit="' . esc_attr( $edit_id ) . '">';
		echo esc_html__( 'Edit', 'eux-pickup-delivery' );
		echo '</a>';
		echo '</h3>';

		// VIEW MODE.
		echo '<div id="' . esc_attr( $view_id ) . '">';
		echo '<p><strong>' . esc_html__( 'Type:', 'eux-pickup-delivery' ) . '</strong> ' . ( $type ? esc_html( ucfirst( $type ) ) : '&mdash;' ) . '</p>';
		echo '<p><strong>' . esc_html__( 'Date:', 'eux-pickup-delivery' ) . '</strong> ' . ( $date_raw ? esc_html( $date_raw ) : '&mdash;' ) . '</p>';
		if ( 'pickup' === $type ) {
			if ( '' !== $pickup_store ) {
				echo '<p><strong>' . esc_html__( 'Pickup store:', 'eux-pickup-delivery' ) . '</strong> ' . esc_html( $pickup_store ) . '</p>';
			}
			echo '<p><strong>' . esc_html__( 'Time Slot:', 'eux-pickup-delivery' ) . '</strong> ' . ( $time_slot ? esc_html( $time_slot ) : '&mdash;' ) . '</p>';
		}
		if ( ! empty( $instructions ) ) {
			echo '<p><strong>' . esc_html__( 'Delivery Instructions:', 'eux-pickup-delivery' ) . '</strong><br />' . nl2br( esc_html( $instructions ) ) . '</p>';
		}
		echo '</div>';

		// EDIT MODE (initially hidden, shown when clicking Edit).
		echo '<div id="' . esc_attr( $edit_id ) . '" class="wpd-pad-order-edit" style="display:none; margin-top:10px;" data-wpd-time-row="' . esc_attr( $time_row_id ) . '" data-wpd-store-row="' . esc_attr( $store_row_id ) . '" data-wpd-multi-store="' . esc_attr( $multistore ) . '">';

		// Type dropdown.
		echo '<p class="form-field">';
		echo '<label for="wpd_type"><strong>' . esc_html__( 'Type', 'eux-pickup-delivery' ) . '</strong></label> ';
		echo '<select name="_wpd_type" id="wpd_type" class="short">';
		echo '<option value="">' . esc_html__( '— Select —', 'eux-pickup-delivery' ) . '</option>';
		echo '<option value="pickup"' . selected( $type, 'pickup', false ) . '>' . esc_html__( 'Pickup', 'eux-pickup-delivery' ) . '</option>';
		echo '<option value="delivery"' . selected( $type, 'delivery', false ) . '>' . esc_html__( 'Delivery', 'eux-pickup-delivery' ) . '</option>';
		echo '</select>';
		echo '</p>';

		// Date selector.
		echo '<p class="form-field">';
		echo '<label for="wpd_date"><strong>' . esc_html__( 'Date', 'eux-pickup-delivery' ) . '</strong></label> ';
		echo '<input type="date" name="_wpd_date" id="wpd_date" class="short" value="' . esc_attr( $date_value ) . '" />';
		if ( ! empty( $date_raw ) && $date_raw !== $date_value ) {
			echo '<span class="description" style="margin-left:8px;">' . sprintf(
				/* translators: %s: previously stored date string */
				esc_html__( 'Stored value: %s', 'eux-pickup-delivery' ),
				esc_html( $date_raw )
			) . '</span>';
		}
		echo '</p>';

		// Time slot: from / to time selectors (pickup only).
		$time_row_style = ( 'pickup' === $type ) ? '' : 'display:none;';
		echo '<p class="form-field" id="' . esc_attr( $time_row_id ) . '" style="' . esc_attr( $time_row_style ) . '">';
		echo '<label><strong>' . esc_html__( 'Time slot', 'eux-pickup-delivery' ) . '</strong></label> ';
		echo '<span>';
		echo '<input type="time" name="_wpd_time_from" id="wpd_time_from" class="short" value="' . esc_attr( $time_from ) . '" /> ';
		echo esc_html__( 'to', 'eux-pickup-delivery' ) . ' ';
		echo '<input type="time" name="_wpd_time_to" id="wpd_time_to" class="short" value="' . esc_attr( $time_to ) . '" />';
		echo '</span>';
		if ( ! empty( $time_slot ) ) {
			echo '<span class="description" style="margin-left:8px;">' . sprintf(
				/* translators: %s: previously stored time slot */
				esc_html__( 'Stored value: %s', 'eux-pickup-delivery' ),
				esc_html( $time_slot )
			) . '</span>';
		}
		echo '</p>';

		// Pickup store selector (multi-store only).
		$store_row_style = ( 'pickup' === $type && class_exists( 'WPD_Multi_Store' ) ) ? '' : 'display:none;';
		echo '<p class="form-field" id="' . esc_attr( $store_row_id ) . '" style="' . esc_attr( $store_row_style ) . '">';
		echo '<label for="wpd_pickup_store_id"><strong>' . esc_html__( 'Pickup store', 'eux-pickup-delivery' ) . '</strong></label> ';
		echo '<select name="_wpd_pickup_store_id" id="wpd_pickup_store_id" class="short">';
		echo '<option value="">' . esc_html__( '— Select —', 'eux-pickup-delivery' ) . '</option>';
		if ( class_exists( 'WPD_Multi_Store' ) ) {
			$current_store_id = (string) $order->get_meta( '_wpd_pickup_store_id', true );
			$stores           = WPD_Multi_Store::sanitize_stores_list( get_option( 'wpd_multi_pickup_stores', array() ) );
			foreach ( $stores as $row ) {
				if ( empty( $row['enabled'] ) ) {
					continue;
				}
				$sid  = isset( $row['id'] ) ? (string) $row['id'] : '';
				$name = isset( $row['name'] ) ? (string) $row['name'] : '';
				if ( '' === $sid ) {
					continue;
				}
				if ( '' === trim( $name ) ) {
					$name = $sid;
				}
				echo '<option value="' . esc_attr( $sid ) . '"' . selected( $current_store_id, $sid, false ) . '>' . esc_html( $name ) . '</option>';
			}
		}
		echo '</select>';
		echo '</p>';

		// Instructions remain read-only but visible.
		if ( ! empty( $instructions ) ) {
			echo '<p class="form-field">';
			echo '<label><strong>' . esc_html__( 'Delivery Instructions', 'eux-pickup-delivery' ) . '</strong></label><br />';
			echo '<span>' . nl2br( esc_html( $instructions ) ) . '</span>';
			echo '</p>';
		}

		echo '</div>'; // end edit block.

		echo '</div>'; // wrapper.
	}

	/**
	 * Save admin-edited order meta.
	 *
	 * @param int     $post_id Order ID.
	 * @param WP_Post $post    Post object.
	 */
	public function save_admin_order_meta( $post_id, $post ) {
		// phpcs:disable WordPress.Security.NonceVerification.Missing -- WooCommerce verifies the shop order save nonce before woocommerce_process_shop_order_meta.

		$order = wc_get_order( $post_id );
		if ( ! $order ) {
			return;
		}

		// Type.
		$type = null;
		if ( isset( $_POST['_wpd_type'] ) ) {
			$type = sanitize_text_field( wp_unslash( $_POST['_wpd_type'] ) );
		} else {
			$type = (string) $order->get_meta( '_wpd_type', true );
		}

		if ( $type ) {
			$order->update_meta_data( '_wpd_type', $type );
		} else {
			$order->delete_meta_data( '_wpd_type' );
		}

		// Date (store as raw string; if from datepicker it will be YYYY-MM-DD).
		if ( isset( $_POST['_wpd_date'] ) ) {
			$date = sanitize_text_field( wp_unslash( $_POST['_wpd_date'] ) );
			if ( $date ) {
				$order->update_meta_data( '_wpd_date', $date );
			} else {
				$order->delete_meta_data( '_wpd_date' );
			}
		}

		// Time slot from/to (only meaningful for pickup).
		$from = isset( $_POST['_wpd_time_from'] ) ? sanitize_text_field( wp_unslash( $_POST['_wpd_time_from'] ) ) : '';
		$to   = isset( $_POST['_wpd_time_to'] ) ? sanitize_text_field( wp_unslash( $_POST['_wpd_time_to'] ) ) : '';

		if ( 'pickup' === $type && $from && $to ) {
			$slot = $from . ' - ' . $to;
			$order->update_meta_data( '_wpd_time_slot', $slot );
		} else {
			$order->delete_meta_data( '_wpd_time_slot' );
		}

		// Pickup store (multi-store only).
		if ( 'pickup' === $type && class_exists( 'WPD_Multi_Store' ) && isset( $_POST['_wpd_pickup_store_id'] ) ) {
			$store_id = sanitize_text_field( wp_unslash( (string) $_POST['_wpd_pickup_store_id'] ) );
			if ( '' !== $store_id ) {
				$order->update_meta_data( '_wpd_pickup_store_id', $store_id );
				$row = WPD_Multi_Store::get_store_by_id( $store_id );
				if ( $row && ! empty( $row['enabled'] ) ) {
					$name = isset( $row['name'] ) ? sanitize_text_field( (string) $row['name'] ) : '';
					if ( '' !== $name ) {
						$order->update_meta_data( '_wpd_pickup_store_name', $name );
					}
					// Also update order shipping address to match the selected pickup store.
					$addr = WPD_Multi_Store::store_row_to_checkout_address( $row );
					if ( is_array( $addr ) ) {
						$order->set_shipping_address_1( isset( $addr['street_address'] ) ? (string) $addr['street_address'] : '' );
						$order->set_shipping_address_2( '' );
						$order->set_shipping_city( isset( $addr['suburb'] ) ? (string) $addr['suburb'] : '' );
						$order->set_shipping_state( isset( $addr['state'] ) ? (string) $addr['state'] : '' );
						$order->set_shipping_postcode( isset( $addr['postcode'] ) ? (string) $addr['postcode'] : '' );
						$order->set_shipping_country( isset( $addr['country'] ) && '' !== (string) $addr['country'] ? (string) $addr['country'] : 'AU' );
					}
				}
			} else {
				$order->delete_meta_data( '_wpd_pickup_store_id' );
				$order->delete_meta_data( '_wpd_pickup_store_name' );
			}
		}

		$order->save();

		// phpcs:enable WordPress.Security.NonceVerification.Missing
	}

	/**
	 * Display order meta in emails
	 */
	public function display_order_meta_email( $order, $sent_to_admin, $plain_text, $email ) {
		if ( ! $order instanceof \WC_Order ) {
			return;
		}

		$type = (string) $order->get_meta( '_wpd_type', true );

		if ( '' === $type ) {
			return;
		}

		$date      = (string) $order->get_meta( '_wpd_date', true );
		$time_slot = (string) $order->get_meta( '_wpd_time_slot', true );

		if ( $plain_text ) {
			echo "\n" . esc_html( strtoupper( __( 'Pickup & Delivery Details', 'eux-pickup-delivery' ) ) ) . "\n\n";
			echo esc_html( __( 'Type:', 'eux-pickup-delivery' ) . ' ' . ucfirst( (string) $type ) ) . "\n";
			echo esc_html( __( 'Date:', 'eux-pickup-delivery' ) . ' ' . (string) $date ) . "\n";
			if ( ! empty( $time_slot ) ) {
				echo esc_html( __( 'Time Slot:', 'eux-pickup-delivery' ) . ' ' . (string) $time_slot ) . "\n";
			}
		} else {
			echo '<h2>' . esc_html__( 'Pickup & Delivery Details', 'eux-pickup-delivery' ) . '</h2>';
			echo '<p><strong>' . esc_html__( 'Type:', 'eux-pickup-delivery' ) . '</strong> ' . esc_html( ucfirst( $type ) ) . '</p>';
			echo '<p><strong>' . esc_html__( 'Date:', 'eux-pickup-delivery' ) . '</strong> ' . esc_html( $date ) . '</p>';
			if ( ! empty( $time_slot ) ) {
				echo '<p><strong>' . esc_html__( 'Time Slot:', 'eux-pickup-delivery' ) . '</strong> ' . esc_html( $time_slot ) . '</p>';
			}
		}
	}

	/**
	 * Display order meta on order received page
	 */
	public function display_order_meta_frontend( $order ) {
		if ( ! $order instanceof \WC_Order ) {
			return;
		}

		$type = (string) $order->get_meta( '_wpd_type', true );

		if ( '' === $type ) {
			return;
		}

		$date      = (string) $order->get_meta( '_wpd_date', true );
		$time_slot = (string) $order->get_meta( '_wpd_time_slot', true );

		echo '<section class="woocommerce-order-pad-details">';
		echo '<h2 class="woocommerce-order-pad-details__title">' . esc_html__( 'Pickup & Delivery Details', 'eux-pickup-delivery' ) . '</h2>';
		echo '<table class="woocommerce-table woocommerce-table--pad-details shop_table pad_details">';
		echo '<tbody>';
		echo '<tr><th>' . esc_html__( 'Type:', 'eux-pickup-delivery' ) . '</th><td>' . esc_html( ucfirst( $type ) ) . '</td></tr>';
		echo '<tr><th>' . esc_html__( 'Date:', 'eux-pickup-delivery' ) . '</th><td>' . esc_html( $date ) . '</td></tr>';
		if ( ! empty( $time_slot ) ) {
			echo '<tr><th>' . esc_html__( 'Time Slot:', 'eux-pickup-delivery' ) . '</th><td>' . esc_html( $time_slot ) . '</td></tr>';
		}
		echo '</tbody>';
		echo '</table>';
		echo '</section>';
	}

	/**
	 * Add copy shipping to billing button (delivery only)
	 */
	public function add_copy_shipping_button() {
		// Check if this is a delivery order
		$selection = WC()->session->get( 'wpd_pad_selection' );

		if ( empty( $selection ) || 'delivery' !== $selection['type'] ) {
			return; // Only show for delivery
		}

		?>
		<div class="wpd-copy-shipping-wrapper">
			<button type="button" id="wpd-copy-shipping" class="button wpd-copy-shipping-button">
				<span class="wpd-copy-icon"><svg width="18" height="19" viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg">
	<g clip-path="url(#clip0_1097_7649)">
	<path d="M9.75 15.8333C10.7442 15.8321 11.6973 15.4146 12.4003 14.6726C13.1033 13.9305 13.4988 12.9244 13.5 11.875V4.94239C13.5012 4.52626 13.4241 4.11402 13.2732 3.72957C13.1223 3.34512 12.9006 2.99611 12.621 2.70276L10.9395 0.927847C10.6616 0.632693 10.331 0.398699 9.96674 0.23943C9.60252 0.0801601 9.21198 -0.00121755 8.81775 1.37668e-05H5.25C4.2558 0.00127082 3.30267 0.418712 2.59967 1.16077C1.89666 1.90283 1.50119 2.90892 1.5 3.95835V11.875C1.50119 12.9244 1.89666 13.9305 2.59967 14.6726C3.30267 15.4146 4.2558 15.8321 5.25 15.8333H9.75ZM3 11.875V3.95835C3 3.32846 3.23705 2.72437 3.65901 2.27897C4.08097 1.83357 4.65326 1.58335 5.25 1.58335C5.25 1.58335 8.93925 1.59443 9 1.60235V3.16668C9 3.58661 9.15804 3.98933 9.43934 4.28627C9.72064 4.5832 10.1022 4.75001 10.5 4.75001H11.982C11.9895 4.81414 12 11.875 12 11.875C12 12.5049 11.7629 13.109 11.341 13.5544C10.919 13.9998 10.3467 14.25 9.75 14.25H5.25C4.65326 14.25 4.08097 13.9998 3.65901 13.5544C3.23705 13.109 3 12.5049 3 11.875ZM16.5 6.33335V15.0417C16.4988 16.0911 16.1033 17.0972 15.4003 17.8393C14.6973 18.5813 13.7442 18.9988 12.75 19H6C5.80109 19 5.61032 18.9166 5.46967 18.7681C5.32902 18.6197 5.25 18.4183 5.25 18.2083C5.25 17.9984 5.32902 17.797 5.46967 17.6486C5.61032 17.5001 5.80109 17.4167 6 17.4167H12.75C13.3467 17.4167 13.919 17.1665 14.341 16.7211C14.7629 16.2757 15 15.6716 15 15.0417V6.33335C15 6.12338 15.079 5.92202 15.2197 5.77355C15.3603 5.62509 15.5511 5.54168 15.75 5.54168C15.9489 5.54168 16.1397 5.62509 16.2803 5.77355C16.421 5.92202 16.5 6.12338 16.5 6.33335Z" fill="white"/>
	</g>
	<defs>
	<clipPath id="clip0_1097_7649">
		<rect width="18" height="19" fill="white"/>
	</clipPath>
	</defs>
</svg></span>
				<?php esc_html_e( 'Copy from Shipping Address', 'eux-pickup-delivery' ); ?>
			</button>
			<span class="wpd-copy-success">✓ <?php esc_html_e( 'Copied!', 'eux-pickup-delivery' ); ?></span>
		</div>
		<?php
	}
}