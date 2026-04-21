/**
 * Shared layout for Pickup & Delivery admin pages.
 * Matches WordPress admin patterns: wrap, page title, description, content.
 *
 * @param {Object}   props
 * @param {string}   props.title       Main heading (e.g. "Pickup & Delivery Settings").
 * @param {string}   [props.description] Tagline below title.
 * @param {string}   [props.pageTitle] Section heading (e.g. "Global Setting").
 * @param {React.ReactNode} [props.notice] Notice element (e.g. success/error).
 * @param {React.ReactNode} props.children Page content.
 * @param {React.ReactNode} [props.actions] Optional actions (e.g. buttons) at bottom.
 */
import { __ } from '@wordpress/i18n';
import { Notice, Spinner } from '@wordpress/components';

export default function AdminPageLayout({
    title,
    description,
    pageTitle,
    notice,
    children,
    actions,
    loading = false,
}) {
    return (
        <div className="wpd-admin">
            <div className="wpd-admin__header">
                <h1 className="wpd-admin__title">{title}</h1>
                {description && (
                    <p className="wpd-admin__description">{description}</p>
                )}
            </div>

            {notice && (
                <div className="wpd-admin__notice">
                    <Notice
                        status={notice.status}
                        isDismissible
                        onRemove={notice.onRemove}
                    >
                        {notice.message}
                    </Notice>
                </div>
            )}

            {pageTitle && (
                <h2 className="wpd-admin__page-title">{pageTitle}</h2>
            )}

            {loading ? (
                <div className="wpd-admin__loading">
                    <Spinner />
                </div>
            ) : (
                <>
                    <div className="wpd-admin__content">{children}</div>
                    {actions && (
                        <div className="wpd-admin__actions">{actions}</div>
                    )}
                </>
            )}
        </div>
    );
}
