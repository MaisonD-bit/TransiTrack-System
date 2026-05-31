/**
 * TransiTrack Sysadmin in-app alerts (replaces browser alert/confirm).
 */
(function () {
    let ready = false;

    function ensureModal() {
        if (ready) return;
        ready = true;

        const style = document.createElement('style');
        style.textContent = `
            .space-feedback-overlay {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 4000;
                background: rgba(15, 23, 42, 0.45);
                align-items: center;
                justify-content: center;
                padding: 1rem;
            }
            .space-feedback-overlay.show { display: flex; }
            .space-feedback-dialog {
                background: #fff;
                border-radius: 12px;
                padding: 1.5rem 1.75rem;
                max-width: 420px;
                width: 100%;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
            }
            .space-feedback-brand {
                font-size: 0.75rem;
                font-weight: 700;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: #2b7be4;
                margin: 0 0 0.35rem;
            }
            .space-feedback-title {
                margin: 0 0 0.75rem;
                font-size: 1.15rem;
                font-weight: 700;
                color: #1a1a1a;
            }
            .space-feedback-message {
                margin: 0 0 1.25rem;
                color: #444;
                font-size: 0.95rem;
                line-height: 1.45;
                white-space: pre-wrap;
            }
            .space-feedback-actions {
                display: flex;
                gap: 0.65rem;
                justify-content: flex-end;
            }
            .space-feedback-btn {
                border: none;
                border-radius: 6px;
                padding: 0.55rem 1rem;
                font-size: 0.8rem;
                font-weight: 700;
                cursor: pointer;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }
            .space-feedback-btn-primary { background: #2b7be4; color: #fff; }
            .space-feedback-btn-primary:hover { background: #1e5fae; }
            .space-feedback-btn-success { background: #1bb76e; color: #fff; }
            .space-feedback-btn-danger { background: #dc3545; color: #fff; }
            .space-feedback-btn-secondary {
                background: #f8f9fa;
                color: #555;
                border: 1px solid #ddd;
            }
            .space-feedback-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 0.75rem;
                font-size: 1.1rem;
            }
            .space-feedback-icon.info { background: #e7f1ff; color: #2b7be4; }
            .space-feedback-icon.success { background: #e8f8ef; color: #1bb76e; }
            .space-feedback-icon.error { background: #fdecea; color: #dc3545; }
            .space-feedback-icon.warning { background: #fff8e6; color: #e6b800; }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'spaceFeedbackModal';
        overlay.className = 'space-feedback-overlay';
        overlay.innerHTML = `
            <div class="space-feedback-dialog" role="dialog" aria-modal="true">
                <p class="space-feedback-brand">TransiTrack</p>
                <div id="spaceFeedbackIcon" class="space-feedback-icon info"></div>
                <h3 id="spaceFeedbackTitle" class="space-feedback-title">Notice</h3>
                <p id="spaceFeedbackMessage" class="space-feedback-message"></p>
                <div id="spaceFeedbackActions" class="space-feedback-actions"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && overlay.dataset.dismissible === 'true') {
                hide();
                if (typeof overlay._resolve === 'function') {
                    overlay._resolve(false);
                    overlay._resolve = null;
                }
            }
        });
    }

    function hide() {
        const overlay = document.getElementById('spaceFeedbackModal');
        if (overlay) {
            overlay.classList.remove('show');
            overlay.dataset.dismissible = 'false';
        }
    }

    function iconForType(type) {
        const map = {
            success: { className: 'success', glyph: '✓' },
            error: { className: 'error', glyph: '!' },
            warning: { className: 'warning', glyph: '!' },
            info: { className: 'info', glyph: 'i' },
        };
        return map[type] || map.info;
    }

    window.showSpaceAlert = function (message, type = 'info') {
        ensureModal();
        return new Promise((resolve) => {
            const overlay = document.getElementById('spaceFeedbackModal');
            const brand = overlay.querySelector('.space-feedback-brand');
            const icon = document.getElementById('spaceFeedbackIcon');
            const title = document.getElementById('spaceFeedbackTitle');
            const body = document.getElementById('spaceFeedbackMessage');
            const actions = document.getElementById('spaceFeedbackActions');

            if (brand) brand.hidden = false;
            icon.hidden = false;
            const meta = iconForType(type);
            icon.className = `space-feedback-icon ${meta.className}`;
            icon.textContent = meta.glyph;

            title.textContent = type === 'success' ? 'Success'
                : type === 'error' ? 'Error'
                : type === 'warning' ? 'Warning'
                : 'Notice';
            body.textContent = String(message ?? '');

            actions.innerHTML = '';
            const ok = document.createElement('button');
            ok.type = 'button';
            ok.className = `space-feedback-btn space-feedback-btn-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'}`;
            ok.textContent = 'OK';
            ok.addEventListener('click', () => { hide(); resolve(true); });
            actions.appendChild(ok);

            overlay.dataset.dismissible = 'true';
            overlay._resolve = resolve;
            overlay.classList.add('show');
            ok.focus();
        });
    };

    window.showSpaceConfirm = function (message, confirmLabel = 'Confirm', cancelLabel = 'Cancel') {
        ensureModal();
        return new Promise((resolve) => {
            const overlay = document.getElementById('spaceFeedbackModal');
            const brand = overlay.querySelector('.space-feedback-brand');
            const icon = document.getElementById('spaceFeedbackIcon');
            const title = document.getElementById('spaceFeedbackTitle');
            const body = document.getElementById('spaceFeedbackMessage');
            const actions = document.getElementById('spaceFeedbackActions');

            if (brand) brand.hidden = true;
            icon.hidden = true;
            title.textContent = 'Please confirm';
            body.textContent = String(message ?? '');

            actions.innerHTML = '';

            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'space-feedback-btn space-feedback-btn-secondary';
            cancel.textContent = cancelLabel;
            cancel.addEventListener('click', () => { hide(); resolve(false); });

            const confirm = document.createElement('button');
            confirm.type = 'button';
            confirm.className = 'space-feedback-btn space-feedback-btn-primary';
            confirm.textContent = confirmLabel;
            confirm.addEventListener('click', () => { hide(); resolve(true); });

            actions.appendChild(cancel);
            actions.appendChild(confirm);

            overlay.dataset.dismissible = 'false';
            overlay.classList.add('show');
            confirm.focus();
        });
    };
})();
