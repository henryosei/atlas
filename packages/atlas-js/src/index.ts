export interface LatLon {
  lat: number;
  lon: number;
}

export interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
  category: string;
  address: string | null;
  confidence: number;
}

export interface ReverseGeocodeResult {
  name: string;
  lat: number;
  lon: number;
  distance_m: number;
  category: string;
}

export interface SearchResult {
  name: string;
  lat: number;
  lon: number;
  category: string;
  address: string | null;
  distance_m: number | null;
  score: number;
}

export interface RouteInstruction {
  type: string;
  road: string | null;
  distance_m: number;
  bearing: number;
}

export interface RouteResult {
  distance_m: number;
  duration_s: number;
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
  instructions: RouteInstruction[];
}

export interface MatrixResult {
  durations_s: number[][];
  distances_m: number[][];
}

export interface TelemetryPoint {
  lat: number;
  lon: number;
  timestamp: string;
  speed_kmh?: number;
  bearing?: number;
}

export interface TripStartResult {
  trip_id: string;
}

export interface TripEndResult {
  status: string;
  duration_s: number;
  distance_m: number;
}

export interface ContributionData {
  route_origin: LatLon;
  route_destination: LatLon;
  profile: string;
  issue_type: string;
  description?: string;
}

export interface ContributionResult {
  id: string;
}

export type RoutingProfile = 'car' | 'motorcycle' | 'bicycle' | 'foot';

export class AtlasError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AtlasError';
  }
}

export interface AtlasClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}

export class AtlasClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(options: AtlasClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://api.atlas-maps.dev').replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    return h;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers ?? {}) }
    });

    if (!response.ok) {
      let code = 'internal_error';
      try {
        const body = await response.json() as { error?: string; message?: string };
        code = body.error ?? code;
        throw new AtlasError(body.message ?? response.statusText, response.status, code);
      } catch (err) {
        if (err instanceof AtlasError) throw err;
        throw new AtlasError(response.statusText, response.status, code);
      }
    }

    return response.json() as Promise<T>;
  }

  async geocode(
    query: string,
    options?: { limit?: number; country?: string; lat?: number; lon?: number }
  ): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit != null) params.set('limit', String(options.limit));
    if (options?.country) params.set('country', options.country);
    if (options?.lat != null) params.set('lat', String(options.lat));
    if (options?.lon != null) params.set('lon', String(options.lon));

    const data = await this.request<{ results: GeocodeResult[] }>(`/v1/geocode?${params}`);
    return data.results;
  }

  async reverseGeocode(
    lat: number,
    lon: number,
    options?: { limit?: number }
  ): Promise<ReverseGeocodeResult[]> {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    if (options?.limit != null) params.set('limit', String(options.limit));

    const data = await this.request<{ results: ReverseGeocodeResult[] }>(`/v1/reverse?${params}`);
    return data.results;
  }

  async search(params: {
    q?: string;
    lat?: number;
    lon?: number;
    category?: string;
    radius_km?: number;
    limit?: number;
  }): Promise<SearchResult[]> {
    if (!params.q && !params.category) {
      throw new AtlasError('Either q or category is required', 400, 'invalid_request');
    }

    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.lat != null) qs.set('lat', String(params.lat));
    if (params.lon != null) qs.set('lon', String(params.lon));
    if (params.category) qs.set('category', params.category);
    if (params.radius_km != null) qs.set('radius_km', String(params.radius_km));
    if (params.limit != null) qs.set('limit', String(params.limit));

    const data = await this.request<{ results: SearchResult[] }>(`/v1/search?${qs}`);
    return data.results;
  }

  async route(
    origin: LatLon,
    destination: LatLon,
    profile: RoutingProfile = 'car'
  ): Promise<RouteResult> {
    return this.request<RouteResult>('/v1/route', {
      method: 'POST',
      body: JSON.stringify({ origin, destination, profile })
    });
  }

  async matrix(
    origins: LatLon[],
    destinations: LatLon[],
    profile: RoutingProfile = 'car'
  ): Promise<MatrixResult> {
    if (origins.length === 0 || destinations.length === 0) {
      throw new AtlasError('Origins and destinations must not be empty', 400, 'invalid_request');
    }
    if (origins.length > 25 || destinations.length > 25) {
      throw new AtlasError('Maximum 25 origins and 25 destinations', 400, 'invalid_request');
    }

    return this.request<MatrixResult>('/v1/matrix', {
      method: 'POST',
      body: JSON.stringify({ origins, destinations, profile })
    });
  }

  async startTrip(
    profile: RoutingProfile,
    origin: LatLon,
    destination: LatLon
  ): Promise<TripStartResult> {
    return this.request<TripStartResult>('/v1/telemetry/start', {
      method: 'POST',
      body: JSON.stringify({ profile, origin, destination })
    });
  }

  async sendTelemetry(tripId: string, waypoints: TelemetryPoint[]): Promise<void> {
    if (!tripId) throw new AtlasError('tripId is required', 400, 'invalid_request');
    if (waypoints.length === 0) return;
    if (waypoints.length > 100) {
      throw new AtlasError('Maximum 100 waypoints per call', 400, 'invalid_request');
    }

    await this.request<void>(`/v1/telemetry/${encodeURIComponent(tripId)}/update`, {
      method: 'POST',
      body: JSON.stringify({ waypoints })
    });
  }

  async endTrip(tripId: string): Promise<TripEndResult> {
    if (!tripId) throw new AtlasError('tripId is required', 400, 'invalid_request');

    return this.request<TripEndResult>(`/v1/telemetry/${encodeURIComponent(tripId)}/end`, {
      method: 'POST'
    });
  }

  async reportIssue(data: ContributionData): Promise<ContributionResult> {
    return this.request<ContributionResult>('/v1/contribute', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  tileUrl(tileset: string, z: number, x: number, y: number): string {
    return `${this.baseUrl}/v1/tiles/${tileset}/${z}/${x}/${y}.mvt`;
  }

  tileJsonUrl(tileset: string): string {
    return `${this.baseUrl}/v1/tiles/${tileset}/tilejson.json`;
  }
}
