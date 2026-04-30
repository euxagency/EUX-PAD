/**
 * Checkout progress bar: PAD step visibility and active state (cart / PAD / checkout / complete).
 * Localized as `wpdCheckoutProgress` from PHP.
 */
(function ($) {
	'use strict';

	$(function () {
		var cfg = window.wpdCheckoutProgress || {};
		var currentPage = cfg.currentPage || 'cart';
		var wpdPadStepEnabled = !!cfg.padStepEnabled;
		var padUrl = cfg.padUrl || '';
		var checkoutUrl = cfg.checkoutUrl || '';
		var cartUrl = cfg.cartUrl || '';

		var $steps = $('.wd-checkout-steps');

		if ($steps.length === 0) {
			var $container = $('.wd-page-title .container');
			if ($container.length === 0) {
				return;
			}
			if (currentPage === 'pad') {
				$container.find('h1.entry-title, h1.title, .wd-breadcrumbs').hide();
			}
			var $newSteps = $('<ul class="wd-checkout-steps"></ul>');
			var $cartStep = $('<li class="step-cart"></li>');
			$cartStep.append($('<a href="' + cartUrl + '"></a>').append($('<span>Shopping cart</span>')));
			var $padStep = $('<li class="step-pad"></li>');
			$padStep.append($('<a href="' + padUrl + '"></a>').append($('<span>Pickup & Delivery</span>')));
			var $checkoutStep = $('<li class="step-checkout"></li>');
			$checkoutStep.append($('<a href="' + checkoutUrl + '"></a>').append($('<span>Checkout</span>')));
			var $completeStep = $('<li class="step-complete"></li>');
			$completeStep.append($('<span>Order complete</span>'));
			$newSteps.append($cartStep);
			if (wpdPadStepEnabled) {
				$newSteps.append($padStep);
			}
			$newSteps.append($checkoutStep);
			$newSteps.append($completeStep);
			$container.prepend($newSteps);
			$steps = $('.wd-checkout-steps');
		} else {
			var $cartStep0 = $steps.find('.step-cart');
			var $checkoutStep0 = $steps.find('.step-checkout');
			var $completeStep0 = $steps.find('.step-complete');
			if ($cartStep0.length === 0 || $checkoutStep0.length === 0) {
				return;
			}
			if (!wpdPadStepEnabled) {
				$steps.find('.step-pad').remove();
			} else if ($steps.find('.step-pad').length === 0) {
				var $padStepNew = $('<li class="step-pad"></li>');
				$padStepNew.append($('<a href="' + padUrl + '"><span>Pickup & Delivery</span></a>'));
				$cartStep0.after($padStepNew);
			}
			$checkoutStep0.find('a').attr('href', checkoutUrl);
			$checkoutStep0.find('span').text('Checkout');
		}

		$steps.find('li').removeClass('step-active step-complete step-inactive');
		var $cartStep = $steps.find('.step-cart');
		var $padStep = $steps.find('.step-pad');
		var $checkoutStep = $steps.find('.step-checkout');
		var $completeStep = $steps.find('li').last();
		if (!$completeStep.hasClass('step-complete')) {
			$completeStep.addClass('step-complete');
		}

		if (wpdPadStepEnabled) {
			switch (currentPage) {
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
			switch (currentPage) {
				case 'cart':
					$cartStep.addClass('step-active');
					$checkoutStep.addClass('step-inactive');
					$completeStep.addClass('step-inactive');
					break;
				case 'pad':
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
	});
})(jQuery);
