<?php
/**
 * Cart Redirect Class
 * Handles redirecting from cart to PAD page and preventing direct checkout access
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPD_Cart_Redirect {

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
		// Redirect from cart to PAD page
		add_action( 'template_redirect', array( $this, 'redirect_to_pad' ) );

		// Modify cart checkout button
		add_filter( 'woocommerce_cart_needs_payment', array( $this, 'modify_cart_checkout' ), 10, 2 );

		// Change proceed to checkout URL
		add_filter( 'woocommerce_get_checkout_url', array( $this, 'change_checkout_url' ), 10, 1 );
	}

	/**
	 * Check whether PAD step is enabled (at least one tab enabled).
	 *
	 * @return bool
	 */
	private function is_pad_enabled() {
		if ( class_exists( 'WPD_Settings' ) ) {
			return WPD_Settings::get_instance()->is_pad_step_enabled();
		}
		return true;
	}

	/**
	 * Redirect to PAD page if trying to access checkout directly
	 */
	public function redirect_to_pad() {
		// If PAD is disabled in settings, allow checkout directly.
		if ( ! $this->is_pad_enabled() ) {
			return;
		}

		// Check if we're on checkout page (but not order-received endpoint)
		if ( is_checkout() && ! is_wc_endpoint_url( 'order-received' ) && ! is_wc_endpoint_url( 'order-pay' ) ) {
			// Check if coming from PAD page with valid selection
			$pad_selection = WC()->session->get( 'wpd_pad_selection' );
			$from_pad_page = WC()->session->get( 'wpd_from_pad_page' );

			// Check if session has expired (5 minutes = 300 seconds)
			$session_expired = false;
			if ( ! empty( $pad_selection ) && isset( $pad_selection['timestamp'] ) ) {
				$time_elapsed = time() - $pad_selection['timestamp'];
				if ( $time_elapsed > 300 ) {
					$session_expired = true;
					// Clear expired session
					WC()->session->__unset( 'wpd_pad_selection' );
					WC()->session->__unset( 'wpd_from_pad_page' );
				}
			}

			// If no selection OR not coming from PAD page OR session expired, redirect
			if ( empty( $pad_selection ) || empty( $from_pad_page ) || $session_expired ) {
				// Clear the flag
				WC()->session->__unset( 'wpd_from_pad_page' );

				// Redirect to PAD page
				$pad_url = WPD_Page_Manager::get_pad_page_url();
				if ( $pad_url ) {
					wp_safe_redirect( $pad_url );
					exit;
				}
			}

			// Clear the flag after successful access
			WC()->session->__unset( 'wpd_from_pad_page' );
		}
	}

	/**
	 * Modify cart checkout behavior
	 */
	public function modify_cart_checkout( $needs_payment, $cart ) {
		return $needs_payment;
	}

	/**
	 * Change checkout URL to PAD page URL
	 */
	public function change_checkout_url( $checkout_url ) {
		// Only change on cart page
		if ( is_cart() ) {
			if ( ! $this->is_pad_enabled() ) {
				return $checkout_url;
			}
			$pad_url = WPD_Page_Manager::get_pad_page_url();
			if ( $pad_url ) {
				return $pad_url;
			}
		}

		return $checkout_url;
	}
}
