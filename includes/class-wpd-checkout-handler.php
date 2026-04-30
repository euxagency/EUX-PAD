<?php
/**
 * Checkout Handler Class
 * Handles PAD selections and checkout processing
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPD_Checkout_Handler {

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
		// Handle AJAX requests
		add_action( 'wp_ajax_wpd_save_selection', array( $this, 'save_pad_selection' ) );
		add_action( 'wp_ajax_nopriv_wpd_save_selection', array( $this, 'save_pad_selection' ) );

		add_action( 'wp_ajax_wpd_calculate_shipping', array( $this, 'calculate_shipping' ) );
		add_action( 'wp_ajax_nopriv_wpd_calculate_shipping', array( $this, 'calculate_shipping' ) );

		// NEW: API handlers for dates
		add_action( 'wp_ajax_wpd_get_pickup_dates', array( $this, 'get_pickup_dates_from_api' ) );
		add_action( 'wp_ajax_nopriv_wpd_get_pickup_dates', array( $this, 'get_pickup_dates_from_api' ) );

		add_action( 'wp_ajax_wpd_get_delivery_dates', array( $this, 'get_delivery_dates_from_api' ) );
		add_action( 'wp_ajax_nopriv_wpd_get_delivery_dates', array( $this, 'get_delivery_dates_from_api' ) );

		// Add hidden fields to checkout
		add_action( 'woocommerce_after_order_notes', array( $this, 'add_checkout_fields' ) );
	}

	/**
	 * Suburbs allowed for delivery (Delivery settings). Empty = no restriction.
	 *
	 * @return string[]
	 */
	private function get_allowed_delivery_suburbs() {
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
		return array_values( array_filter( array_map( 'trim', array_map( 'strval', $list ) ) ) );
	}

	/**
	 * When suburbs are configured, only those values are accepted (case-insensitive). Returns canonical spelling or empty.
	 *
	 * @param string $suburb Posted suburb.
	 * @return string
	 */
	private function resolve_delivery_suburb( $suburb ) {
		$allowed = $this->get_allowed_delivery_suburbs();
		if ( empty( $allowed ) ) {
			return trim( (string) $suburb );
		}
		$want = trim( (string) $suburb );
		foreach ( $allowed as $a ) {
			if ( strtolower( $a ) === strtolower( $want ) ) {
				return $a;
			}
		}
		return '';
	}

	/**
	 * Sanitized POST string (unslashed).
	 *
	 * @param string $key      POST key.
	 * @param string $fallback Value if missing.
	 * @return string
	 */
	private function get_post_string( $key, $fallback = '' ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Caller verifies nonce before reading POST.
		if ( ! isset( $_POST[ $key ] ) ) {
			return $fallback;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Caller verifies nonce before reading POST.
		return sanitize_text_field( wp_unslash( $_POST[ $key ] ) );
	}

	/**
	 * Sanitized POST textarea (unslashed).
	 *
	 * @param string $key      POST key.
	 * @param string $fallback Value if missing.
	 * @return string
	 */
	private function get_post_textarea( $key, $fallback = '' ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Caller verifies nonce before reading POST.
		if ( ! isset( $_POST[ $key ] ) ) {
			return $fallback;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Caller verifies nonce before reading POST.
		return sanitize_textarea_field( wp_unslash( $_POST[ $key ] ) );
	}

	/**
	 * NEW: Get pickup dates from API
	 */
	public function get_pickup_dates_from_api() {
		// Verify nonce
		$nonce = $this->get_post_string( 'nonce' );
		if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wpd_nonce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Security check failed', 'eux-pickup-delivery' ) ) );
		}

		// Get cart items
		$cart_items = $this->prepare_cart_data();

		if ( empty( $cart_items ) ) {
			wp_send_json_error( array( 'message' => __( 'Cart is empty', 'eux-pickup-delivery' ) ) );
		}

		// Call REST API
		$api_url = rest_url( 'eux-pad/v1/pickup-dates' );

		$body            = array(
			'cart_items' => $cart_items,
		);
		$pickup_store_id = $this->get_post_string( 'pickup_store_id' );
		if ( '' !== $pickup_store_id ) {
			$body['store_id'] = $pickup_store_id;
		}

		$response = wp_remote_post(
			$api_url,
			array(
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode( $body ),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Failed to fetch pickup dates', 'eux-pickup-delivery' ),
					'error'   => $response->get_error_message(),
				)
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( isset( $data['success'] ) && $data['success'] ) {
			wp_send_json_success( $data['data'] );
		} else {
			wp_send_json_error(
				array(
					'message' => __( 'Invalid API response', 'eux-pickup-delivery' ),
				)
			);
		}
	}

	/**
	 * NEW: Get delivery dates from API
	 */
	public function get_delivery_dates_from_api() {
		// Verify nonce
		$nonce = $this->get_post_string( 'nonce' );
		if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wpd_nonce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Security check failed', 'eux-pickup-delivery' ) ) );
		}

		// Get cart items
		$cart_items = $this->prepare_cart_data();

		if ( empty( $cart_items ) ) {
			wp_send_json_error( array( 'message' => __( 'Cart is empty', 'eux-pickup-delivery' ) ) );
		}

		// Get delivery address
		$delivery_address           = array(
			'street_address' => $this->get_post_string( 'street_address' ),
			'suburb'         => $this->get_post_string( 'suburb' ),
			'state'          => $this->get_post_string( 'state' ),
			'postcode'       => $this->get_post_string( 'postcode' ),
		);
		$delivery_address['suburb'] = $this->resolve_delivery_suburb( $delivery_address['suburb'] );

		// Validate address
		if ( empty( $delivery_address['street_address'] ) || empty( $delivery_address['suburb'] ) ||
			empty( $delivery_address['state'] ) || empty( $delivery_address['postcode'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Complete address is required', 'eux-pickup-delivery' ) ) );
		}

		// Call REST API
		$api_url = rest_url( 'eux-pad/v1/delivery-dates' );

		$response = wp_remote_post(
			$api_url,
			array(
				'headers' => array( 'Content-Type' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'cart_items'       => $cart_items,
						'delivery_address' => $delivery_address,
					)
				),
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Failed to fetch delivery dates', 'eux-pickup-delivery' ),
					'error'   => $response->get_error_message(),
				)
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( isset( $data['success'] ) && $data['success'] ) {
			wp_send_json_success( $data['data'] );
		} else {
			wp_send_json_error(
				array(
					'message' => __( 'Invalid API response', 'eux-pickup-delivery' ),
				)
			);
		}
	}

	/**
	 * NEW: Prepare cart data for API
	 */
	private function prepare_cart_data() {
		if ( WC()->cart->is_empty() ) {
			return array();
		}

		$cart_items = array();

		foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {
			$product = $cart_item['data'];

			if ( ! $product ) {
				continue;
			}

			$cart_items[] = array(
				'product_id'   => $cart_item['product_id'],
				'variation_id' => $cart_item['variation_id'],
				'quantity'     => $cart_item['quantity'],
				'price'        => floatval( $product->get_price() ),
				'subtotal'     => floatval( $cart_item['line_subtotal'] ),
				'total'        => floatval( $cart_item['line_total'] ),
				'weight'       => floatval( $product->get_weight() ),
				'dimensions'   => array(
					'length' => floatval( $product->get_length() ),
					'width'  => floatval( $product->get_width() ),
					'height' => floatval( $product->get_height() ),
				),
				'name'         => $product->get_name(),
				'sku'          => $product->get_sku(),
				'categories'   => wp_get_post_terms( $cart_item['product_id'], 'product_cat', array( 'fields' => 'ids' ) ),
				'tags'         => wp_get_post_terms( $cart_item['product_id'], 'product_tag', array( 'fields' => 'ids' ) ),
			);
		}

		return $cart_items;
	}

	/**
	 * Calculate shipping rates for given address using WooCommerce packages
	 */
	public function calculate_shipping() {
		// Verify nonce
		$nonce = $this->get_post_string( 'nonce' );
		if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wpd_nonce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Security check failed', 'eux-pickup-delivery' ) ) );
		}

		// Get address data and type
		$type           = $this->get_post_string( 'type', 'delivery' );
		$street_address = $this->get_post_string( 'street_address' );
		$suburb         = $this->get_post_string( 'suburb' );
		$state          = $this->get_post_string( 'state' );
		$postcode       = $this->get_post_string( 'postcode' );
		if ( 'delivery' === $type ) {
			$suburb = $this->resolve_delivery_suburb( $suburb );
		}

		// For delivery, validate address
		if ( 'delivery' === $type && ( empty( $street_address ) || empty( $suburb ) || empty( $postcode ) ) ) {
			wp_send_json_error( array( 'message' => __( 'Please fill all required fields', 'eux-pickup-delivery' ) ) );
		}

		// Check if cart has items
		if ( WC()->cart->is_empty() ) {
			wp_send_json_error( array( 'message' => __( 'Your cart is empty. Please add items to cart first.', 'eux-pickup-delivery' ) ) );
		}

		// Build shipping package from cart
		$cart_items = WC()->cart->get_cart();
		$package    = $this->build_shipping_package( $cart_items, $postcode, 'AU', $state, $suburb, $street_address );

		// Reset shipping to avoid conflicts
		WC()->shipping()->reset_shipping();

		// Calculate shipping using WooCommerce
		$packages = array( 0 => $package );
		WC()->shipping()->calculate_shipping( $packages );

		// Get calculated packages
		$calculated_packages = WC()->shipping()->get_packages();

		$shipping_methods = array();

		if ( ! empty( $calculated_packages ) ) {
			foreach ( $calculated_packages as $package_key => $calc_package ) {
				if ( ! empty( $calc_package['rates'] ) ) {
					foreach ( $calc_package['rates'] as $rate ) {
						$method_id = $rate->get_method_id();
						$is_pickup = $this->is_pickup_method( $rate );

						// For pickup, only return pickup methods
						if ( 'pickup' === $type && $is_pickup ) {
							// Format cost as plain text
							$cost_value = floatval( $rate->get_cost() );
							if ( $cost_value > 0 ) {
								$cost_display = html_entity_decode( wp_strip_all_tags( wc_price( $cost_value ) ) );
							} else {
								$cost_display = __( 'Free', 'eux-pickup-delivery' );
							}

							wp_send_json_success(
								array(
									'shipping_method' => array(
										'id'          => $rate->get_id(),
										'method_id'   => $method_id,
										'instance_id' => $rate->get_instance_id(),
										'title'       => $rate->get_label(),
										'cost'        => $cost_display,
										'cost_raw'    => $cost_value,
									),
								)
							);
							return;
						}

						// For delivery, exclude ALL pickup methods
						if ( 'delivery' === $type && ! $is_pickup ) {
							// Format cost as plain text
							$cost_value = floatval( $rate->get_cost() );
							if ( $cost_value > 0 ) {
								$cost_display = html_entity_decode( wp_strip_all_tags( wc_price( $cost_value ) ) );
							} else {
								$cost_display = __( 'Free', 'eux-pickup-delivery' );
							}

							$shipping_methods[] = array(
								'id'          => $rate->get_id(),
								'method_id'   => $method_id,
								'instance_id' => $rate->get_instance_id(),
								'title'       => $rate->get_label(),
								'cost'        => $cost_display,
								'cost_raw'    => floatval( $cost_value ),
							);
						}
					}
				}
			}
		}

		// For pickup
		if ( 'pickup' === $type ) {
			wp_send_json_error(
				array(
					'message' => __( "Shipping or Pickup hasn't been configured for this address, for more information please contact the store owner.", 'eux-pickup-delivery' ),
				)
			);
			return;
		}

		// For delivery
		if ( ! empty( $shipping_methods ) ) {
			/*
			 * Free shipping: WooCommerce only adds `free_shipping` rates when the method is enabled
			 * and the customer meets its rules (min spend, coupon, etc.).
			 * If they qualify, show only those options; otherwise show flat rate / other paid methods.
			 */
			$free_shipping_only = array_values(
				array_filter(
					$shipping_methods,
					function ( $method ) {
						return isset( $method['method_id'] ) && 'free_shipping' === $method['method_id'];
					}
				)
			);

			if ( ! empty( $free_shipping_only ) ) {
				$shipping_methods = $free_shipping_only;
			}

			// Sort by cost (cheapest first)
			usort(
				$shipping_methods,
				function ( $a, $b ) {
					return $a['cost_raw'] <=> $b['cost_raw'];
				}
			);

			wp_send_json_success(
				array(
					'shipping_methods' => $shipping_methods,
				)
			);
		} else {
			wp_send_json_error(
				array(
					'message' => __( "Shipping or Pickup hasn't been configured for this address, for more information please contact the store owner.", 'eux-pickup-delivery' ),
				)
			);
		}
	}

	/**
	 * Build shipping package from cart items
	 */
	private function build_shipping_package( $cart_items, $postcode, $country, $state, $city, $address ) {
		$package = array(
			'contents'        => array(),
			'contents_cost'   => 0,
			'applied_coupons' => array(),
			'user'            => array( 'ID' => get_current_user_id() ),
			'destination'     => array(
				'country'   => $country,
				'state'     => $state,
				'postcode'  => $postcode,
				'city'      => $city,
				'address'   => $address,
				'address_2' => '',
			),
		);

		foreach ( $cart_items as $item_key => $item ) {
			$product = $item['data'];

			if ( $product ) {
				$package['contents'][ $item_key ] = array(
					'key'               => $item_key,
					'product_id'        => $item['product_id'],
					'variation_id'      => $item['variation_id'],
					'variation'         => $item['variation'],
					'quantity'          => $item['quantity'],
					'data'              => $product,
					'data_hash'         => wc_get_cart_item_data_hash( $product ),
					'line_tax_data'     => $item['line_tax_data'],
					'line_subtotal'     => $item['line_subtotal'],
					'line_subtotal_tax' => $item['line_subtotal_tax'],
					'line_total'        => $item['line_total'],
					'line_tax'          => $item['line_tax'],
				);

				$package['contents_cost'] += $item['line_total'];
			}
		}

		return $package;
	}

	/**
	 * Check if a shipping method is a pickup method
	 */
	private function is_pickup_method( $rate ) {
		$method_id = '';
		$label     = '';

		if ( is_object( $rate ) && method_exists( $rate, 'get_method_id' ) ) {
			$method_id = $rate->get_method_id();
			$label     = $rate->get_label();
		}

		$method_id = strtolower( $method_id );
		$label     = strtolower( $label );

		$pickup_identifiers = array(
			'local_pickup',
			'local-pickup',
			'pickup',
			'pick-up',
			'pick_up',
			'collection',
			'store pickup',
			'in-store',
			'in_store',
			'click and collect',
			'click_and_collect',
		);

		foreach ( $pickup_identifiers as $identifier ) {
			if ( false !== strpos( $method_id, $identifier ) || false !== strpos( $label, $identifier ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Build PAD session address for pickup: multi-store row when applicable, else merged global Pickup settings.
	 *
	 * @param string $pickup_store_id Posted store id (empty for single-store PAD).
	 * @return array{street_address:string,suburb:string,state:string,postcode:string,country:string}
	 */
	private function build_pickup_session_checkout_address( $pickup_store_id ) {
		$pickup_store_id = sanitize_text_field( (string) $pickup_store_id );
		$store_row       = null;

		if ( class_exists( 'WPD_Multi_Store' ) ) {
			$list = WPD_Multi_Store::sanitize_stores_list( get_option( 'wpd_multi_pickup_stores', array() ) );
			if ( '' !== $pickup_store_id ) {
				foreach ( $list as $cand ) {
					if ( empty( $cand['enabled'] ) ) {
						continue;
					}
					if ( isset( $cand['id'] ) && (string) $cand['id'] === $pickup_store_id ) {
						$store_row = $cand;
						break;
					}
				}
			} elseif ( ! empty( $list ) ) {
				foreach ( $list as $cand ) {
					if ( ! empty( $cand['enabled'] ) ) {
						$store_row = $cand;
						break;
					}
				}
			}
			if ( $store_row ) {
				return WPD_Multi_Store::store_row_to_checkout_address( $store_row );
			}
		}

		$saved    = get_option( WPD_Settings::OPTION_PICKUP, array() );
		$defaults = WPD_Settings::get_instance()->get_pickup_defaults();
		$merged   = WPD_Settings::get_instance()->merge_pickup_settings( $defaults, is_array( $saved ) ? $saved : array() );
		$merged   = WPD_Settings::get_instance()->apply_inactive_multi_store_pickup_fallback( $merged );

		return WPD_Settings::get_instance()->pickup_location_to_checkout_address( $merged );
	}

	/**
	 * Save PAD selection via AJAX
	 */
	public function save_pad_selection() {
		// Verify nonce
		if ( ! check_ajax_referer( 'wpd_nonce', 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid nonce', 'eux-pickup-delivery' ) ) );
			return;
		}

		// Get posted data
		$type            = $this->get_post_string( 'type' );
		$date            = $this->get_post_string( 'date' );
		$time_slot       = $this->get_post_string( 'time_slot' );
		$shipping_method = $this->get_post_string( 'shipping_method' );

		// For delivery, get address details
		$address_data = array();
		if ( 'delivery' === $type ) {
			$address_data           = array(
				'street_address' => $this->get_post_string( 'street_address' ),
				'suburb'         => $this->get_post_string( 'suburb' ),
				'state'          => $this->get_post_string( 'state' ),
				'postcode'       => $this->get_post_string( 'postcode' ),
				'instructions'   => $this->get_post_textarea( 'instructions' ),
			);
			$address_data['suburb'] = $this->resolve_delivery_suburb( $address_data['suburb'] );
			if ( empty( $address_data['street_address'] ) || empty( $address_data['suburb'] ) || empty( $address_data['state'] ) || empty( $address_data['postcode'] ) ) {
				wp_send_json_error( array( 'message' => __( 'Please choose a valid delivery suburb and complete the address.', 'eux-pickup-delivery' ) ) );
				return;
			}
			$address_data['country'] = 'AU';
		}

		$session_address = ( 'delivery' === $type ) ? $address_data : array();

		// Store in session with 5 minute expiry
		$selection_data = array(
			'type'            => $type,
			'date'            => $date,
			'time_slot'       => $time_slot,
			'shipping_method' => $shipping_method,
			'address'         => $session_address,
			'timestamp'       => time(), // Store timestamp for expiry check
		);

		if ( 'pickup' === $type ) {
			$pickup_store_id   = $this->get_post_string( 'pickup_store_id' );
			$pickup_store_name = $this->get_post_string( 'pickup_store_name' );
			if ( '' !== $pickup_store_id ) {
				$selection_data['pickup_store_id'] = $pickup_store_id;
			}
			if ( '' !== $pickup_store_name ) {
				$selection_data['pickup_store_name'] = $pickup_store_name;
			}
			// PAD only sends pickup_store_id when Multi-Store is on; single-store pickup must still populate WC shipping fields.
			$selection_data['address'] = $this->build_pickup_session_checkout_address( $pickup_store_id );
		}

		WC()->session->set( 'wpd_pad_selection', $selection_data );

		// IMPORTANT: Set the chosen shipping method immediately
		if ( ! empty( $shipping_method ) ) {
			// Set customer shipping from PAD (delivery address or pickup store).
			$customer = WC()->customer;
			if ( $customer ) {
				if ( 'delivery' === $type && ! empty( $address_data ) ) {
					$customer->set_shipping_address_1( $address_data['street_address'] );
					$customer->set_shipping_city( $address_data['suburb'] );
					$customer->set_shipping_state( $address_data['state'] );
					$customer->set_shipping_postcode( $address_data['postcode'] );
					$customer->set_shipping_country( isset( $address_data['country'] ) ? (string) $address_data['country'] : 'AU' );
					$customer->save();
				} elseif ( 'pickup' === $type && ! empty( $selection_data['address'] ) && is_array( $selection_data['address'] ) ) {
					$pad_addr = $selection_data['address'];
					$country  = isset( $pad_addr['country'] ) && '' !== (string) $pad_addr['country'] ? (string) $pad_addr['country'] : 'AU';
					$customer->set_shipping_address_1( isset( $pad_addr['street_address'] ) ? (string) $pad_addr['street_address'] : '' );
					$customer->set_shipping_city( isset( $pad_addr['suburb'] ) ? (string) $pad_addr['suburb'] : '' );
					$customer->set_shipping_state( isset( $pad_addr['state'] ) ? (string) $pad_addr['state'] : '' );
					$customer->set_shipping_postcode( isset( $pad_addr['postcode'] ) ? (string) $pad_addr['postcode'] : '' );
					$customer->set_shipping_country( $country );
					$customer->save();
				}
			}

			// Clear cache and calculate shipping first
			WC()->session->set( 'shipping_for_package_0', false );
			WC()->cart->calculate_shipping();

			// Set chosen shipping method
			WC()->session->set( 'chosen_shipping_methods', array( 0 => $shipping_method ) );

			// Recalculate totals
			WC()->cart->calculate_totals();
		}

		// Set flag that user is coming from PAD page
		WC()->session->set( 'wpd_from_pad_page', true );

		// Return checkout URL
		wp_send_json_success(
			array(
				'checkout_url' => wc_get_checkout_url(),
				'message'      => 'Selection saved successfully',
			)
		);
	}

	/**
	 * Add hidden fields to checkout
	 */
	public function add_checkout_fields( $checkout ) {
		$selection = WC()->session->get( 'wpd_pad_selection' );

		if ( empty( $selection ) ) {
			return;
		}

		echo '<div id="wpd_checkout_fields" style="display:none;">';

		woocommerce_form_field(
			'wpd_type',
			array(
				'type'     => 'hidden',
				'class'    => array( 'wpd-hidden-field' ),
				'required' => true,
			),
			$selection['type']
		);

		woocommerce_form_field(
			'wpd_date',
			array(
				'type'     => 'hidden',
				'class'    => array( 'wpd-hidden-field' ),
				'required' => true,
			),
			$selection['date']
		);

		woocommerce_form_field(
			'wpd_time_slot',
			array(
				'type'  => 'hidden',
				'class' => array( 'wpd-hidden-field' ),
			),
			$selection['time_slot']
		);

		if ( ! empty( $selection['address'] ) ) {
			woocommerce_form_field(
				'wpd_address',
				array(
					'type'  => 'hidden',
					'class' => array( 'wpd-hidden-field' ),
				),
				wp_json_encode( $selection['address'] )
			);
		}

		echo '</div>';
	}
}
