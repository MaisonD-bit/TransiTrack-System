<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http as HttpClient;
use Illuminate\Support\Str;
use App\Models\Payment;
use App\Models\Ticket;

class PaymentController extends Controller
{
    /**
     * Create a PayMaya checkout session.
     * Expects JSON body: { public_ticket_id: string }
     *
     * In dev/simulated mode (no PayMaya keys), this returns a local checkout URL which
     * the app can open and then call verify to mark paid.
     */
    public function createMayaCheckout(Request $request)
    {
        $publicTicketId = trim((string) $request->input('public_ticket_id', ''));
        if ($publicTicketId === '') {
            return response()->json(['success' => false, 'error' => 'public_ticket_id is required'], 422);
        }

        $ticket = Ticket::query()->where('public_ticket_id', $publicTicketId)->first();
        if (! $ticket) {
            return response()->json(['success' => false, 'error' => 'Ticket not found'], 404);
        }

        $method = strtolower((string) ($ticket->payment_method ?? ''));
        if ($method !== 'paymaya') {
            return response()->json(['success' => false, 'error' => 'Ticket payment_method must be paymaya'], 422);
        }
        if (! in_array((string) $ticket->payment_status, ['pending', 'failed'], true)) {
            return response()->json(['success' => false, 'error' => 'Ticket is not payable'], 422);
        }

        $amount = (float) $ticket->fare;
        if ($amount <= 0) {
            return response()->json(['success' => false, 'error' => 'Invalid ticket fare'], 422);
        }

        $publicKey = env('PAYMAYA_PUBLIC_KEY');
        $secretKey = env('PAYMAYA_SECRET_KEY');
        $baseUrl = env('PAYMAYA_BASE_URL', 'https://pg-sandbox.paymaya.com');

        // Build checkout payload similar to the client-side implementation
        $reference = $ticket->payment_ref ?: ('PAY-' . strtoupper(Str::random(10)) . '-' . strtoupper(Str::random(6)));
        if (! $ticket->payment_ref) {
            $ticket->payment_ref = $reference;
        }
        $ticket->payment_status = 'pending';
        $ticket->save();

        $checkoutData = [
            'totalAmount' => [
                'value' => $amount,
                'currency' => 'PHP'
            ],
            'buyer' => [
                'firstName' => 'Customer',
                'lastName' => 'App',
                'contact' => [
                    'phone' => $request->input('buyer.phone') ?? '',
                    'email' => $request->input('buyer.email') ?? ''
                ]
            ],
            'items' => [[
                'name' => 'Bus Fare',
                'quantity' => 1,
                'code' => 'BUS_TICKET',
                'description' => 'Bus fare payment',
                'amount' => ['value' => $amount, 'currency' => 'PHP'],
                'totalAmount' => ['value' => $amount, 'currency' => 'PHP']
            ]],
            'redirectUrl' => [
                'success' => url('/payment/success'),
                'failure' => url('/payment/failure'),
                'cancel' => url('/payment/cancel')
            ],
            'requestReferenceNumber' => $reference,
            'metadata' => ['public_ticket_id' => $publicTicketId]
        ];

        // Create a payment record (pending)
        $payment = Payment::create([
            'reference' => $reference,
            'method' => 'paymaya',
            'amount' => $amount,
            'currency' => 'PHP',
            'status' => 'PENDING',
            'payload' => ['request' => $checkoutData]
        ]);

        // If PayMaya credentials exist, try to call the API server-side
        if ($publicKey) {
            try {
                $response = HttpClient::withBasicAuth($publicKey, '')
                    ->acceptJson()
                    ->post($baseUrl . '/checkout/v1/checkouts', $checkoutData);

                if ($response->successful()) {
                    $body = $response->json();
                    // persist payment details returned by PayMaya (if any)
                    $payment->update([ 'payment_id' => $body['id'] ?? null, 'payload' => $body ]);
                    // The PayMaya response may contain redirect URLs or checkout details
                    return response()->json(['success' => true, 'data' => $body]);
                }

                Log::warning('PayMaya checkout creation failed: ' . $response->body());
            } catch (\Exception $e) {
                Log::error('PayMaya API call error: ' . $e->getMessage());
            }
        } else {
            Log::warning('PayMaya public key not configured; returning simulated checkout URL');
        }

        // Fallback: return a simulated checkout URL so client-side flow can continue
        $simulated = url('/simulated-checkout') . '?amount=' . urlencode((string) $amount) . '&ref=' . urlencode($reference) . '&ticket=' . urlencode($publicTicketId);
        return response()->json([
            'success' => true,
            'data' => [
                'ref' => $reference,
                'checkout_url' => $simulated,
            ],
        ]);
    }

    /**
     * Verify a payment by payment id or reference
     */
    public function verifyMayaPayment(Request $request, $idOrRef)
    {
        $secretKey = env('PAYMAYA_SECRET_KEY');
        $baseUrl = env('PAYMAYA_BASE_URL', 'https://pg-sandbox.paymaya.com');

        // Try to locate payment by id or reference
        $payment = Payment::where('payment_id', $idOrRef)->orWhere('reference', $idOrRef)->first();
        if (!$payment) return response()->json(['success' => false, 'message' => 'Payment not found'], 404);

        // Also locate ticket by ref (this is the source of truth for ticketing rules).
        $ticket = Ticket::query()->where('payment_ref', $payment->reference)->first();
        if (! $ticket) {
            return response()->json(['success' => false, 'message' => 'Ticket not found for payment ref'], 404);
        }

        // Simulated flow: if no secret key (or no payment_id), confirm as paid when verify is called.
        if (! $secretKey || ! $payment->payment_id) {
            $this->markTicketPaidAndIssueQr($ticket, $payment, [
                'simulated' => true,
                'confirmed_at' => now()->toIso8601String(),
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'ref' => $payment->reference,
                    'status' => 'PAID',
                    'ticket' => [
                        'public_ticket_id' => $ticket->public_ticket_id,
                        'payment_method' => $ticket->payment_method,
                        'payment_status' => $ticket->payment_status,
                        'paid_at' => $ticket->paid_at?->toIso8601String(),
                        'qr_payload' => $ticket->qr_payload,
                    ],
                ],
            ]);
        }

        try {
            $resp = HttpClient::withBasicAuth($secretKey, '')->get($baseUrl . '/payments/v1/payments/' . urlencode($payment->payment_id));
            if ($resp->successful()) {
                $body = $resp->json();
                $payment->update([ 'status' => $body['status'] ?? 'UNKNOWN', 'payload' => $body ]);
                $status = strtoupper((string) ($body['status'] ?? ''));
                if (in_array($status, ['PAYMENT_SUCCESS', 'SUCCESS', 'COMPLETED', 'PAID'], true)) {
                    $this->markTicketPaidAndIssueQr($ticket, $payment, $body);
                }
                return response()->json(['success' => true, 'data' => $body]);
            }
            return response()->json(['success' => false, 'message' => 'PayMaya verify failed', 'body' => $resp->body()], 500);
        } catch (\Exception $e) {
            Log::error('PayMaya verify error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error verifying payment'], 500);
        }
    }

    /**
     * Webhook handler for PayMaya notifications (POST)
     */
    public function handleWebhook(Request $request)
    {
        $data = $request->all();
        $remoteIp = $request->ip();

        // IP whitelist from env, comma-separated
        $allowed = env('PAYMAYA_WEBHOOK_IPS', '');
        $allowedIps = array_filter(array_map('trim', explode(',', $allowed)));
        if (!empty($allowedIps) && !in_array($remoteIp, $allowedIps)) {
            Log::warning('Webhook rejected from non-whitelisted IP: ' . $remoteIp);
            return response()->json(['success' => false, 'message' => 'IP not allowed'], 403);
        }

        Log::info('PayMaya webhook received from ' . $remoteIp, $data);

        // Try to find payment by id or reference
        $paymentId = $data['paymentId'] ?? ($data['id'] ?? null);
        $reference = $data['requestReferenceNumber'] ?? null;

        $payment = null;
        if ($paymentId) $payment = Payment::where('payment_id', $paymentId)->first();
        if (!$payment && $reference) $payment = Payment::where('reference', $reference)->first();

        if ($payment) {
            $payment->update([ 'status' => $data['status'] ?? 'UPDATED', 'payload' => $data ]);
            return response()->json(['success' => true]);
        }

        // No payment found, log and return 200 to acknowledge
        Log::warning('Webhook: payment not found for payload', $data);
        return response()->json(['success' => true]);
    }

    private function markTicketPaidAndIssueQr(Ticket $ticket, Payment $payment, array $providerPayload): void
    {
        if ((string) $ticket->payment_status === 'paid' && ! empty($ticket->qr_payload)) {
            return;
        }

        $ticket->payment_status = 'paid';
        $ticket->paid_at = $ticket->paid_at ?: now();
        $ticket->qr_payload = $this->makeSignedQrToken($ticket);
        $ticket->save();

        $payment->status = 'PAID';
        $payment->payload = $providerPayload;
        $payment->save();
    }

    /**
     * Create a signed QR token (HMAC) containing ticket+trip details.
     * Token format: v1.<base64url(json)>.<hexsig>
     */
    private function makeSignedQrToken(Ticket $ticket): string
    {
        $ticket->loadMissing(['schedule.route', 'schedule.bus', 'schedule.user']);

        $route = $ticket->schedule?->route;
        $bus = $ticket->schedule?->bus;
        $operatorUser = $ticket->schedule?->user;

        $payload = [
            'v' => 1,
            'ticket_id' => (string) $ticket->public_ticket_id,
            'ticket_db_id' => (int) $ticket->id,
            'schedule_id' => (int) $ticket->schedule_id,
            'route_id' => (int) ($route?->id ?? 0),
            'route_name' => (string) ($route?->name ?? ''),
            'operator_company' => (string) ($operatorUser?->company_name ?? $operatorUser?->name ?? ''),
            'bus_number' => (string) ($bus?->bus_number ?? $bus?->plate_number ?? ''),
            'fare' => (float) $ticket->fare,
            'payment_method' => (string) ($ticket->payment_method ?? 'cash'),
            'paid_at' => $ticket->paid_at?->toIso8601String(),
            'issued_at' => now()->toIso8601String(),
        ];

        $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $data = rtrim(strtr(base64_encode($json ?: '{}'), '+/', '-_'), '=');

        $key = (string) config('app.key');
        if (str_starts_with($key, 'base64:')) {
            $key = base64_decode(substr($key, 7)) ?: '';
        }

        $sig = hash_hmac('sha256', $data, $key);
        return 'v1.'.$data.'.'.$sig;
    }
}