<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MayaController extends Controller
{
    private string $secretKey;
    private string $publicKey;
    private string $baseUrl;

    public function __construct()
    {
        $this->secretKey = config('services.maya.secret_key', '');
        $this->publicKey = config('services.maya.public_key', '');
        $this->baseUrl   = config('services.maya.base_url', 'https://pg-sandbox.paymaya.com');
    }

    /**
     * Create a Maya Checkout session.
     * Called by the commuter app before opening the Maya payment popup.
     *
     * Body: { public_ticket_id, amount, route_name?, commuter_name? }
     * Returns: { success, checkout_url, checkout_id }
     */
    public function createCheckout(Request $request)
    {
        $data = $request->validate([
            'public_ticket_id' => ['nullable', 'string', 'max:64'],
            'amount'           => ['required', 'numeric', 'min:1'],
            'route_name'       => ['nullable', 'string', 'max:128'],
            'commuter_name'    => ['nullable', 'string', 'max:128'],
        ]);

        if (! $this->secretKey) {
            Log::error('[Maya] Secret key not configured');
            return response()->json(['success' => false, 'message' => 'Maya is not configured.'], 500);
        }

        $appUrl    = rtrim(config('services.maya.callback_url', config('app.url')), '/');
        $ticketId  = $data['public_ticket_id'] ?? null;
        $ticketRef = urlencode($ticketId ?? 'verify');
        $amount    = round((float) $data['amount'], 2);

        $payload = [
            'totalAmount' => [
                'value'    => $amount,
                'currency' => 'PHP',
                'details'  => ['subtotal' => $amount],
            ],
            'buyer' => [
                'firstName' => $data['commuter_name'] ?? 'Commuter',
                'lastName'  => '',
                'contact'   => ['email' => 'commuter@transitrackph.com'],
            ],
            'items' => [
                [
                    'name'        => $ticketId ? 'Transit e-Ticket' : 'Maya Account Verification',
                    'quantity'    => 1,
                    'code'        => $ticketId ?? 'VERIFY',
                    'description' => $data['route_name'] ?? ($ticketId ? 'Bus fare' : 'One-time ₱1 account link verification'),
                    'amount'      => ['value' => $amount, 'details' => ['subtotal' => $amount]],
                    'totalAmount' => ['value' => $amount, 'details' => ['subtotal' => $amount]],
                ],
            ],
            'redirectUrl' => [
                'success' => "{$appUrl}/payments/maya/success?ticket={$ticketRef}",
                'failure' => "{$appUrl}/payments/maya/failure?ticket={$ticketRef}",
                'cancel'  => "{$appUrl}/payments/maya/cancel?ticket={$ticketRef}",
            ],
            'requestReferenceNumber' => 'TRANSIT-' . strtoupper(substr($ticketId ?? ('VFY' . time()), -12)),
            'metadata'               => (object) [],
        ];

        Log::info('[Maya] Sending checkout request', [
            'baseUrl' => $this->baseUrl,
            'amount' => $amount,
            'ticket' => $ticketId,
        ]);

        $response = Http::withoutVerifying()->withHeaders([
            'Authorization' => 'Basic ' . base64_encode($this->publicKey . ':'),
            'Content-Type'  => 'application/json',
        ])->post("{$this->baseUrl}/checkout/v1/checkouts", $payload);

        if (! $response->successful()) {
            Log::error('[Maya] Checkout creation failed', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
            $mayaError = $response->json('message') ?? $response->json('error') ?? $response->body();
            return response()->json([
                'success' => false,
                'message' => 'Maya error: ' . (is_string($mayaError) ? $mayaError : json_encode($mayaError)),
            ], 502);
        }

        $body = $response->json();
        
        Log::info('[Maya] Checkout success', [
            'checkoutId' => $body['checkoutId'] ?? null,
            'hasRedirectUrl' => isset($body['redirectUrl']),
        ]);

        return response()->json([
            'success'      => true,
            'checkout_id'  => $body['checkoutId'] ?? null,
            'checkout_url' => $body['redirectUrl'] ?? null,
        ]);
    }

    /**
     * Query Maya directly for the current status of a checkout. Used as a
     * last-chance reconciliation when the commuter app's local verify fails
     * (e.g. the popup closed before the success redirect reached our backend,
     * or APP_URL is misconfigured so Maya's redirect never landed here).
     * If Maya reports PAYMENT_SUCCESS we flip the ticket to paid right here so
     * the commuter app sees a paid state on its next poll.
     */
    public function checkoutStatus(Request $request, string $checkoutId)
    {
        if (! $this->secretKey) {
            return response()->json(['success' => false, 'message' => 'Maya is not configured.'], 500);
        }

        $response = Http::withoutVerifying()->withHeaders([
            'Authorization' => 'Basic ' . base64_encode($this->secretKey . ':'),
            'Content-Type'  => 'application/json',
        ])->get("{$this->baseUrl}/checkout/v1/checkouts/{$checkoutId}");

        if (! $response->successful()) {
            Log::warning('[Maya] checkoutStatus query failed', [
                'checkoutId' => $checkoutId,
                'status'     => $response->status(),
                'body'       => $response->body(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Could not reach Maya.',
            ], 502);
        }

        $body          = $response->json();
        $paymentStatus = strtoupper((string) ($body['paymentStatus'] ?? 'UNKNOWN'));
        // Maya's items[0].code is the public_ticket_id we passed at createCheckout time.
        $ticketRef     = $body['items'][0]['code'] ?? null;

        $paid = in_array($paymentStatus, ['PAYMENT_SUCCESS', 'PAID'], true);

        if ($paid && $ticketRef && $ticketRef !== 'VERIFY') {
            // Idempotent: only update if not already marked paid.
            Ticket::where('public_ticket_id', $ticketRef)
                ->where(function ($q) {
                    $q->whereNull('payment_status')->orWhere('payment_status', '!=', 'paid');
                })
                ->update([
                    'payment_status' => 'paid',
                    'payment_method' => 'paymaya',
                ]);
        }

        return response()->json([
            'success'        => true,
            'paid'           => $paid,
            'payment_status' => $paymentStatus,
            'ticket_id'      => $ticketRef,
        ]);
    }

    /**
     * Maya redirects here after a successful payment.
     * Marks the ticket as paid and renders a popup-close page.
     */
    public function paymentSuccess(Request $request)
    {
        $ticketId = $request->query('ticket');

        if ($ticketId && $ticketId !== 'verify') {
            Ticket::where('public_ticket_id', $ticketId)->update([
                'payment_status' => 'paid',
                'payment_method' => 'paymaya',
            ]);
        }

        return view('maya-callback', [
            'status'    => 'success',
            'ticket_id' => $ticketId,
            'message'   => 'Payment successful!',
            'sub'       => 'Your fare has been paid via Maya.',
        ]);
    }

    /**
     * Maya redirects here after a failed payment.
     */
    public function paymentFailure(Request $request)
    {
        return view('maya-callback', [
            'status'    => 'failed',
            'ticket_id' => $request->query('ticket'),
            'message'   => 'Payment failed.',
            'sub'       => 'Your Maya payment could not be processed. Please try again.',
        ]);
    }

    /**
     * Maya redirects here when the user cancels.
     */
    public function paymentCancel(Request $request)
    {
        return view('maya-callback', [
            'status'    => 'cancelled',
            'ticket_id' => $request->query('ticket'),
            'message'   => 'Payment cancelled.',
            'sub'       => 'You cancelled the Maya payment.',
        ]);
    }
}
