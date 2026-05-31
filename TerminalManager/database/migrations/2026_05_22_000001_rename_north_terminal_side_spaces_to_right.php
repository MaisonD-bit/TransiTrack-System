<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            foreach (range(1, 4) as $order) {
                $this->moveSpace("L{$order}", "R{$order}", 'RIGHT', $order);
            }
        });
    }

    public function down(): void
    {
        DB::transaction(function () {
            foreach (range(1, 4) as $order) {
                $this->moveSpace("R{$order}", "L{$order}", 'LEFT', $order);
            }
        });
    }

    private function moveSpace(string $fromId, string $toId, string $position, int $order): void
    {
        $from = DB::table('north_terminal_spaces')->where('space_id', $fromId)->first();

        if (! $from) {
            DB::table('north_terminal_spaces')
                ->where('space_id', $toId)
                ->update([
                    'position' => $position,
                    'position_order' => $order,
                    'updated_at' => now(),
                ]);

            return;
        }

        $to = DB::table('north_terminal_spaces')->where('space_id', $toId)->first();
        $payload = (array) $from;
        $payload['space_id'] = $toId;
        $payload['position'] = $position;
        $payload['position_order'] = $order;
        $payload['updated_at'] = now();

        if (! $to) {
            DB::table('north_terminal_spaces')->insert($payload);
        } elseif ((bool) $from->is_occupied && ! (bool) $to->is_occupied) {
            unset($payload['space_id']);
            DB::table('north_terminal_spaces')->where('space_id', $toId)->update($payload);
        } else {
            DB::table('north_terminal_spaces')
                ->where('space_id', $toId)
                ->update([
                    'position' => $position,
                    'position_order' => $order,
                    'updated_at' => now(),
                ]);
        }

        DB::table('north_terminal_occupancy_history')
            ->where('space_id', $fromId)
            ->update(['space_id' => $toId]);

        DB::table('north_terminal_spaces')->where('space_id', $fromId)->delete();
    }
};
