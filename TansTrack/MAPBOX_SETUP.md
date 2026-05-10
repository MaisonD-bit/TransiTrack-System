# TransiTrack - Mapbox Integration Guide

## Setting Up Mapbox API

TransiTrack uses Mapbox API for route lines and navigation features. Follow these steps to set up Mapbox in your development environment:

1. **Create a Mapbox Account**:
   - Go to [Mapbox](https://www.mapbox.com/)
   - Sign up for a free account (the free tier includes 50,000 map loads per month)

2. **Get Your Access Token**:
   - Once logged in, navigate to your Mapbox account dashboard
   - Find your default public token or create a new one
   - Copy the access token

3. **Configure Your Environment**:
   - Open `src/environments/environment.ts` and `src/environments/environment.prod.ts` 
   - Replace `YOUR_MAPBOX_ACCESS_TOKEN` with your actual Mapbox access token:
     ```typescript
     mapbox: {
       accessToken: "YOUR_MAPBOX_ACCESS_TOKEN" // Replace with your actual token
     }
     ```

## Mapbox Features Implemented

The TransiTrack app utilizes the following Mapbox features:

1. **Interactive Maps**: Display transit routes with stops
2. **Navigation**: Get directions between locations
3. **Real-time Location Tracking**: Show current vehicle position
4. **Route Visualization**: Display the route line between stops
5. **Transit Information**: Show distance and duration information

## Additional Configuration Options

You can customize the map appearance and behavior by modifying the following files:

- `src/app/components/route-map/route-map.component.ts`: Map initialization and behavior
- `src/app/components/route-map/route-map.component.scss`: Map styling
- `src/app/services/map.service.ts`: API interactions with Mapbox services

## Mapbox Documentation

For more information about Mapbox GL JS and its features, refer to:
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/api/)
- [Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/)
- [Mapbox GL Directions Plugin](https://github.com/mapbox/mapbox-gl-directions)
