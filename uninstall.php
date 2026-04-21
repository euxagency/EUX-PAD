<?php
/**
 * Uninstall script — removes plugin options when the plugin is deleted from WordPress.
 *
 * @package EUX_Pickup_Delivery
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$pad_page_id = (int) get_option( 'wpd_pad_page_id', 0 );
if ( $pad_page_id > 0 ) {
	wp_delete_post( $pad_page_id, true );
}

delete_option( 'wpd_pad_page_id' );
delete_option( 'wpd_global_settings' );
delete_option( 'wpd_pickup_settings' );
delete_option( 'wpd_delivery_settings' );
delete_option( 'wpd_rules' );
