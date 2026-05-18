<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Maya Payment</title>
</head>
<body>
  <script>
    const status   = @json($status);
    const ticketId = @json($ticket_id ?? '');
    const returnUrl = @json($return_url ?? '');

    function buildAppReturnUrl(base, paymentStatus, ticket) {
      if (!base) return null;
      const params = 'maya_status=' + encodeURIComponent(paymentStatus)
        + (ticket ? '&maya_ticket=' + encodeURIComponent(ticket) : '');
      // Capacitor app deep link (io.ionic.starter://maya-return)
      if (!/^https?:/i.test(base)) {
        const join = base.indexOf('?') >= 0 ? '&' : '?';
        return base + join + params;
      }
      const hashIdx = base.indexOf('#');
      if (hashIdx >= 0) {
        const origin = base.slice(0, hashIdx);
        const hashPart = base.slice(hashIdx + 1);
        const join = hashPart.indexOf('?') >= 0 ? '&' : '?';
        return origin + '#' + hashPart + join + params;
      }
      const join = base.indexOf('?') >= 0 ? '&' : '?';
      return base + join + params;
    }

    if (status === 'success' && ticketId && ticketId !== 'verify') {
      try { localStorage.setItem('maya_paid_ticket', ticketId); } catch (e) {}
    }
    if (status === 'success' && ticketId === 'verify') {
      try { localStorage.setItem('maya_link_success', '1'); } catch (e) {}
    }

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'MAYA_PAYMENT_RESULT', status, ticketId }, '*');
      window.close();
    } else {
      const target = buildAppReturnUrl(returnUrl, status, ticketId);
      if (target) {
        window.location.replace(target);
      } else {
        document.body.innerHTML = '<p style="font-family:sans-serif;text-align:center;padding:40px">Payment '
          + status + '. You can close this tab and return to TransiTrack.</p>';
      }
    }
  </script>
  <p style="font-family:sans-serif;text-align:center;padding:40px">Payment {{ $status }}. Returning to app…</p>
</body>
</html>
