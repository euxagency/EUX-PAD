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

		// Add JavaScript to modify checkout steps
		add_action( 'wp_footer', array( $this, 'add_checkout_steps_js' ) );
	}

	/**
	 * Add JavaScript to modify existing checkout steps
	 */
	public function add_checkout_steps_js() {
		if ( class_exists( 'WPD_Settings' ) && ! WPD_Settings::get_instance()->is_checkout_progress_bar_enabled() ) {
			return;
		}

		// Only on cart, PAD, or checkout pages
		$pad_page_id = get_option( 'wpd_pad_page_id' );

		if ( ! is_cart() && ! is_checkout() && ! is_page( $pad_page_id ) ) {
			return;
		}

		$pad_step_enabled = true;
		if ( class_exists( 'WPD_Settings' ) ) {
			$pad_step_enabled = WPD_Settings::get_instance()->is_pad_step_enabled();
		}

		// Determine current page
		$current_page = 'cart';
		if ( is_page( $pad_page_id ) ) {
			$current_page = 'pad';
		} elseif ( is_checkout() && ! is_order_received_page() ) {
			$current_page = 'checkout';
		} elseif ( is_order_received_page() ) {
			$current_page = 'complete';
		}

		?>
		<script>
		jQuery(document).ready(function($) {
			var currentPage = '<?php echo esc_js( $current_page ); ?>';
			var wpdPadStepEnabled = <?php echo $pad_step_enabled ? 'true' : 'false'; ?>;
			var padUrl = '<?php echo esc_js( get_permalink( $pad_page_id ) ); ?>';
			var checkoutUrl = '<?php echo esc_js( wc_get_checkout_url() ); ?>';
			var cartUrl = '<?php echo esc_js( wc_get_cart_url() ); ?>';
			
			// Find the existing checkout steps
			var $steps = $('.wd-checkout-steps');
			
			// If steps don't exist (PAD page), create them
			if ($steps.length === 0) {
				console.log('WPD: Creating checkout steps (not found)');
				
				// Find the container in page title area
				var $container = $('.wd-page-title .container');
				
				if ($container.length === 0) {
					return; // Can't find container
				}
				
				// For PAD page: hide title and breadcrumbs first
				if (currentPage === 'pad') {
					$container.find('h1.entry-title, h1.title, .wd-breadcrumbs').hide();
				}
				
				// Create steps using jQuery (not HTML string) for proper formatting
				var $newSteps = $('<ul class="wd-checkout-steps"></ul>');
				
				// Create each step as a proper jQuery element
				var $cartStep = $('<li class="step-cart"></li>');
				$cartStep.append($('<a href="' + cartUrl + '"></a>').append($('<span>Shopping cart</span>')));
				
				var $padStep = $('<li class="step-pad"></li>');
				$padStep.append($('<a href="' + padUrl + '"></a>').append($('<span>Pickup & Delivery</span>')));
				
				var $checkoutStep = $('<li class="step-checkout"></li>');
				$checkoutStep.append($('<a href="' + checkoutUrl + '"></a>').append($('<span>Checkout</span>')));
				
				var $completeStep = $('<li class="step-complete"></li>');
				$completeStep.append($('<span>Order complete</span>'));
				
				// Append all steps (omit PAD when both pickup & delivery are off in global settings)
				$newSteps.append($cartStep);
				if (wpdPadStepEnabled) {
					$newSteps.append($padStep);
				}
				$newSteps.append($checkoutStep);
				$newSteps.append($completeStep);
				
				// Prepend to container
				$container.prepend($newSteps);
				
				$steps = $('.wd-checkout-steps');
			} else {
				console.log('WPD: Modifying existing checkout steps');
				
				// Get existing steps
				var $cartStep = $steps.find('.step-cart');
				var $checkoutStep = $steps.find('.step-checkout');
				var $completeStep = $steps.find('.step-complete');
				
				if ($cartStep.length === 0 || $checkoutStep.length === 0) {
					return; // Required steps not found
				}

				if (!wpdPadStepEnabled) {
					$steps.find('.step-pad').remove();
				} else {
					if ($steps.find('.step-pad').length === 0) {
						var $padStepNew = $('<li class="step-pad"></li>');
						var $padLink = $('<a href="' + padUrl + '"><span>Pickup & Delivery</span></a>');
						$padStepNew.append($padLink);
						$cartStep.after($padStepNew);
					}
				}
				
				// Update the checkout step's link to point to checkout
				$checkoutStep.find('a').attr('href', checkoutUrl);
				$checkoutStep.find('span').text('Checkout');
			}
			
			// Set appropriate classes based on current page
			$steps.find('li').removeClass('step-active step-complete step-inactive');
			
			var $cartStep = $steps.find('.step-cart');
			var $padStep = $steps.find('.step-pad');
			var $checkoutStep = $steps.find('.step-checkout');
			var $completeStep = $steps.find('li').last(); // Last step
			
			// Ensure complete step has proper class
			if (!$completeStep.hasClass('step-complete')) {
				$completeStep.addClass('step-complete');
			}
			
			if (wpdPadStepEnabled) {
				switch(currentPage) {
					case 'cart':
						$cartStep.addClass('step-active');
						$padStep.addClass('step-inactive');
						$checkoutStep.addClass('step-inactive');
						$completeStep.addClass('step-inactive');
						break;
						
					case 'pad':
						$cartStep.addClass('step-complete');
						$padStep.addClass('step-active');
						$checkoutStep.addClass('step-inactive');
						$completeStep.addClass('step-inactive');
						break;
						
					case 'checkout':
						$cartStep.addClass('step-complete');
						$padStep.addClass('step-complete');
						$checkoutStep.addClass('step-active');
						$completeStep.addClass('step-inactive');
						break;
						
					case 'complete':
						$cartStep.addClass('step-complete');
						$padStep.addClass('step-complete');
						$checkoutStep.addClass('step-complete');
						$completeStep.addClass('step-active');
						break;
				}
			} else {
				switch(currentPage) {
					case 'cart':
						$cartStep.addClass('step-active');
						$checkoutStep.addClass('step-inactive');
						$completeStep.addClass('step-inactive');
						break;
					case 'pad':
						// Unusual: PAD page with both methods off (normally redirects)
						$cartStep.addClass('step-complete');
						$checkoutStep.addClass('step-active');
						$completeStep.addClass('step-inactive');
						break;
					case 'checkout':
						$cartStep.addClass('step-complete');
						$checkoutStep.addClass('step-active');
						$completeStep.addClass('step-inactive');
						break;
					case 'complete':
						$cartStep.addClass('step-complete');
						$checkoutStep.addClass('step-complete');
						$completeStep.addClass('step-active');
						break;
				}
			}
			
			console.log('WPD: Checkout steps updated (PAD step: ' + (wpdPadStepEnabled ? 'on' : 'off') + ') - current page: ' + currentPage);
		});
		</script>
		<?php
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
			return '<div class="woocommerce-info">' . esc_html__( 'Your cart is empty.', 'eux-pad' ) . '</div>';
		}

		// Start output buffering
		ob_start();

		// Include template
		include WPD_PLUGIN_DIR . 'templates/pad-page.php';

		return ob_get_clean();
	}
}