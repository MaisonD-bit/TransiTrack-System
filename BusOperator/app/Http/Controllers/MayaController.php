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

        // Maya Checkout uses PUBLIC key in Basic Auth (see developers.maya.ph).
        if (! $this->publicKey) {
            return response()->json([
                'success' => false,
                'message' => 'Maya is not configured: set MAYA_PUBLIC_KEY in your BusOperator .env (sandbox or production key from Maya Business Manager).',
            ], 503);
        }

        $appUrl = rtrim((string) (config('services.maya.callback_url') ?: config('app.url')), '/');
        if ($appUrl === '') {
            return response()->json([
                'success' => false,
                'message' => 'Set APP_URL or MAYA_CALLBACK_URL so Maya can redirect after payment.',
            ], 503);
        }

        $ticketId  = $data['public_ticket_id'] ?? null;
        $ticketRef = rawurlencode($ticketId ?? 'verify');
        $amount    = round((float) $data['amount'], 2);

        $fullName = trim((string) ($data['commuter_name'] ?? 'Commuter')) ?: 'Commuter';
        $nameParts = preg_split('/\s+/', $fullName, 2, PREG_SPLIT_NO_EMPTY) ?: ['Commuter'];
        $firstName = mb_substr($nameParts[0], 0, 80);
        $lastName  = mb_substr($nameParts[1] ?? 'Customer', 0, 80);

        $payload = [
            'totalAmount' => [
                'value'    => $amount,
                'currency' => 'PHP',
                'details'  => ['subtotal' => $amount],
            ],
            'buyer' => [
                'firstName' => $firstName,
                'lastName'  => $lastName,
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
            'requestReferenceNumber' => 'TT-' . strtoupper(substr(sha1(($ticketId ?? '') . microtime(true)), 0, 20)),
            'metadata'               => (object) [],
        ];

        try {
            $response = Http::timeout(30)
                ->withoutVerifying()
                ->withHeaders([
                    'Authorization' => 'Basic ' . base64_encode($this->publicKey . ':'),
                    'Content-Type'  => 'application/json',
                ])->post("{$this->baseUrl}/checkout/v1/checkouts", $payload);
        } catch (\Throwable $e) {
            Log::error('Maya checkout HTTP exception', ['error' => $e->getMessage()]);

            return response()->json([
                'success' => false,
                'message' => 'Could not reach Maya: ' . $e->getMessage(),
            ], 502);
        }

        if (! $response->successful()) {
            Log::error('Maya checkout creation failed', [
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

        return response()->json([
            'success'      => true,
            'checkout_id'  => $body['checkoutId'] ?? null,
            'checkout_url' => $body['redirectUrl'] ?? null,
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
