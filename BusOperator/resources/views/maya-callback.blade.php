<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Maya Payment</title>
</head>
<body>
  <script>
    const status   = '{{ $status }}';
    const ticketId = '{{ $ticket_id ?? '' }}';

    // Set a localStorage flag so the app knows payment succeeded
    if (status === 'success' && ticketId && ticketId !== 'verify') {
      localStorage.setItem('maya_paid_ticket', ticketId);
    }
    if (status === 'success' && ticketId === 'verify') {
      localStorage.setItem('maya_link_success', '1');
    }

    // Also try postMessage for faster response
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'MAYA_PAYMENT_RESULT', status, ticketId }, '*');
    }

    // Close the popup immediately
    window.close();
  </script>
  <p style="font-family:sans-serif;text-align:center;padding:40px">Payment {{ $status }}. Closing…</p>
</body>
</html>
