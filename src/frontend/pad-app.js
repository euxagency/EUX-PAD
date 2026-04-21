/**
 * EUX Pickup & Delivery – Frontend entry
 * Renders the PAD app into the page container (same structure as topsms admin entry).
 */

import { render } from '@wordpress/element';
import PADApp from './components/PADApp';
import './css/pad-app.css';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('wpd-pad-app');
    if (container) {
        render(<PADApp />, container);
    }
});
