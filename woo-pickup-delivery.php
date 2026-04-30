<?php
/**
 * The plugin bootstrap file
 *
 * This file is read by WordPress to generate the plugin information in the plugin
 * admin area. This file also includes all of the dependencies used by the plugin,
 * registers the activation and deactivation functions, and defines a function
 * that starts the plugin.
 *
 * @link              https://eux.com.au
 * @since             1.0.0
 * @package           EUX Pickup & Delivery
 *
 * @wordpress-plugin
 * Plugin Name:             EUX Pickup & Delivery
 * Plugin URI:              https://eux.com.au/product/improved-delivery-and-pick-up-for-woocommerce/
 * Description:             Enhance your WooCommerce store with a Pickup & Delivery system for your customers.
 * Version:                 1.0.1
 * Requires at least:       5.0
 * Requires PHP:            7.4
 * Tested up to:            6.9
 * WC requires at least:    7.0
 * WC tested up to:         9.5
 * Author:                  EUX
 * Author URI:              https://eux.com.au
 * License:                 GPL-2.0-or-later
 * License URI:             http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:             eux-pickup-delivery
 */



// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define plugin constants
define( 'WPD_VERSION', '1.0.1' );
define( 'WPD_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'WPD_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'WPD_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );


add_action(
	'before_woocommerce_init',
	function () {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
		}
	}
);
/**
 * Main plugin class (unique prefix for WordPress.org).
 */
class EUXPIDE_PickupDelivery {

	/**
	 * Single instance of the class
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
		// Check if WooCommerce is active
		if ( ! $this->is_woocommerce_active() ) {
			add_action( 'admin_notices', array( $this, 'woocommerce_missing_notice' ) );
			return;
		}

		// Initialize plugin
		add_action( 'plugins_loaded', array( $this, 'init' ) );

		// Activation hook
		register_activation_hook( __FILE__, array( $this, 'activate' ) );

		// Deactivation hook
		register_deactivation_hook( __FILE__, array( $this, 'deactivate' ) );
	}

	/**
	 * Check if WooCommerce is active
	 */
	private function is_woocommerce_active() {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		return is_plugin_active( 'woocommerce/woocommerce.php' );
	}

	/**
	 * WooCommerce missing notice
	 */
	public function woocommerce_missing_notice() {
		?>
		<div class="notice notice-error">
			<p><?php esc_html_e( 'WooCommerce Pickup and Delivery requires WooCommerce to be installed and active.', 'eux-pickup-delivery' ); ?></p>
		</div>
		<?php
	}



	/**
	 * Initialize plugin
	 */
	public function init() {
		// Load text domain
		load_plugin_textdomain( 'eux-pickup-delivery', false, dirname( WPD_PLUGIN_BASENAME ) . '/languages' );

		// Include required files
		$this->includes();

		// Initialize hooks
		$this->init_hooks();
	}

	/**
	 * Include required files
	 */
	private function includes() {
		require_once WPD_PLUGIN_DIR . 'includes/class-wpd-page-manager.php';
		require_once WPD_PLUGIN_DIR . 'includes/class-wpd-cart-redirect.php';
		require_once WPD_PLUGIN_DIR . 'includes/class-wpd-checkout-handler.php';
		require_once WPD_PLUGIN_DIR . 'includes/class-wpd-order-meta.php';
		require_once WPD_PLUGIN_DIR . 'includes/class-wpd-admin.php';
		require_once WPD_PLUGIN_DIR . 'includes/class-wpd-settings.php';
		require_once WPD_PLUGIN_DIR . 'includes/class-wpd-rules.php';
		require_once WPD_PLUGIN_DIR . 'includes/class-wpd-frontend.php';
		require_once WPD_PLUGIN_DIR . 'includes/class-wpd-api.php';
	}

	/**
	 * Initialize hooks
	 */
	private function init_hooks() {
		// Initialize classes
		WPD_Page_Manager::get_instance();
		WPD_Cart_Redirect::get_instance();
		WPD_Checkout_Handler::get_instance();
		WPD_Order_Meta::get_instance();
		WPD_Admin::get_instance();
		WPD_Settings::get_instance();
		WPD_Frontend::get_instance();
	}

	/**
	 * Plugin activation
	 */
	public function activate() {
		// Create PAD page
		$this->create_pad_page();

		// Flush rewrite rules
		flush_rewrite_rules();
	}

	/**
	 * Create PAD page
	 */
	private function create_pad_page() {
		// Check if page already exists
		$pad_page_id = get_option( 'wpd_pad_page_id' );

		if ( $pad_page_id && get_post( $pad_page_id ) ) {
			return;
		}

		// Create page
		$page_data = array(
			'post_title'     => 'PAD',
			'post_name'      => 'pad',
			'post_content'   => '[wpd_pickup_delivery]',
			'post_status'    => 'publish',
			'post_type'      => 'page',
			'post_author'    => get_current_user_id(),
			'comment_status' => 'closed',
			'ping_status'    => 'closed',
		);

		$page_id = wp_insert_post( $page_data );

		if ( $page_id && ! is_wp_error( $page_id ) ) {
			update_option( 'wpd_pad_page_id', $page_id );
		}
	}

	/**
	 * Plugin deactivation
	 */
	public function deactivate() {
		// Flush rewrite rules
		flush_rewrite_rules();
	}
}

/**
 * Initialize plugin
 */
function euxpide_pickup_delivery() {
	return EUXPIDE_PickupDelivery::get_instance();
}

// Start the plugin
euxpide_pickup_delivery();
