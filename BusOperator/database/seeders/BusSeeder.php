<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Bus;

class BusSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // ========== NORTH TERMINAL BUSES ==========
        // Based on North Bus Terminal Guide PDF

        // JULILA TRANSIT - North Terminal (Sogod-Borbon, Tabogon via Tuburan routes)
        Bus::updateOrCreate(
            ['plate_number' => 'JLT-N001'],
            [
                'bus_number' => 'JT-N001',
                'model' => 'Hyundai County',
                'capacity' => 45,
                'bus_company' => 'JULILA TRANSIT',
                'accommodation_type' => 'regular',
                'status' => 'available', // Changed from 'active' to 'available'
                'terminal' => 'north',
                'description' => 'Regular bus for Sogod-Borbon route via North Terminal',
            ]
        );

        Bus::updateOrCreate(
            ['plate_number' => 'JLT-N002'],
            [
                'bus_number' => 'JT-N002',
                'model' => 'Hyundai County',
                'capacity' => 45,
                'bus_company' => 'JULILA TRANSIT',
                'accommodation_type' => 'regular',
                'status' => 'available',
                'terminal' => 'north',
                'description' => 'Regular bus for Tabogon via Tuburan route',
            ]
        );

        // INDAY MEMIE BUS - North Terminal (Tabuelan via Maravilla route)
        Bus::updateOrCreate(
            ['plate_number' => 'IMB-N001'],
            [
                'bus_number' => 'IM-N001',
                'model' => 'Hino RM2',
                'capacity' => 50,
                'bus_company' => 'INDAY MEMIE BUS',
                'accommodation_type' => 'regular',
                'status' => 'available',
                'terminal' => 'north',
                'description' => 'Regular bus for Tabuelan via Maravilla route',
            ]
        );

        // CEBU SAN SEBASTIAN LINER CORP. - North Terminal
        Bus::updateOrCreate(
            ['plate_number' => 'CSS-N001'],
            [
                'bus_number' => 'CS-N001',
                'model' => 'Hino FB',
                'capacity' => 48,
                'bus_company' => 'CEBU SAN SEBASTIAN LINER CORP.',
                'accommodation_type' => 'regular',
                'status' => 'available',
                'terminal' => 'north',
                'description' => 'Regular bus for Sogod via Borbon route',
            ]
        );

        Bus::updateOrCreate(
            ['plate_number' => 'CSS-N002'],
            [
                'bus_number' => 'CS-N002',
                'model' => 'Hino FB',
                'capacity' => 48,
                'bus_company' => 'CEBU SAN SEBASTIAN LINER CORP.',
                'accommodation_type' => 'regular',
                'status' => 'in_service', // Some buses in service
                'terminal' => 'north',
                'description' => 'Regular bus for Tabogon route',
            ]
        );

        // ROUGH RIDERS / WHITE STALLION - North Terminal (Daan Bantayan Maya route)
        Bus::updateOrCreate(
            ['plate_number' => 'RR-N001'],
            [
                'bus_number' => 'RR-N001',
                'model' => 'Mitsubishi Rosa',
                'capacity' => 40,
                'bus_company' => 'ROUGH RIDERS / WHITE STALLION',
                'accommodation_type' => 'regular',
                'status' => 'available',
                'terminal' => 'north',
                'description' => 'Regular bus for Daan Bantayan Maya route',
            ]
        );

        // METRO CEBU AUTOBUS - North Terminal (Bagay via Hagnaya, Kawit routes)
        Bus::updateOrCreate(
            ['plate_number' => 'MCA-N001'],
            [
                'bus_number' => 'MC-N001',
                'model' => 'Mitsubishi Fuso',
                'capacity' => 46,
                'bus_company' => 'METRO CEBU AUTOBUS',
                'accommodation_type' => 'regular',
                'status' => 'available',
                'terminal' => 'north',
                'description' => 'Regular bus for Bagay via Hagnaya route',
            ]
        );

        Bus::updateOrCreate(
            ['plate_number' => 'MCA-N002'],
            [
                'bus_number' => 'MC-N002',
                'model' => 'Mitsubishi Fuso',
                'capacity' => 40,
                'bus_company' => 'METRO CEBU AUTOBUS',
                'accommodation_type' => 'air-conditioned',
                'status' => 'available',
                'terminal' => 'north',
                'description' => 'Air-conditioned bus for Vistoria via Hagnaya route',
            ]
        );

        // ISLAND AUTOBUS - North Terminal (Mainline and Hagnaya routes)
        Bus::updateOrCreate(
            ['plate_number' => 'IA-N001'],
            [
                'bus_number' => 'IA-N001',
                'model' => 'Nissan Civilian',
                'capacity' => 42,
                'bus_company' => 'ISLAND AUTOBUS',
                'accommodation_type' => 'regular',
                'status' => 'maintenance', // Some buses in maintenance
                'terminal' => 'north',
                'description' => 'Regular bus for Mainline route',
            ]
        );

        Bus::updateOrCreate(
            ['plate_number' => 'IA-N002'],
            [
                'bus_number' => 'IA-N002',
                'model' => 'Nissan Civilian',
                'capacity' => 38,
                'bus_company' => 'ISLAND AUTOBUS',
                'accommodation_type' => 'air-conditioned',
                'status' => 'available',
                'terminal' => 'north',
                'description' => 'Air-conditioned bus for Hagnaya route',
            ]
        );

        // CERES - North Terminal (Maya via Bagay/Kawit, Tabogon, Tuburan)
        Bus::updateOrCreate(
            ['plate_number' => 'CER-N001'],
            [
                'bus_number' => 'CR-N001',
                'model' => 'Yutong ZK6119H',
                'capacity' => 55,
                'bus_company' => 'CERES',
                'accommodation_type' => 'regular',
                'status' => 'available',
                'terminal' => 'north',
                'description' => 'Regular bus for Maya via Bagay/Kawit route',
            ]
        );

        Bus::updateOrCreate(
            ['plate_number' => 'CER-N002'],
            [
                'bus_number' => 'CR-N002',
                'model' => 'Yutong ZK6119H',
                'capacity' => 50,
                'bus_company' => 'CERES',
                'accommodation_type' => 'air-conditioned',
                'status' => 'in_service',
                'terminal' => 'north',
                'description' => 'Air-conditioned bus for Tuburan route',
            ]
        );

        // ========== SOUTH TERMINAL BUSES ==========
        // Based on South Bus Terminal Guide PDF

        // CERES - South Terminal (Multiple routes to southern destinations)
        Bus::updateOrCreate(
            ['plate_number' => 'CER-S001'],
            [
                'bus_number' => 'CR-S001',
                'model' => 'Yutong ZK6119H',
                'capacity' => 55,
                'bus_company' => 'CERES',
                'accommodation_type' => 'regular',
                'status' => 'available',
                'terminal' => 'south',
                'description' => 'Regular bus for Madridejos route via South Terminal',
            ]
        );

        Bus::updateOrCreate(
            ['plate_number' => 'CER-S002'],
            [
                'bus_number' => 'CR-S002',
                'model' => 'Yutong ZK6119H',
                'capacity' => 50,
                'bus_company' => 'CERES',
                'accommodation_type' => 'air-conditioned',
                'status' => 'available',
                'terminal' => 'south',
                'description' => 'Air-conditioned bus for Bacolod via Don Salvador route',
            ]
        );

        Bus::updateOrCreate(
            ['plate_number' => 'CER-S003'],
            [
                'bus_number' => 'CR-S003',
                'model' => 'Yutong ZK6119H',
                'capacity' => 52,
                'bus_company' => 'CERES',
                'accommodation_type' => 'air-conditioned',
                'status' => 'available',
                'terminal' => 'south',
                'description' => 'Air-conditioned bus for Bacood via Canlaon route',
            ]
        );

        // VALLACAR TRANSIT - South Terminal
        Bus::updateOrCreate(
            ['plate_number' => 'VT-S001'],
            [
                'bus_number' => 'VT-S001',
                'model' => 'Hino RK1J',
                'capacity' => 48,
                'bus_company' => 'VALLACAR TRANSIT',
                'accommodation_type' => 'regular',
                'status' => 'available',
                'terminal' => 'south',
                'description' => 'Regular bus for southern destinations',
            ]
        );

        Bus::updateOrCreate(
            ['plate_number' => 'VT-S002'],
            [
                'bus_number' => 'VT-S002',
                'model' => 'Hino RK1J',
                'capacity' => 45,
                'bus_company' => 'VALLACAR TRANSIT',
                'accommodation_type' => 'air-conditioned',
                'status' => 'in_service',
                'terminal' => 'south',
                'description' => 'Air-conditioned bus for Dumaguete route',
            ]
        );

        // LIBRANDO BUS LINES - South Terminal
        Bus::updateOrCreate(
            ['plate_number' => 'LBL-S001'],
            [
                'bus_number' => 'LB-S001',
                'model' => 'Mitsubishi Fuso',
                'capacity' => 46,
                'bus_company' => 'LIBRANDO BUS LINES',
                'accommodation_type' => 'regular',
                'status' => 'available',
                'terminal' => 'south',
                'description' => 'Regular bus for Argao/Dalaguete routes',
            ]
        );

        Bus::updateOrCreate(
            ['plate_number' => 'LBL-S002'],
            [
                'bus_number' => 'LB-S002',
                'model' => 'Mitsubishi Fuso',
                'capacity' => 44,
                'bus_company' => 'LIBRANDO BUS LINES',
                'accommodation_type' => 'air-conditioned',
                'status' => 'maintenance',
                'terminal' => 'south',
                'description' => 'Air-conditioned bus for Oslob route',
            ]
        );

        // GOLDEN LINES - South Terminal
        Bus::updateOrCreate(
            ['plate_number' => 'GL-S001'],
            [
                'bus_number' => 'GL-S001',
                'model' => 'Nissan Civilian',
                'capacity' => 42,
                'bus_company' => 'GOLDEN LINES',
                'accommodation_type' => 'regular',
                'status' => 'available',
                'terminal' => 'south',
                'description' => 'Regular bus for Carcar/Barili routes',
            ]
        );

        // SOUTHERN STAR BUS - South Terminal
        Bus::updateOrCreate(
            ['plate_number' => 'SSB-S001'],
            [
                'bus_number' => 'SS-S001',
                'model' => 'Hino FB',
                'capacity' => 48,
                'bus_company' => 'SOUTHERN STAR BUS',
                'accommodation_type' => 'regular',
                'status' => 'available',
                'terminal' => 'south',
                'description' => 'Regular bus for Moalboal route',
            ]
        );

        Bus::updateOrCreate(
            ['plate_number' => 'SSB-S002'],
            [
                'bus_number' => 'SS-S002',
                'model' => 'Hino FB',
                'capacity' => 46,
                'bus_company' => 'SOUTHERN STAR BUS',
                'accommodation_type' => 'air-conditioned',
                'status' => 'out_of_service', // Some variety in status
                'terminal' => 'south',
                'description' => 'Air-conditioned bus for Badian route',
            ]
        );
    }
}