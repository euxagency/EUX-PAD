/**
 * WooCommerce admin order: PAD meta edit UI (type change toggles time/store rows; edit link toggles view/edit).
 */
(function () {
	'use strict';

	function onTypeChange(ev) {
		var t = ev.target;
		if (!t || t.id !== 'wpd_type') {
			return;
		}
		var edit = t.closest('.wpd-pad-order-edit');
		if (!edit) {
			return;
		}
		var timeId = edit.getAttribute('data-wpd-time-row');
		var storeId = edit.getAttribute('data-wpd-store-row');
		var timeRow = timeId ? document.getElementById(timeId) : null;
		var storeRow = storeId ? document.getElementById(storeId) : null;
		var isPickup = t.value === 'pickup';
		if (timeRow) {
			timeRow.style.display = isPickup ? '' : 'none';
		}
		if (storeRow) {
			storeRow.style.display = isPickup && storeRow.getAttribute('data-wpd-multi-store') === '1' ? '' : 'none';
		}
	}

	document.addEventListener('change', onTypeChange);

	document.addEventListener('click', function (ev) {
		var a = ev.target.closest && ev.target.closest('.wpd-pad-edit-link');
		if (!a || !a.getAttribute('data-wpd-view') || !a.getAttribute('data-wpd-edit')) {
			return;
		}
		ev.preventDefault();
		var v = document.getElementById(a.getAttribute('data-wpd-view'));
		var e = document.getElementById(a.getAttribute('data-wpd-edit'));
		if (v && e) {
			v.style.display = 'none';
			e.style.display = 'block';
		}
	});
})();
