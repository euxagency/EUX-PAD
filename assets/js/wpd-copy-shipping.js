/**
 * Checkout: copy shipping fields into billing (delivery PAD flow).
 */
(function ($) {
	'use strict';

	$(function () {
		$('#wpd-copy-shipping').on('click', function (e) {
			e.preventDefault();
			var fieldMapping = {
				shipping_first_name: 'billing_first_name',
				shipping_last_name: 'billing_last_name',
				shipping_company: 'billing_company',
				shipping_address_1: 'billing_address_1',
				shipping_address_2: 'billing_address_2',
				shipping_city: 'billing_city',
				shipping_state: 'billing_state',
				shipping_postcode: 'billing_postcode',
				shipping_country: 'billing_country',
			};
			$.each(fieldMapping, function (shippingField, billingField) {
				var $shippingInput = $('#' + shippingField);
				var $billingInput = $('#' + billingField);
				if ($shippingInput.length && $billingInput.length) {
					var value = $shippingInput.val();
					$billingInput.val(value).trigger('change');
				}
			});
			$('.wpd-copy-success').fadeIn().delay(2000).fadeOut();
			$('body').trigger('update_checkout');
		});
	});
})(jQuery);
