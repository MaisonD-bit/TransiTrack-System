/**
 * Sysadmin UI helpers: custom confirm for approve forms.
 */
document.addEventListener('submit', async function (event) {
    const form = event.target.closest('.js-sysadmin-approve-form');
    if (!form) {
        return;
    }

    event.preventDefault();

    const message = form.getAttribute('data-confirm-message')
        || 'Approve this route package?';

    const confirmed = typeof showSpaceConfirm === 'function'
        ? await showSpaceConfirm(message, 'Approve', 'Cancel')
        : window.confirm(message);

    if (confirmed) {
        form.submit();
    }
});
