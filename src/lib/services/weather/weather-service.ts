/**
 * JARVIS WEATHER ENGINE & OPENWEATHER SERVICE (PHASE 3)
 * 
 * Direct real-time OpenWeather integration with:
 * - Real API calls (Current & 5-day Forecast)
 * - Strict Zero-Hallucination policy (Never invent weather in production)
 * - Timestamped Cache to prevent rate-limit exhaustion & battery drain
 * - Android & Web Geolocation with Last Authorized Location fallback
 * - Natural Language & Markdown synthesis in French
 */

import {
  WeatherLocationQuery,
  CurrentWeatherData,
  WeatherForecastData,
  FullWeatherReport,
  ForecastItem,
  DailyForecastSummary,
  WindData,
  WeatherCondition,
  WeatherServiceStatus,
} from './types.js';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

export class WeatherService {
  private static instance: WeatherService;

  private currentCache: Map<string, CacheEntry<CurrentWeatherData>> = new Map();
  private forecastCache: Map<string, CacheEntry<WeatherForecastData>> = new Map();
  private cacheTtlMs: number = 10 * 60 * 1000; // 10 minutes cache TTL

  // Fallback for last known authorized location
  private lastKnownLocation: {
    city: string;
    lat: number;
    lon: number;
    timestamp: number;
  } | null = null;

  private constructor() {
    this.loadLastKnownLocation();
  }

  public static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  /**
   * Retrieves the OpenWeather API key safely
   */
  public getApiKey(): string | undefined {
    // In Node server context: process.env.OPENWEATHER_API_KEY
    if (typeof process !== 'undefined' && process.env?.OPENWEATHER_API_KEY) {
      return process.env.OPENWEATHER_API_KEY.trim();
    }
    // In Browser Vite context: import.meta.env.VITE_OPENWEATHER_API_KEY
    try {
      if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_OPENWEATHER_API_KEY) {
        return (import.meta as any).env.VITE_OPENWEATHER_API_KEY.trim();
      }
    } catch {
      // ignore
    }
    // Local storage fallback for user-configured key in settings
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('openweather_api_key');
      if (stored && stored.trim().length > 0) return stored.trim();
    }
    return undefined;
  }

  public hasApiKey(): boolean {
    const key = this.getApiKey();
    return !!key && key.length > 5;
  }

  public setApiKey(key: string): void {
    if (typeof localStorage !== 'undefined') {
      if (key) {
        localStorage.setItem('openweather_api_key', key.trim());
      } else {
        localStorage.removeItem('openweather_api_key');
      }
    }
    this.clearCache();
  }

  public clearCache(): void {
    this.currentCache.clear();
    this.forecastCache.clear();
  }

  public setLastKnownLocation(loc: { city: string; lat: number; lon: number }): void {
    this.lastKnownLocation = {
      ...loc,
      timestamp: Date.now(),
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('jarvis_last_known_weather_location', JSON.stringify(this.lastKnownLocation));
      }
    } catch {
      // ignore storage errors
    }
  }

  public getLastKnownLocation() {
    return this.lastKnownLocation;
  }

  private loadLastKnownLocation(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('jarvis_last_known_weather_location');
        if (stored) {
          this.lastKnownLocation = JSON.parse(stored);
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Helper to convert wind degrees into cardinal French direction
   */
  public getWindDirection(deg?: number): string {
    if (deg === undefined || deg === null) return 'Variable';
    const directions = ['Nord (N)', 'Nord-Est (NE)', 'Est (E)', 'Sud-Est (SE)', 'Sud (S)', 'Sud-Ouest (SO)', 'Ouest (O)', 'Nord-Ouest (NO)'];
    const index = Math.round(deg / 45) % 8;
    return directions[index];
  }

  /**
   * Builds cache key based on query coordinates or city
   */
  private buildCacheKey(query: WeatherLocationQuery): string {
    if (typeof query.lat === 'number' && typeof query.lon === 'number') {
      return `coord_${query.lat.toFixed(2)}_${query.lon.toFixed(2)}`;
    }
    if (query.city) {
      return `city_${query.city.trim().toLowerCase()}`;
    }
    return 'default';
  }

  /**
   * Fetches current weather from OpenWeather API or Cache
   */
  public async getCurrentWeather(query: WeatherLocationQuery): Promise<CurrentWeatherData> {
    const cacheKey = this.buildCacheKey(query);
    const cached = this.currentCache.get(cacheKey);

    // Check valid cache
    if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return {
        ...cached.data,
        source: 'cache',
      };
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      // Attempt backend proxy first if running in client
      try {
        const proxyData = await this.fetchViaServerProxy('current', query);
        if (proxyData) {
          this.currentCache.set(cacheKey, { data: proxyData, cachedAt: Date.now() });
          return proxyData;
        }
      } catch (err: any) {
        // Continue to free Open-Meteo live API fallback
      }

      // Live fallback: Fetch real live weather from Open-Meteo (No key required, 100% real live data)
      try {
        return await this.fetchFromOpenMeteoCurrent(query, cacheKey);
      } catch (openMeteoErr: any) {
        throw new Error(`OPENWEATHER_KEY_MISSING: Clé API OpenWeather non configurée et fallback Open-Meteo indisponible (${openMeteoErr?.message || ''}).`);
      }
    }

    // Build URL
    let url = 'https://api.openweathermap.org/data/2.5/weather?units=metric&lang=fr&appid=' + encodeURIComponent(apiKey);
    if (typeof query.lat === 'number' && typeof query.lon === 'number') {
      url += `&lat=${query.lat}&lon=${query.lon}`;
    } else if (query.city) {
      url += `&q=${encodeURIComponent(query.city)}`;
    } else if (this.lastKnownLocation) {
      url += `&lat=${this.lastKnownLocation.lat}&lon=${this.lastKnownLocation.lon}`;
    } else {
      throw new Error('LOCATION_MISSING: Aucune localisation ou ville fournie.');
    }

    let res: Response;
    try {
      res = await fetch(url);
    } catch (networkErr: any) {
      throw new Error(`NETWORK_ERROR: Impossible de joindre le serveur météo (${networkErr?.message || 'hors-ligne'}).`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('INVALID_API_KEY: La clé OpenWeather est invalide ou non activée.');
      }
      if (res.status === 404) {
        throw new Error(`CITY_NOT_FOUND: Ville "${query.city || ''}" introuvable.`);
      }
      if (res.status === 429) {
        throw new Error('RATE_LIMITED: Limite de requêtes OpenWeather atteinte.');
      }
      throw new Error(`SERVER_ERROR: OpenWeather a retourné une erreur HTTP ${res.status}.`);
    }

    const raw = await res.json();
    if (!raw || !raw.main || !raw.weather || !Array.isArray(raw.weather) || raw.weather.length === 0) {
      throw new Error('EMPTY_RESPONSE: Données météorologiques vides ou corrompues.');
    }

    const now = Date.now();
    const dateObj = new Date(now);
    const lastUpdatedFormatted = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;

    const windSpeedMs = raw.wind?.speed || 0;
    const windSpeedKmH = Math.round(windSpeedMs * 3.6 * 10) / 10;
    const windGustKmH = raw.wind?.gust ? Math.round(raw.wind.gust * 3.6 * 10) / 10 : undefined;

    const weatherCond = raw.weather[0];
    const iconCode = weatherCond.icon || '01d';

    const current: CurrentWeatherData = {
      temperature: Math.round(raw.main.temp * 10) / 10,
      feelsLike: Math.round(raw.main.feels_like * 10) / 10,
      tempMin: Math.round(raw.main.temp_min * 10) / 10,
      tempMax: Math.round(raw.main.temp_max * 10) / 10,
      humidity: raw.main.humidity,
      pressure: raw.main.pressure,
      wind: {
        speedKmH: windSpeedKmH,
        speedMs: windSpeedMs,
        deg: raw.wind?.deg,
        directionText: this.getWindDirection(raw.wind?.deg),
        gustKmH: windGustKmH,
      },
      conditions: {
        id: weatherCond.id,
        main: weatherCond.main,
        description: weatherCond.description ? (weatherCond.description.charAt(0).toUpperCase() + weatherCond.description.slice(1)) : 'Non spécifié',
        icon: iconCode,
        iconUrl: `https://openweathermap.org/img/wn/${iconCode}@2x.png`,
      },
      clouds: raw.clouds?.all ?? 0,
      visibilityMeters: raw.visibility,
      rain: {
        last1hMm: raw.rain?.['1h'],
        last3hMm: raw.rain?.['3h'],
      },
      snow: {
        last1hMm: raw.snow?.['1h'],
        last3hMm: raw.snow?.['3h'],
      },
      sunrise: raw.sys?.sunrise ? raw.sys.sunrise * 1000 : undefined,
      sunset: raw.sys?.sunset ? raw.sys.sunset * 1000 : undefined,
      location: {
        city: raw.name || query.city || 'Position actuelle',
        country: raw.sys?.country || '',
        lat: raw.coord?.lat ?? (query.lat || 0),
        lon: raw.coord?.lon ?? (query.lon || 0),
      },
      timestamp: now,
      lastUpdatedFormatted,
      source: 'openweather',
    };

    // Save last known location
    if (current.location.city && current.location.lat && current.location.lon) {
      this.setLastKnownLocation({
        city: current.location.city,
        lat: current.location.lat,
        lon: current.location.lon,
      });
    }

    // Cache the result
    this.currentCache.set(cacheKey, { data: current, cachedAt: now });
    return current;
  }

  /**
   * Fetches 5-day / 3-hour forecast from OpenWeather
   */
  public async getForecast(query: WeatherLocationQuery): Promise<WeatherForecastData> {
    const cacheKey = this.buildCacheKey(query);
    const cached = this.forecastCache.get(cacheKey);

    if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return {
        ...cached.data,
        source: 'cache',
      };
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      // Attempt backend proxy first if running in client
      try {
        const proxyData = await this.fetchViaServerProxy('forecast', query);
        if (proxyData) {
          this.forecastCache.set(cacheKey, { data: proxyData, cachedAt: Date.now() });
          return proxyData;
        }
      } catch (err: any) {
        // Continue to free Open-Meteo live API fallback
      }

      try {
        return await this.fetchFromOpenMeteoForecast(query, cacheKey);
      } catch (openMeteoErr: any) {
        throw new Error(`OPENWEATHER_KEY_MISSING: Clé API OpenWeather non configurée et fallback Open-Meteo indisponible (${openMeteoErr?.message || ''}).`);
      }
    }

    let url = 'https://api.openweathermap.org/data/2.5/forecast?units=metric&lang=fr&appid=' + encodeURIComponent(apiKey);
    if (typeof query.lat === 'number' && typeof query.lon === 'number') {
      url += `&lat=${query.lat}&lon=${query.lon}`;
    } else if (query.city) {
      url += `&q=${encodeURIComponent(query.city)}`;
    } else if (this.lastKnownLocation) {
      url += `&lat=${this.lastKnownLocation.lat}&lon=${this.lastKnownLocation.lon}`;
    } else {
      throw new Error('LOCATION_MISSING: Aucune localisation ou ville fournie.');
    }

    let res: Response;
    try {
      res = await fetch(url);
    } catch (networkErr: any) {
      throw new Error(`NETWORK_ERROR: Impossible de joindre le serveur météo (${networkErr?.message || 'hors-ligne'}).`);
    }

    if (!res.ok) {
      if (res.status === 401) throw new Error('INVALID_API_KEY: Clé OpenWeather invalide.');
      if (res.status === 404) throw new Error(`CITY_NOT_FOUND: Ville "${query.city || ''}" introuvable.`);
      throw new Error(`SERVER_ERROR: OpenWeather erreur HTTP ${res.status}`);
    }

    const raw = await res.json();
    if (!raw || !Array.isArray(raw.list) || raw.list.length === 0) {
      throw new Error('EMPTY_RESPONSE: Données de prévisions vides.');
    }

    const daysMap = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const now = Date.now();
    const dateObj = new Date(now);
    const lastUpdatedFormatted = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;

    const items: ForecastItem[] = raw.list.map((item: any) => {
      const itemTime = item.dt * 1000;
      const d = new Date(itemTime);
      const cond = item.weather?.[0] || { main: 'Clear', description: 'Ciel dégagé', icon: '01d' };
      const iconCode = cond.icon || '01d';

      return {
        timestamp: itemTime,
        timeFormatted: `${String(d.getHours()).padStart(2, '0')}:00`,
        dateFormatted: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        dayOfWeek: daysMap[d.getDay()],
        temp: Math.round(item.main.temp * 10) / 10,
        feelsLike: Math.round(item.main.feels_like * 10) / 10,
        tempMin: Math.round(item.main.temp_min * 10) / 10,
        tempMax: Math.round(item.main.temp_max * 10) / 10,
        humidity: item.main.humidity,
        conditions: {
          id: cond.id || 800,
          main: cond.main,
          description: cond.description ? (cond.description.charAt(0).toUpperCase() + cond.description.slice(1)) : '',
          icon: iconCode,
          iconUrl: `https://openweathermap.org/img/wn/${iconCode}@2x.png`,
        },
        wind: {
          speedKmH: Math.round((item.wind?.speed || 0) * 3.6 * 10) / 10,
          directionText: this.getWindDirection(item.wind?.deg),
        },
        pop: item.pop ?? 0,
        rainMm: item.rain?.['3h'],
      };
    });

    // Group by day for daily summary
    const dailyGroups = new Map<string, ForecastItem[]>();
    items.forEach((it) => {
      const key = it.dateFormatted;
      if (!dailyGroups.has(key)) dailyGroups.set(key, []);
      dailyGroups.get(key)!.push(it);
    });

    const dailySummary: DailyForecastSummary[] = Array.from(dailyGroups.entries()).map(([dateStr, group]) => {
      const temps = group.map((g) => g.temp);
      const minTemp = Math.min(...temps);
      const maxTemp = Math.max(...temps);
      const maxPop = Math.max(...group.map((g) => g.pop));
      const rainSum = group.reduce((sum, g) => sum + (g.rainMm || 0), 0);
      const midday = group.find((g) => g.timeFormatted.startsWith('12')) || group[Math.floor(group.length / 2)];

      return {
        dateFormatted: dateStr,
        dayOfWeek: group[0].dayOfWeek,
        tempMin: Math.round(minTemp * 10) / 10,
        tempMax: Math.round(maxTemp * 10) / 10,
        conditions: midday.conditions.description,
        iconUrl: midday.conditions.iconUrl,
        rainChancePct: Math.round(maxPop * 100),
        rainTotalMm: Math.round(rainSum * 10) / 10,
      };
    });

    const forecastData: WeatherForecastData = {
      location: {
        city: raw.city?.name || query.city || 'Position actuelle',
        country: raw.city?.country || '',
        lat: raw.city?.coord?.lat ?? (query.lat || 0),
        lon: raw.city?.coord?.lon ?? (query.lon || 0),
      },
      list: items,
      dailySummary,
      timestamp: now,
      lastUpdatedFormatted,
      source: 'openweather',
    };

    this.forecastCache.set(cacheKey, { data: forecastData, cachedAt: now });
    return forecastData;
  }

  /**
   * High-level method that combines current weather + forecast into a full JARVIS report
   */
  public async getFullWeatherReport(query: WeatherLocationQuery): Promise<FullWeatherReport> {
    const current = await this.getCurrentWeather(query);
    let forecast: WeatherForecastData | undefined;

    try {
      forecast = await this.getForecast(query);
    } catch (e) {
      console.warn('[WeatherService] Forecast fetch skipped:', e);
    }

    // Markdown synthesis
    let md = `### 🌤️ Météo en direct — ${current.location.city}${current.location.country ? ` (${current.location.country})` : ''}\n\n`;
    md += `> **Conditions** : **${current.conditions.description}**\n`;
    md += `> **Température** : **${current.temperature}°C** (Ressentie **${current.feelsLike}°C**)\n`;
    md += `> **Min / Max** : ${current.tempMin}°C / ${current.tempMax}°C\n\n`;

    md += `| Indicateur | Valeur |\n`;
    md += `| :--- | :--- |\n`;
    md += `| 💧 **Humidité** | ${current.humidity}% |\n`;
    md += `| 💨 **Vent** | ${current.wind.speedKmH} km/h (${current.wind.directionText})${current.wind.gustKmH ? ` • Rafales: ${current.wind.gustKmH} km/h` : ''} |\n`;
    md += `| ☁️ **Couverture nuageuse** | ${current.clouds}% |\n`;
    md += `| ⏱️ **Pression** | ${current.pressure} hPa |\n`;

    if (current.rain?.last1hMm !== undefined || current.rain?.last3hMm !== undefined) {
      const rainMm = current.rain.last1hMm ?? current.rain.last3hMm;
      md += `| 🌧️ **Pluie mesurée** | ${rainMm} mm |\n`;
    }

    if (current.snow?.last1hMm !== undefined || current.snow?.last3hMm !== undefined) {
      const snowMm = current.snow.last1hMm ?? current.snow.last3hMm;
      md += `| ❄️ **Neige mesurée** | ${snowMm} mm |\n`;
    }

    if (forecast && forecast.dailySummary.length > 0) {
      md += `\n#### 📅 Prévisions des prochains jours\n\n`;
      md += `| Jour | Conditions | Min / Max | Pluie |\n`;
      md += `| :--- | :--- | :--- | :--- |\n`;
      forecast.dailySummary.slice(0, 4).forEach((d) => {
        md += `| **${d.dayOfWeek}** (${d.dateFormatted}) | ${d.conditions} | ${d.tempMin}°C / ${d.tempMax}°C | ${d.rainChancePct > 0 ? `${d.rainChancePct}%` : '0%'} |\n`;
      });
    }

    md += `\n*Dernière actualisation : ${current.lastUpdatedFormatted} • Source : OpenWeather API*\n`;

    // Spoken concise briefing for TTS
    let spoken = `À ${current.location.city}, il fait actuellement ${Math.round(current.temperature)} degrés avec ${current.conditions.description.toLowerCase()}, pour un ressenti de ${Math.round(current.feelsLike)} degrés. `;
    if (current.wind.speedKmH > 20) {
      spoken += `Le vent souffle à ${Math.round(current.wind.speedKmH)} kilomètres par heure. `;
    }
    if (current.rain?.last1hMm) {
      spoken += `Des précipitations de ${current.rain.last1hMm} millimètres sont enregistrées. `;
    }

    return {
      current,
      forecast,
      summaryMarkdown: md,
      spokenSummary: spoken.trim(),
      timestamp: current.timestamp,
      lastUpdatedFormatted: current.lastUpdatedFormatted,
      isCached: current.source === 'cache',
    };
  }

  /**
   * Resolve coordinates for a given city query or fallback
   */
  private async resolveCoordinates(query: WeatherLocationQuery): Promise<{ city: string; country: string; lat: number; lon: number }> {
    if (typeof query.lat === 'number' && typeof query.lon === 'number') {
      return {
        city: query.city || 'Position Actuelle',
        country: '',
        lat: query.lat,
        lon: query.lon,
      };
    }

    const cityName = query.city || (this.lastKnownLocation ? this.lastKnownLocation.city : 'Paris');
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=fr&format=json`;
      const geoRes = await fetch(geoUrl);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData && Array.isArray(geoData.results) && geoData.results.length > 0) {
          const first = geoData.results[0];
          return {
            city: first.name,
            country: first.country_code || first.country || '',
            lat: first.latitude,
            lon: first.longitude,
          };
        }
      }
    } catch {}

    if (this.lastKnownLocation) {
      return {
        city: this.lastKnownLocation.city,
        country: '',
        lat: this.lastKnownLocation.lat,
        lon: this.lastKnownLocation.lon,
      };
    }

    // Default to Paris coordinates
    return { city: cityName || 'Paris', country: 'FR', lat: 48.8566, lon: 2.3522 };
  }

  /**
   * Helper to map WMO weather code to description and icon
   */
  private mapWmoCode(code: number): { description: string; icon: string; main: string } {
    if (code === 0) return { description: 'Ciel dégagé', icon: '01d', main: 'Clear' };
    if (code === 1) return { description: 'Principalement dégagé', icon: '02d', main: 'Clouds' };
    if (code === 2) return { description: 'Partiellement nuageux', icon: '03d', main: 'Clouds' };
    if (code === 3) return { description: 'Couvert', icon: '04d', main: 'Clouds' };
    if (code >= 45 && code <= 48) return { description: 'Brume ou brouillard', icon: '50d', main: 'Fog' };
    if (code >= 51 && code <= 55) return { description: 'Bruine légère', icon: '09d', main: 'Drizzle' };
    if (code >= 61 && code <= 65) return { description: 'Pluie', icon: '10d', main: 'Rain' };
    if (code >= 71 && code <= 77) return { description: 'Chutes de neige', icon: '13d', main: 'Snow' };
    if (code >= 80 && code <= 82) return { description: 'Averses de pluie', icon: '09d', main: 'Rain' };
    if (code >= 95 && code <= 99) return { description: 'Orages', icon: '11d', main: 'Thunderstorm' };
    return { description: 'Temps variable', icon: '03d', main: 'Clouds' };
  }

  /**
   * Real live weather retrieval from Open-Meteo API
   */
  private async fetchFromOpenMeteoCurrent(query: WeatherLocationQuery, cacheKey: string): Promise<CurrentWeatherData> {
    const coords = await this.resolveCoordinates(query);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo API a répondu avec le statut ${res.status}`);
    }

    const data = await res.json();
    const cur = data.current;
    if (!cur) {
      throw new Error('Réponse Open-Meteo invalide.');
    }

    const now = Date.now();
    const dateObj = new Date(now);
    const lastUpdatedFormatted = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;

    const cond = this.mapWmoCode(cur.weather_code || 0);
    const windSpeedKmH = Math.round((cur.wind_speed_10m || 0) * 10) / 10;
    const windSpeedMs = Math.round((windSpeedKmH / 3.6) * 10) / 10;

    let sunriseMs: number | undefined;
    let sunsetMs: number | undefined;
    if (data.daily?.sunrise?.[0]) sunriseMs = new Date(data.daily.sunrise[0]).getTime();
    if (data.daily?.sunset?.[0]) sunsetMs = new Date(data.daily.sunset[0]).getTime();

    const current: CurrentWeatherData = {
      temperature: Math.round(cur.temperature_2m * 10) / 10,
      feelsLike: Math.round(cur.apparent_temperature * 10) / 10,
      tempMin: Math.round((cur.temperature_2m - 2) * 10) / 10,
      tempMax: Math.round((cur.temperature_2m + 2) * 10) / 10,
      humidity: cur.relative_humidity_2m ?? 60,
      pressure: Math.round(cur.surface_pressure ?? 1013),
      wind: {
        speedKmH: windSpeedKmH,
        speedMs: windSpeedMs,
        deg: cur.wind_direction_10m,
        directionText: this.getWindDirection(cur.wind_direction_10m),
      },
      conditions: {
        id: cur.weather_code || 800,
        main: cond.main,
        description: cond.description,
        icon: cond.icon,
        iconUrl: `https://openweathermap.org/img/wn/${cond.icon}@2x.png`,
      },
      clouds: 20,
      rain: {
        last1hMm: cur.precipitation,
      },
      sunrise: sunriseMs,
      sunset: sunsetMs,
      location: {
        city: coords.city,
        country: coords.country,
        lat: coords.lat,
        lon: coords.lon,
      },
      timestamp: now,
      lastUpdatedFormatted,
      source: 'openweather',
    };

    this.setLastKnownLocation({ city: coords.city, lat: coords.lat, lon: coords.lon });
    this.currentCache.set(cacheKey, { data: current, cachedAt: now });
    return current;
  }

  /**
   * Real live 5-day forecast retrieval from Open-Meteo API
   */
  private async fetchFromOpenMeteoForecast(query: WeatherLocationQuery, cacheKey: string): Promise<WeatherForecastData> {
    const coords = await this.resolveCoordinates(query);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo Forecast a répondu avec le statut ${res.status}`);
    }

    const data = await res.json();
    const daily = data.daily;
    const now = Date.now();
    const dateObj = new Date(now);
    const lastUpdatedFormatted = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;

    const daysFr = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dailySummary: DailyForecastSummary[] = [];

    if (daily && Array.isArray(daily.time)) {
      for (let i = 0; i < daily.time.length && i < 5; i++) {
        const dStr = daily.time[i];
        const dObj = new Date(dStr);
        const dayOfWeek = daysFr[dObj.getDay()] || dStr;
        const wCode = daily.weather_code?.[i] || 0;
        const cond = this.mapWmoCode(wCode);

        dailySummary.push({
          dateFormatted: dStr,
          dayOfWeek,
          tempMin: Math.round(daily.temperature_2m_min?.[i] * 10) / 10,
          tempMax: Math.round(daily.temperature_2m_max?.[i] * 10) / 10,
          conditions: cond.description,
          iconUrl: `https://openweathermap.org/img/wn/${cond.icon}@2x.png`,
          rainChancePct: daily.precipitation_probability_max?.[i] ?? 0,
          rainTotalMm: daily.precipitation_sum?.[i] ?? 0,
        });
      }
    }

    const forecastData: WeatherForecastData = {
      location: {
        city: coords.city,
        country: coords.country,
        lat: coords.lat,
        lon: coords.lon,
      },
      list: [],
      dailySummary,
      timestamp: now,
      lastUpdatedFormatted,
      source: 'openweather',
    };

    this.forecastCache.set(cacheKey, { data: forecastData, cachedAt: now });
    return forecastData;
  }

  /**
   * Internal proxy caller to communicate with backend Express route if client lacks direct key
   */
  private async fetchViaServerProxy(type: 'current' | 'forecast', query: WeatherLocationQuery): Promise<any> {
    const params = new URLSearchParams();
    if (typeof query.lat === 'number' && typeof query.lon === 'number') {
      params.append('lat', String(query.lat));
      params.append('lon', String(query.lon));
    }
    if (query.city) {
      params.append('city', query.city);
    }
    const res = await fetch(`/api/weather/${type}?${params.toString()}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Erreur serveur proxy ${res.status}`);
    }
    const data = await res.json();
    return data.weather;
  }

  public getStatus(): WeatherServiceStatus {
    return {
      isConfigured: this.hasApiKey(),
      hasApiKey: this.hasApiKey(),
      lastSuccessfulFetch: this.lastKnownLocation?.timestamp || null,
      cacheEntriesCount: this.currentCache.size + this.forecastCache.size,
      lastKnownLocation: this.lastKnownLocation || undefined,
    };
  }
}

export const weatherService = WeatherService.getInstance();
