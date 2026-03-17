---
sidebar_position: 5
---

# Flutter

Build cross-platform delivery and logistics apps with Atlas in Dart/Flutter. This guide covers map rendering, geocoding, routing, and GPS trip telemetry.

## Dependencies

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  maplibre_gl: ^0.21.0
  http: ^1.2.0
  geolocator: ^12.0.0
  permission_handler: ^11.0.0
```

```bash
flutter pub get
```

### iOS setup

Add to `ios/Runner/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We use your location for navigation and delivery tracking.</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>We use your location for delivery tracking in the background.</string>
```

### Android setup

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

## Configuration

```dart
// lib/atlas_config.dart
class AtlasConfig {
  static const String baseUrl = String.fromEnvironment(
    'ATLAS_URL',
    defaultValue: 'https://api.atlas-maps.dev',
  );

  static const String apiKey = String.fromEnvironment(
    'ATLAS_API_KEY',
    defaultValue: '',
  );

  static Map<String, String> get headers => {
    'Content-Type': 'application/json',
    if (apiKey.isNotEmpty) 'X-API-Key': apiKey,
  };
}
```

Build with:
```bash
flutter run --dart-define=ATLAS_URL=https://api.atlas-maps.dev --dart-define=ATLAS_API_KEY=your-api-key
```

## Map widget

```dart
// lib/widgets/atlas_map.dart
import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import '../atlas_config.dart';

class AtlasMap extends StatefulWidget {
  final String tileset;
  final LatLng initialCenter;
  final double initialZoom;
  final void Function(MaplibreMapController)? onMapReady;

  const AtlasMap({
    super.key,
    this.tileset = 'ghana',
    this.initialCenter = const LatLng(5.603, -0.187),
    this.initialZoom = 12,
    this.onMapReady,
  });

  @override
  State<AtlasMap> createState() => _AtlasMapState();
}

class _AtlasMapState extends State<AtlasMap> {
  MaplibreMapController? _controller;

  @override
  Widget build(BuildContext context) {
    return MaplibreMap(
      styleString: '${AtlasConfig.baseUrl}/v1/tiles/${widget.tileset}/tilejson.json',
      initialCameraPosition: CameraPosition(
        target: widget.initialCenter,
        zoom: widget.initialZoom,
      ),
      onMapCreated: (controller) {
        _controller = controller;
        widget.onMapReady?.call(controller);
      },
    );
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }
}
```

## Data types

```dart
// lib/models/atlas_models.dart
class LatLon {
  final double lat;
  final double lon;

  const LatLon(this.lat, this.lon);

  Map<String, dynamic> toJson() => {'lat': lat, 'lon': lon};
}

class GeocodeResult {
  final String name;
  final double lat;
  final double lon;
  final String category;
  final String? address;
  final double confidence;

  const GeocodeResult({
    required this.name,
    required this.lat,
    required this.lon,
    required this.category,
    this.address,
    required this.confidence,
  });

  factory GeocodeResult.fromJson(Map<String, dynamic> json) => GeocodeResult(
    name: json['name'] as String,
    lat: (json['lat'] as num).toDouble(),
    lon: (json['lon'] as num).toDouble(),
    category: json['category'] as String,
    address: json['address'] as String?,
    confidence: (json['confidence'] as num).toDouble(),
  );
}

class RouteInstruction {
  final String type;
  final String? road;
  final double distanceM;
  final double bearing;

  const RouteInstruction({
    required this.type,
    this.road,
    required this.distanceM,
    required this.bearing,
  });

  factory RouteInstruction.fromJson(Map<String, dynamic> json) => RouteInstruction(
    type: json['type'] as String,
    road: json['road'] as String?,
    distanceM: (json['distance_m'] as num).toDouble(),
    bearing: (json['bearing'] as num).toDouble(),
  );
}

class RouteResult {
  final double distanceM;
  final double durationS;
  final Map<String, dynamic> geometry;
  final List<RouteInstruction> instructions;

  const RouteResult({
    required this.distanceM,
    required this.durationS,
    required this.geometry,
    required this.instructions,
  });

  factory RouteResult.fromJson(Map<String, dynamic> json) => RouteResult(
    distanceM: (json['distance_m'] as num).toDouble(),
    durationS: (json['duration_s'] as num).toDouble(),
    geometry: json['geometry'] as Map<String, dynamic>,
    instructions: (json['instructions'] as List)
      .map((i) => RouteInstruction.fromJson(i as Map<String, dynamic>))
      .toList(),
  );
}
```

## Atlas API client

```dart
// lib/services/atlas_client.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../atlas_config.dart';
import '../models/atlas_models.dart';

class AtlasClient {
  final http.Client _http;

  AtlasClient({http.Client? client}) : _http = client ?? http.Client();

  Future<List<GeocodeResult>> geocode(String query, {int limit = 5, String? country}) async {
    final params = {'q': query, 'limit': '$limit'};
    if (country != null) params['country'] = country;

    final uri = Uri.parse('${AtlasConfig.baseUrl}/v1/geocode').replace(queryParameters: params);
    final response = await _http.get(uri, headers: AtlasConfig.headers);

    if (response.statusCode != 200) {
      throw Exception('Geocode failed: ${response.statusCode}');
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['results'] as List)
      .map((r) => GeocodeResult.fromJson(r as Map<String, dynamic>))
      .toList();
  }

  Future<List<GeocodeResult>> reverseGeocode(double lat, double lon, {int limit = 1}) async {
    final uri = Uri.parse('${AtlasConfig.baseUrl}/v1/reverse').replace(
      queryParameters: {'lat': '$lat', 'lon': '$lon', 'limit': '$limit'},
    );
    final response = await _http.get(uri, headers: AtlasConfig.headers);

    if (response.statusCode != 200) {
      throw Exception('Reverse geocode failed: ${response.statusCode}');
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['results'] as List)
      .map((r) => GeocodeResult.fromJson(r as Map<String, dynamic>))
      .toList();
  }

  Future<RouteResult> route(
    LatLon origin,
    LatLon destination, {
    String profile = 'car',
  }) async {
    final uri = Uri.parse('${AtlasConfig.baseUrl}/v1/route');
    final response = await _http.post(
      uri,
      headers: AtlasConfig.headers,
      body: jsonEncode({
        'origin': origin.toJson(),
        'destination': destination.toJson(),
        'profile': profile,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Route failed: ${response.statusCode}');
    }

    return RouteResult.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }
}
```

## Trip telemetry service

```dart
// lib/services/telemetry_service.dart
import 'dart:async';
import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import '../atlas_config.dart';
import '../models/atlas_models.dart';

class TelemetryWaypoint {
  final double lat;
  final double lon;
  final String timestamp;
  final double? speedKmh;
  final double? bearing;

  const TelemetryWaypoint({
    required this.lat,
    required this.lon,
    required this.timestamp,
    this.speedKmh,
    this.bearing,
  });

  Map<String, dynamic> toJson() => {
    'lat': lat,
    'lon': lon,
    'timestamp': timestamp,
    if (speedKmh != null) 'speed_kmh': speedKmh,
    if (bearing != null) 'bearing': bearing,
  };
}

class TripSummary {
  final String status;
  final double durationS;
  final double distanceM;

  const TripSummary({required this.status, required this.durationS, required this.distanceM});

  factory TripSummary.fromJson(Map<String, dynamic> json) => TripSummary(
    status: json['status'] as String,
    durationS: (json['duration_s'] as num).toDouble(),
    distanceM: (json['distance_m'] as num).toDouble(),
  );
}

class TelemetryService {
  static const int _batchSize = 10;
  static const Duration _flushInterval = Duration(seconds: 30);

  final http.Client _http;
  String? _tripId;
  final List<TelemetryWaypoint> _buffer = [];
  StreamSubscription<Position>? _locationSub;
  Timer? _flushTimer;

  TelemetryService({http.Client? client}) : _http = client ?? http.Client();

  Future<String> startTrip(
    LatLon origin,
    LatLon destination,
    String profile,
  ) async {
    final permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      throw Exception('Location permission denied');
    }

    final uri = Uri.parse('${AtlasConfig.baseUrl}/v1/telemetry/start');
    final response = await _http.post(
      uri,
      headers: AtlasConfig.headers,
      body: jsonEncode({
        'profile': profile,
        'origin': origin.toJson(),
        'destination': destination.toJson(),
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to start trip: ${response.statusCode}');
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    _tripId = data['trip_id'] as String;

    _locationSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 50,
      ),
    ).listen((position) {
      _buffer.add(TelemetryWaypoint(
        lat: position.latitude,
        lon: position.longitude,
        timestamp: position.timestamp.toUtc().toIso8601String(),
        speedKmh: position.speed >= 0 ? position.speed * 3.6 : null,
        bearing: position.heading >= 0 ? position.heading : null,
      ));

      if (_buffer.length >= _batchSize) _flush();
    });

    _flushTimer = Timer.periodic(_flushInterval, (_) => _flush());
    return _tripId!;
  }

  Future<void> _flush() async {
    final tripId = _tripId;
    if (tripId == null || _buffer.isEmpty) return;

    final batch = _buffer.take(_batchSize).toList();
    _buffer.removeRange(0, batch.length);

    final uri = Uri.parse('${AtlasConfig.baseUrl}/v1/telemetry/$tripId/update');
    await _http.post(
      uri,
      headers: AtlasConfig.headers,
      body: jsonEncode({'waypoints': batch.map((w) => w.toJson()).toList()}),
    );
  }

  Future<TripSummary?> endTrip() async {
    final tripId = _tripId;
    if (tripId == null) return null;

    _locationSub?.cancel();
    _locationSub = null;
    _flushTimer?.cancel();
    _flushTimer = null;

    await _flush();
    _tripId = null;
    _buffer.clear();

    final uri = Uri.parse('${AtlasConfig.baseUrl}/v1/telemetry/$tripId/end');
    final response = await _http.post(uri, headers: AtlasConfig.headers);

    if (response.statusCode != 200) return null;
    return TripSummary.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }
}
```

## Complete delivery app screen

```dart
// lib/screens/delivery_screen.dart
import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import '../models/atlas_models.dart';
import '../services/atlas_client.dart';
import '../services/telemetry_service.dart';
import '../widgets/atlas_map.dart';

class DeliveryScreen extends StatefulWidget {
  const DeliveryScreen({super.key});

  @override
  State<DeliveryScreen> createState() => _DeliveryScreenState();
}

class _DeliveryScreenState extends State<DeliveryScreen> {
  final _atlasClient = AtlasClient();
  final _telemetry = TelemetryService();

  MaplibreMapController? _mapController;
  RouteResult? _route;
  bool _tripActive = false;
  TripSummary? _summary;

  static const _depot = LatLon(5.603, -0.187);
  static const _delivery = LatLon(5.614, -0.220);

  Future<void> _startDelivery() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Share location data?'),
        content: const Text('Help improve ETAs for everyone. Your data is anonymized.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No thanks')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yes, share')),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final results = await Future.wait([
        _atlasClient.route(_depot, _delivery, profile: 'motorcycle'),
        _telemetry.startTrip(_depot, _delivery, 'motorcycle'),
      ]);

      final route = results[0] as RouteResult;
      setState(() { _route = route; _tripActive = true; _summary = null; });

      _mapController?.animateCamera(CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(
            [_depot.lat, _delivery.lat].reduce((a, b) => a < b ? a : b),
            [_depot.lon, _delivery.lon].reduce((a, b) => a < b ? a : b),
          ),
          northeast: LatLng(
            [_depot.lat, _delivery.lat].reduce((a, b) => a > b ? a : b),
            [_depot.lon, _delivery.lon].reduce((a, b) => a > b ? a : b),
          ),
        ),
        left: 50, right: 50, top: 50, bottom: 200,
      ));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _endDelivery() async {
    final summary = await _telemetry.endTrip();
    setState(() { _route = null; _tripActive = false; _summary = summary; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          AtlasMap(onMapReady: (controller) => _mapController = controller),

          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 8)],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_route != null)
                    Text(
                      '${(_route!.distanceM / 1000).toStringAsFixed(1)} km · ${(_route!.durationS / 60).round()} min',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  if (_summary != null)
                    Text(
                      'Trip complete: ${(_summary!.distanceM / 1000).toStringAsFixed(1)} km in ${(_summary!.durationS / 60).round()} min',
                      style: const TextStyle(color: Colors.grey),
                    ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _tripActive ? Colors.red : Colors.blue,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: _tripActive ? _endDelivery : _startDelivery,
                      child: Text(
                        _tripActive ? 'End Delivery' : 'Start Delivery',
                        style: const TextStyle(color: Colors.white, fontSize: 16),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```
