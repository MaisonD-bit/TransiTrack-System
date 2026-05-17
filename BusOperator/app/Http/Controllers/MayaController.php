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
    private bool $devMock;

    public function __construct()
    {
        $this->secretKey = config('services.maya.secret_key', '');
        $this->publicKey = config('services.maya.public_key', '');
        $this->baseUrl   = config('services.maya.base_url', 'https://pg-sandbox.paymaya.com');
        $this->devMock   = (bool) config('services.maya.dev_mock', false);
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

        $appUrl    = rtrim(config('services.maya.callback_url', config('app.url')), '/');
        $ticketId  = $data['public_ticket_id'] ?? null;
        $ticketRef = urlencode($ticketId ?? 'verify');
        $amount    = round((float) $data['amount'], 2);

        // Create Checkout uses PUBLIC key (Basic auth: publicKey + empty password). See developers.maya.ph
        if (! $this->publicKey) {
            if ($this->devMock && app()->environment('local')) {
                Log::info('[Maya] Using dev mock checkout (MAYA_DEV_MOCK=true)');

                return response()->json([
                    'success'      => true,
                    'checkout_id'  => 'MOCK-' . uniqid(),
                    'checkout_url' => "{$appUrl}/payments/maya/mock?ticket={$ticketRef}&amount={$amount}",
                    'mock'         => true,
                ]);
            }

            Log::error('[Maya] Public API key not configured');
            return response()->json([
                'success' => false,
                'message' => 'Maya is not configured. Set MAYA_PUBLIC_KEY (and MAYA_SECRET_KEY) in BusOperator .env, then run: php artisan config:clear',
            ], 503);
        }

        $payload = [
            'totalAmount' => [
                'value'    => $amount,
                'currency' => 'PHP',
                'details'  => ['subtotal' => $amount],
            ],
            'buyer' => [
                'firstName' => $data['commuter_name'] ?? 'Commuter',
                'lastName'  => 'TransiTrack',
                'contact'   => [
                    'email' => 'commuter@transitrackph.com',
                    'phone' => '+639171234567',
                ],
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
     * Local/dev mock checkout page (no PayMaya API keys required).
     */
    public function mockCheckout(Request $request)
    {
        if (! $this->devMock || ! app()->environment('local')) {
            abort(404);
        }

        return view('maya-mock-checkout', [
            'ticket_id' => $request->query('ticket', 'verify'),
            'amount'    => $request->query('amount', '0'),
            'success_url' => rtrim(config('services.maya.callback_url', config('app.url')), '/')
                . '/payments/maya/success?ticket=' . urlencode($request->query('ticket', 'verify')),
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
