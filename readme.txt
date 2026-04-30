=== EUX Pickup & Delivery ===
Contributors: eux, euxdigital
Tags: woocommerce, pickup, delivery, checkout, scheduling
Requires at least: 5.0
Tested up to: 6.9
Stable tag: 1.0.2
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add a Pickup & Delivery step to your WooCommerce checkout, with date and time slot selection, delivery suburbs, and a flexible rules engine.

== Description ==

EUX Pickup & Delivery is a WooCommerce plugin developed by **EUX Digital Agency** that inserts a dedicated Pickup & Delivery step between the shopping cart and the checkout. Customers choose how they want to receive their order, pick a date and (for pickup) a time slot, and then continue through to WooCommerce's standard checkout with their choice stored on the order.

The complete source code is available on [GitHub](https://github.com/euxagency/EUX-PAD).

### Key Features

**1. Dedicated Pickup & Delivery Step**
* Automatically creates a "PAD" page on activation containing the `[wpd_pickup_delivery]` shortcode.
* Redirects customers from the cart to the PAD page before they can reach the checkout.
* Optional checkout progress bar: Shopping cart → Pickup & Delivery → Checkout → Order complete.
* 5-minute session expiry on PAD selections so stale choices cannot reach the checkout.
* The Pickup tab, the Delivery tab, or both can be enabled independently — if both are off, the PAD step is skipped entirely.

**2. Date and Time Slot Selection**
* React-powered UI that fetches available dates and time slots from the server on demand.
* Configurable number of days shown in the date picker (default 15).
* Pickup time slots generated from per-weekday opening hours and a configurable interval in minutes.
* Optional auto-refresh timer (default 5 minutes) prevents the customer from checking out with slots that are no longer current.

**3. Pickup Settings**
* Store pickup address, contact phone number, and opening hours defined row-by-row per weekday (up to one row per day).
* Configurable time-slot interval in minutes.
* Independent enable/disable toggle and custom label for the Pickup tab.

**4. Delivery Settings**
* Manage allowed delivery suburbs using WooCommerce-style chips — type a suburb, press Enter or comma to add, × to remove.
* Paste-supported input for bulk adding suburbs from a comma-separated list.
* Case-insensitive suburb matching on the customer's delivery form.
* Independent enable/disable toggle and custom label for the Delivery tab.
* If no suburbs are configured, any suburb is accepted.

**5. Rules Engine**
* Create rules that enable or disable dates for pickup and/or delivery.
* Each rule combines multiple conditions with AND logic.
* Rules are evaluated in priority order (lowest `order` wins) — the first matching rule decides the date.
* Conditions: Days of Week, Specific Dates, Delivery/Pickup Method, and (when multi-store is enabled) Store.
* Operators supported: *matches any of*, *equal*, *not equal*, *contains*, *between* (depending on condition type).

**6. Global Appearance & Labels**
* Customize tab labels (Delivery / Pickup) and the continue button text.
* Upload pickup and delivery icons from the WordPress media library.
* Full colour customization via a CSS-variable-driven theme — tabs, day selector, time selector and continue button, including hover and selected states.
* Reset colours to WooCommerce-standard defaults with a single click.
* Toggle the checkout progress bar and the date refresh timer on or off.

**7. Order Integration**
* Saves pickup/delivery type, date, time slot and (for delivery) suburb, postcode and special instructions to the order.
* Displays the selected method and time on the order review, admin order screen, thank-you page, My Account orders list and transactional emails.
* Adds *Type* and *Date* columns to the WooCommerce orders admin list for both HPOS and legacy order storage.
* Forces the correct shipping method at checkout based on the customer's pickup/delivery choice.
* Hides the shipping address section and shipping totals row automatically when pickup is selected.
* Pre-fills the delivery form from the customer's existing WooCommerce address when available.
* Editable from the admin order screen after the order is placed.

### Benefits for Store Owners
* Capture the customer's chosen date up front, so fulfilment is scheduled from the moment the order is placed.
* Restrict delivery to the suburbs your drivers actually service.
* Block specific dates (public holidays, stocktake, owner leave) without editing code.
* Offer click-and-collect without needing a separate pickup plugin.
* Works with both classic and High-Performance Order Storage.

### Technical Features
* Built for **WooCommerce 7.0+** with full **High-Performance Order Storage (HPOS)** compatibility.
* Modern React front-end using `@wordpress/element` and `@wordpress/components`, bundled with webpack.
* Admin UI built on native WordPress components.
* REST API under two namespaces: `wpd/v1` (settings) and `eux-pad/v1` (date availability).
* Rule engine respects the WordPress site timezone.
* Settings and the auto-generated PAD page are cleanly removed on uninstall.
* Core scheduling and rule evaluation run entirely inside your WordPress installation.

== External services ==

This plugin does **not** call EUX Digital Agency servers or include third-party analytics.

**Optional: Google Maps (embed)**  
If you paste a **Google Maps** HTML embed into Pickup Settings (or a multi-store location’s map field), the customer’s **browser** loads Google’s map resources to display that embed. Google may receive typical web data (for example IP address, referrer, and interaction with the map) as described in their policies. This only happens when you choose to add an embed; you can leave map fields empty.

* [Google Terms of Service](https://policies.google.com/terms)  
* [Google Privacy Policy](https://policies.google.com/privacy)  

**Other map or iframe providers**  
If you embed another provider’s map via HTML iframe, the visitor’s browser loads that third party under that provider’s terms — the plugin only outputs the HTML you save; it does not send your WooCommerce order data to those services by itself.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/` or upload the ZIP via **Plugins → Add New → Upload Plugin**.
2. Activate **EUX Pickup & Delivery** through the **Plugins** screen.
3. Ensure **WooCommerce** is installed and active (7.0 or higher).
4. Navigate to **Pickup & Delivery → Global Settings** to configure labels, icons and colours.
5. Visit **Pickup & Delivery → Pickup Settings** to set your store address, phone and opening hours.
6. Visit **Pickup & Delivery → Delivery Settings** to add the suburbs you deliver to.
7. (Optional) Open **Pickup & Delivery → Rules** to block specific dates or weekdays, or to apply method-specific scheduling.
8. Place a test order to confirm the PAD page appears between the cart and the checkout.

== Frequently Asked Questions ==

= Does this plugin work without WooCommerce? =
No. WooCommerce 7.0 or later must be installed and active. If it isn't, the plugin will not initialize and an admin notice will appear.

= Where is the Pickup & Delivery page? =
On activation the plugin creates a page titled "PAD" containing the `[wpd_pickup_delivery]` shortcode. It is tracked via the `wpd_pad_page_id` option and removed automatically on uninstall.

= Can I disable pickup or delivery independently? =
Yes. Each can be turned off from its own settings page. If you disable both, the PAD step is skipped entirely and customers go straight from cart to checkout.

= Is the plugin compatible with HPOS (WooCommerce custom order tables)? =
Yes. Compatibility with the `custom_order_tables` feature is explicitly declared, and order list columns are registered for both legacy and HPOS storage.

= Can I restrict delivery to certain suburbs? =
Yes. Add suburbs as chips under **Delivery Settings**. When at least one suburb is configured, customers must enter a listed suburb (case-insensitive) to continue. Leave the list empty to accept any suburb.

= How are pickup time slots generated? =
From the opening hours you define per weekday and the interval (in minutes) set under **Pickup Settings**. For example, Monday 9:00–17:00 with a 60-minute interval produces slots at 9:00–10:00, 10:00–11:00, and so on.

= How does the rules engine work? =
A rule has an objective (Enable Day or Disable Day) and one or more conditions that must all match (AND logic). When multiple rules could affect the same date, the one with the lowest `order` value wins. A rule needs at minimum a date-scope condition (Days of Week or Specific Dates) plus a Method condition.

= Does the plugin send any data to an external service? =
The plugin itself does not phone home. Optional map embeds (see **External services** in this readme) load in the visitor’s browser only if you add them in settings.

= Can I customize the look of the PAD page? =
Yes. Tab colours, day and time selector backgrounds and text colours, and continue-button hover states are all exposed under **Global Settings**. You can also upload custom icons and change tab labels.

= Why does the customer get redirected back to the PAD page from the checkout? =
If the session has expired (older than 5 minutes) or the customer tried to reach the checkout directly without making a selection, they are sent back to the PAD page to choose a method and date.

= What happens when the plugin is uninstalled? =
The uninstall script removes the auto-created PAD page and deletes the four settings options (`wpd_global_settings`, `wpd_pickup_settings`, `wpd_delivery_settings`, `wpd_rules`). Order meta saved against existing orders is preserved.

== Changelog ==

= 1.0.1 =
* WordPress.org compliance: unique main class name, text domain aligned with plugin slug, no trialware rule locks, no raw inline script/style in flagged locations, readme external-services documentation for optional map embeds, contributor list.
* Coding standards, security hardening, and tooling for distribution.

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.1 =
Maintenance and compatibility updates.
