<?php
/**
 * Page Manager Class
 * Handles PAD page operations
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPD_Page_Manager {

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
		add_shortcode( 'wpd_pickup_delivery', array( $this, 'render_pad_page' ) );

		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_checkout_progress_script' ), 25 );
	}

	/**
	 * Checkout progress step indicator (cart → PAD → checkout → complete).
	 */
	public function enqueue_checkout_progress_script() {
		if ( class_exists( 'WPD_Settings' ) && ! WPD_Settings::get_instance()->is_checkout_progress_bar_enabled() ) {
			return;
		}

		$pad_page_id = (int) get_option( 'wpd_pad_page_id', 0 );
		if ( ! is_cart() && ! is_checkout() && ! is_page( $pad_page_id ) ) {
			return;
		}

		$pad_step_enabled = true;
		if ( class_exists( 'WPD_Settings' ) ) {
			$pad_step_enabled = WPD_Settings::get_instance()->is_pad_step_enabled();
		}

		$current_page = 'cart';
		if ( is_page( $pad_page_id ) ) {
			$current_page = 'pad';
		} elseif ( is_checkout() && ! is_order_received_page() ) {
			$current_page = 'checkout';
		} elseif ( is_order_received_page() ) {
			$current_page = 'complete';
		}

		$script_path = WPD_PLUGIN_DIR . 'assets/js/wpd-checkout-progress.js';
		if ( ! file_exists( $script_path ) ) {
			return;
		}

		wp_enqueue_script(
			'wpd-checkout-progress',
			WPD_PLUGIN_URL . 'assets/js/wpd-checkout-progress.js',
			array( 'jquery' ),
			(string) filemtime( $script_path ),
			true
		);

		wp_localize_script(
			'wpd-checkout-progress',
			'wpdCheckoutProgress',
			array(
				'currentPage'    => $current_page,
				'padStepEnabled' => (bool) $pad_step_enabled,
				'padUrl'         => $pad_page_id ? (string) get_permalink( $pad_page_id ) : '',
				'checkoutUrl'    => function_exists( 'wc_get_checkout_url' ) ? (string) wc_get_checkout_url() : '',
				'cartUrl'        => function_exists( 'wc_get_cart_url' ) ? (string) wc_get_cart_url() : '',
			)
		);
	}

	/**
	 * Get PAD page ID
	 */
	public static function get_pad_page_id() {
		return get_option( 'wpd_pad_page_id', 0 );
	}

	/**
	 * Get PAD page URL
	 */
	public static function get_pad_page_url() {
		$page_id = self::get_pad_page_id();
		if ( $page_id ) {
			return get_permalink( $page_id );
		}
		return '';
	}

	/**
	 * Render PAD page shortcode
	 */
	public function render_pad_page( $atts ) {
		// Check if cart is empty
		// Ensure WooCommerce is loaded
		if ( ! did_action( 'woocommerce_init' ) ) {
			do_action( 'woocommerce_init' );
		}

		// Ensure cart is initialized
		if ( ! WC()->cart ) {
			WC()->initialize_cart();
		}

		// If both pickup and delivery are disabled, skip PAD page entirely.
		if ( class_exists( 'WPD_Settings' ) && ! WPD_Settings::get_instance()->is_pad_step_enabled() ) {
			wp_safe_redirect( wc_get_checkout_url() );
			exit;
		}

		// Now safe to check cart
		if ( WC()->cart->is_empty() ) {
			return '<div class="woocommerce-info">' . esc_html__( 'Your cart is empty.', 'eux-pickup-delivery' ) . '</div>';
		}

		// Start output buffering
		ob_start();

		// Include template
		include WPD_PLUGIN_DIR . 'templates/pad-page.php';

		return ob_get_clean();
	}
}
