<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TerminalSpace;

class TerminalSpaceSeeder extends Seeder
{
    public function run(): void
    {
        $spaces = [
            // LEFT Spaces (L1-L5)
            ['space_id' => 'L1', 'position' => 'LEFT', 'position_order' => 1, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'L2', 'position' => 'LEFT', 'position_order' => 2, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'L3', 'position' => 'LEFT', 'position_order' => 3, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'L4', 'position' => 'LEFT', 'position_order' => 4, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'L5', 'position' => 'LEFT', 'position_order' => 5, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            
            // TOP Spaces (T1-T14)
            ['space_id' => 'T1', 'position' => 'TOP', 'position_order' => 1, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T2', 'position' => 'TOP', 'position_order' => 2, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T3', 'position' => 'TOP', 'position_order' => 3, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T4', 'position' => 'TOP', 'position_order' => 4, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T5', 'position' => 'TOP', 'position_order' => 5, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T6', 'position' => 'TOP', 'position_order' => 6, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T7', 'position' => 'TOP', 'position_order' => 7, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T8', 'position' => 'TOP', 'position_order' => 8, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T9', 'position' => 'TOP', 'position_order' => 9, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T10', 'position' => 'TOP', 'position_order' => 10, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T11', 'position' => 'TOP', 'position_order' => 11, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T12', 'position' => 'TOP', 'position_order' => 12, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T13', 'position' => 'TOP', 'position_order' => 13, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'T14', 'position' => 'TOP', 'position_order' => 14, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            
            // RIGHT Spaces (R1-R9)
            ['space_id' => 'R1', 'position' => 'RIGHT', 'position_order' => 1, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'R2', 'position' => 'RIGHT', 'position_order' => 2, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'R3', 'position' => 'RIGHT', 'position_order' => 3, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'R4', 'position' => 'RIGHT', 'position_order' => 4, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'R5', 'position' => 'RIGHT', 'position_order' => 5, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'R6', 'position' => 'RIGHT', 'position_order' => 6, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'R7', 'position' => 'RIGHT', 'position_order' => 7, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'R8', 'position' => 'RIGHT', 'position_order' => 8, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
            ['space_id' => 'R9', 'position' => 'RIGHT', 'position_order' => 9, 'route_name' => null, 'accommodation_type' => null, 'is_occupied' => false, 'status' => 'available'],
        ];

        foreach ($spaces as $space) {
            TerminalSpace::updateOrCreate(
                ['space_id' => $space['space_id']],
                $space
            );
        }
    }
}