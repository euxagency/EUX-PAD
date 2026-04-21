import { render } from '@wordpress/element';

import GlobalSettings from './components/GlobalSettings';
import PickupSettings from './components/PickupSettings';
import DeliverySettings from './components/DeliverySettings';
import RulesPage from './components/RulesPage';
import './css/wpd-admin-app.css';

function mountAdminApp() {
    const globalEl = document.getElementById('wpd-admin-global-settings');
    const pickupEl = document.getElementById('wpd-admin-pickup-settings');
    const deliveryEl = document.getElementById('wpd-admin-delivery-settings');
    const rulesEl = document.getElementById('wpd-admin-rules');
    const appEl = document.getElementById('wpd-admin-app');

    if (globalEl) {
        render(<GlobalSettings />, globalEl);
        return;
    }
    if (pickupEl) {
        render(<PickupSettings />, pickupEl);
        return;
    }
    if (deliveryEl) {
        render(<DeliverySettings />, deliveryEl);
        return;
    }
    if (rulesEl) {
        render(<RulesPage />, rulesEl);
        return;
    }

    // Single container: mount by page slug from PHP (`wpdAdmin.pageSlug`).
    if (appEl) {
        const slug = (window.wpdAdmin && window.wpdAdmin.pageSlug) || '';
        if (slug === 'wpd-pickup-setting') {
            render(<PickupSettings />, appEl);
        } else if (slug === 'wpd-delivery-setting') {
            render(<DeliverySettings />, appEl);
        } else if (slug === 'wpd-rules') {
            render(<RulesPage />, appEl);
        } else {
            render(<GlobalSettings />, appEl);
        }
    }
}

document.addEventListener('DOMContentLoaded', mountAdminApp);

