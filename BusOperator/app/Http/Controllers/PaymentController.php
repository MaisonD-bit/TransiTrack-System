<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http as HttpClient;
use App\Models\Payment;

class PaymentController extends Controller
{
    /**
     * Create a PayMaya checkout session.
     * Expects JSON body: { amount: number, routeId?: string }
     */
    public function createMayaCheckout(Request $request)
    {
        $amount = $request->input('amount');
        $routeId = $request->input('routeId');

        if (!$amount || !is_numeric($amount) || $amount <= 0) {
            return response()->json(['success' => false, 'error' => 'Invalid amount'], 400);
        }

        $publicKey = env('PAYMAYA_PUBLIC_KEY');
        $secretKey = env('PAYMAYA_SECRET_KEY');
        $baseUrl = env('PAYMAYA_BASE_URL', 'https://pg-sandbox.paymaya.com');

        // Build checkout payload similar to the client-side implementation
        $reference = 'BUS' . substr((string) time(), -8) . strtoupper(substr(md5(uniqid()), 0, 6));

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
            'metadata' => ['routeId' => $routeId]
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
        $simulated = url('/simulated-checkout') . '?amount=' . urlencode($amount) . '&ref=' . urlencode($reference) . ($routeId ? '&route=' . urlencode($routeId) : '');
        return response()->json(['success' => true, 'data' => ['redirectUrl' => $simulated, 'requestReferenceNumber' => $reference]]);
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

        if (!$secretKey) return response()->json(['success' => false, 'message' => 'Secret key not configured'], 500);

        try {
            $resp = HttpClient::withBasicAuth($secretKey, '')->get($baseUrl . '/payments/v1/payments/' . urlencode($payment->payment_id));
            if ($resp->successful()) {
                $body = $resp->json();
                $payment->update([ 'status' => $body['status'] ?? 'UNKNOWN', 'payload' => $body ]);
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
}