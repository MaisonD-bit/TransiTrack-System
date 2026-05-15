<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    private string $secretKey;
    private string $baseUrl = 'https://api.stripe.com/v1';

    public function __construct()
    {
        $this->secretKey = env('STRIPE_SECRET_KEY', '');
    }

    /**
     * Create and confirm a Stripe PaymentIntent for a bus fare.
     * Body: { fare, cardNumber, expMonth, expYear, cvc, cardName, description? }
     * Returns: { success, paymentIntentId, status } or { error }
     */
    public function createStripeCharge(Request $request)
    {
        $fare        = $request->input('fare');
        $cardNumber  = $request->input('cardNumber');
        $expMonth    = $request->input('expMonth');
        $expYear     = $request->input('expYear');
        $cvc         = $request->input('cvc');
        $cardName    = $request->input('cardName', '');
        $description = $request->input('description', 'Bus Fare Payment');

        if (!$fare || !is_numeric($fare) || $fare <= 0) {
            return response()->json(['error' => 'Invalid fare amount.'], 400);
        }

        if (!$this->secretKey) {
            return response()->json(['error' => 'Stripe is not configured on the server.'], 500);
        }

        // Step 1 — create a PaymentMethod with the card details
        $pmRes = Http::withBasicAuth($this->secretKey, '')
            ->asForm()
            ->post("{$this->baseUrl}/payment_methods", [
                'type'                    => 'card',
                'card[number]'            => $cardNumber,
                'card[exp_month]'         => $expMonth,
                'card[exp_year]'          => $expYear,
                'card[cvc]'               => $cvc,
                'billing_details[name]'   => $cardName,
            ]);

        if (!$pmRes->successful()) {
            $msg = $pmRes->json()['error']['message'] ?? 'Invalid card details.';
            return response()->json(['error' => $msg], 400);
        }

        $pmId = $pmRes->json()['id'];

        // Step 2 — create and immediately confirm the PaymentIntent
        $amountCentavos = (int) round((float) $fare * 100);

        $piRes = Http::withBasicAuth($this->secretKey, '')
            ->asForm()
            ->post("{$this->baseUrl}/payment_intents", [
                'amount'                    => $amountCentavos,
                'currency'                  => 'PHP',
                'payment_method'            => $pmId,
                'payment_method_types[]'    => 'card',
                'description'               => $description,
                'confirm'                   => 'true',
            ]);

        if (!$piRes->successful()) {
            $msg = $piRes->json()['error']['message'] ?? 'Payment failed.';
            Log::error('Stripe charge failed: ' . $piRes->body());
            return response()->json(['error' => $msg], 400);
        }

        $pi     = $piRes->json();
        $status = $pi['status'];

        if ($status === 'succeeded') {
            return response()->json([
                'success'          => true,
                'paymentIntentId'  => $pi['id'],
                'status'           => 'succeeded',
            ]);
        }

        // 3D Secure required
        if ($status === 'requires_action') {
            $redirectUrl = $pi['next_action']['redirect_to_url']['url'] ?? null;
            return response()->json([
                'success'          => false,
                'paymentIntentId'  => $pi['id'],
                'status'           => 'requires_3ds',
                'nextActionUrl'    => $redirectUrl,
            ]);
        }

        return response()->json(['error' => "Unexpected payment status: {$status}"], 400);
    }

    // ─── E-Wallet Simulation ────────────────────────────────────────────────

    private function ewalletCacheKey(string $accountNumber): string
    {
        return 'ewallet_balance_' . preg_replace('/\D/', '', $accountNumber);
    }

    /**
     * Get current simulated e-wallet balance.
     * Default ₱1,000 on first use.
     */
    public function ewalletBalance(string $accountNumber)
    {
        $balance = Cache::get($this->ewalletCacheKey($accountNumber), 1000.00);
        return response()->json(['balance' => $balance]);
    }

    /**
     * Charge a simulated GCash/PayMaya balance.
     * Body: { fare, accountNumber, method }
     * Returns: { success, transactionId, balance } or { error, balance }
     */
    public function ewalletCharge(Request $request)
    {
        $fare          = (float) $request->input('fare', 0);
        $accountNumber = $request->input('accountNumber', '');
        $method        = $request->input('method', 'gcash');

        if ($fare <= 0 || !$accountNumber) {
            return response()->json(['error' => 'Invalid request.'], 400);
        }

        $key     = $this->ewalletCacheKey($accountNumber);
        $balance = (float) Cache::get($key, 1000.00);

        if ($balance < $fare) {
            return response()->json([
                'error'   => "Insufficient {$method} balance. Available: ₱" . number_format($balance, 2),
                'balance' => $balance,
            ], 400);
        }

        $newBalance = round($balance - $fare, 2);
        Cache::put($key, $newBalance, now()->addDays(30));

        return response()->json([
            'success'       => true,
            'transactionId' => 'TT-' . strtoupper(substr(uniqid(), -8)),
            'balance'       => $newBalance,
            'deducted'      => $fare,
        ]);
    }

    /**
     * Reset / top-up a simulated e-wallet balance (for testing).
     * Body: { accountNumber, amount? }
     */
    public function ewalletTopup(Request $request)
    {
        $accountNumber = $request->input('accountNumber', '');
        $amount        = (float) $request->input('amount', 1000.00);

        if (!$accountNumber) {
            return response()->json(['error' => 'Account number required.'], 400);
        }

        Cache::put($this->ewalletCacheKey($accountNumber), $amount, now()->addDays(30));
        return response()->json(['balance' => $amount]);
    }

    // ────────────────────────────────────────────────────────────────────────

    /**
     * Retrieve a PaymentIntent's current status.
     * GET /payments/stripe/intent/{id}
     */
    public function getIntentStatus(string $id)
    {
        if (!$this->secretKey) {
            return response()->json(['error' => 'Stripe is not configured on the server.'], 500);
        }

        $res = Http::withBasicAuth($this->secretKey, '')
            ->get("{$this->baseUrl}/payment_intents/{$id}");

        if (!$res->successful()) {
            return response()->json(['error' => 'Payment intent not found.'], 404);
        }

        $pi = $res->json();

        return response()->json([
            'status' => $pi['status'],
            'amount' => $pi['amount'] / 100,
        ]);
    }
}
