import { render } from '@wordpress/element';

import GlobalSettings from './components/GlobalSettings';
import PickupSettings from './components/PickupSettings';
import DeliverySettings from './components/DeliverySettings';
import RulesPage from './components/RulesPage';
import './css/wpd-admin-app.css';

function mountAdminApp() {
    const globalEl = document.getElementById('euxpide-admin-global-settings');
    const pickupEl = document.getElementById('euxpide-admin-pickup-settings');
    const deliveryEl = document.getElementById('euxpide-admin-delivery-settings');
    const rulesEl = document.getElementById('euxpide-admin-rules');
    const appEl = document.getElementById('euxpide-admin-app');

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

    // Single container: mount by page slug from PHP (`euxpideAdmin.pageSlug`).
    if (appEl) {
        const slug = (window.euxpideAdmin && window.euxpideAdmin.pageSlug) || '';
        if (slug === 'euxpide-pickup-setting') {
            render(<PickupSettings />, appEl);
        } else if (slug === 'euxpide-delivery-setting') {
            render(<DeliverySettings />, appEl);
        } else if (slug === 'euxpide-rules') {
            render(<RulesPage />, appEl);
        } else {
            render(<GlobalSettings />, appEl);
        }
    }
}

document.addEventListener('DOMContentLoaded', mountAdminApp);

