/**
 * JARVIS WEATHER ENGINE TYPES & INTERFACES (PHASE 3)
 * 
 * Strict typing for OpenWeather real data ingestion, caching, and AI synthesis.
 */

export interface WeatherCoordinates {
  lat: number;
  lon: number;
}

export interface WeatherLocationQuery {
  lat?: number;
  lon?: number;
  city?: string;
  countryCode?: string;
}

export interface WindData {
  speedKmH: number;
  speedMs: number;
  deg?: number;
  directionText: string;
  gustKmH?: number;
}

export interface WeatherCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
  iconUrl: string;
}

export interface CurrentWeatherData {
  temperature: number; // °C
  feelsLike: number; // °C
  tempMin: number; // °C
  tempMax: number; // °C
  humidity: number; // %
  pressure: number; // hPa
  wind: WindData;
  conditions: WeatherCondition;
  clouds: number; // %
  visibilityMeters?: number;
  rain?: {
    last1hMm?: number;
    last3hMm?: number;
  };
  snow?: {
    last1hMm?: number;
    last3hMm?: number;
  };
  sunrise?: number; // timestamp in ms
  sunset?: number; // timestamp in ms
  location: {
    city: string;
    country: string;
    lat: number;
    lon: number;
  };
  timestamp: number; // fetch timestamp ms
  lastUpdatedFormatted: string; // HH:mm:ss
  source: 'openweather' | 'cache';
}

export interface ForecastItem {
  timestamp: number;
  timeFormatted: string; // HH:mm
  dateFormatted: string; // DD/MM
  dayOfWeek: string; // Lundi, Mardi...
  temp: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  conditions: WeatherCondition;
  wind: {
    speedKmH: number;
    directionText: string;
  };
  pop: number; // Probability of precipitation (0 - 1)
  rainMm?: number;
}

export interface DailyForecastSummary {
  dateFormatted: string;
  dayOfWeek: string;
  tempMin: number;
  tempMax: number;
  conditions: string;
  iconUrl: string;
  rainChancePct: number;
  rainTotalMm: number;
}

export interface WeatherForecastData {
  location: {
    city: string;
    country: string;
    lat: number;
    lon: number;
  };
  list: ForecastItem[];
  dailySummary: DailyForecastSummary[];
  timestamp: number;
  lastUpdatedFormatted: string;
  source: 'openweather' | 'cache';
}

export interface FullWeatherReport {
  current: CurrentWeatherData;
  forecast?: WeatherForecastData;
  summaryMarkdown: string;
  spokenSummary: string;
  timestamp: number;
  lastUpdatedFormatted: string;
  isCached: boolean;
}

export interface WeatherServiceStatus {
  isConfigured: boolean;
  hasApiKey: boolean;
  lastSuccessfulFetch: number | null;
  cacheEntriesCount: number;
  lastKnownLocation?: {
    city: string;
    lat: number;
    lon: number;
    timestamp: number;
  };
}
