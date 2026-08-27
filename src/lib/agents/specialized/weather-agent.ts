/**
 * WEATHER AGENT (Specialized Agent — Phase 3 Real Weather Engine)
 * 
 * Manages real-time weather inquiries, forecasts, rain alerts, and thermal comfort:
 * JARVIS -> Weather Agent -> Weather Service -> OpenWeather API -> Real Data -> AI Response
 * 
 * Strict Guarantees:
 * - Zero hallucination / Zero invented weather.
 * - Utilizes real OpenWeather API data (Current, Forecast, Rain, Wind, Humidity).
 * - Automatic Location resolution (Android GPS -> Query City -> Last Authorized Location).
 * - Standardized error message when API fails: "Je ne peux pas récupérer les données météo actuellement."
 * - Cache freshness and timestamp display.
 */

import {
  SpecializedAgent,
  AgentId,
  AgentCapability,
  AgentToolDefinition,
  AgentPermissionLevel,
  AgentInput,
  AgentOutput,
  AgentRoutingEvaluation,
} from '../agent-protocol.js';
import { weatherService, CurrentWeatherData, WeatherForecastData } from '../../services/weather/index.js';
import { contextEngine } from '../../services/context/index.js';
import { permissionManager } from '../../services/security/index.js';
import { redactSecrets } from '../../services/security-redactor.js';

export class WeatherAgent implements SpecializedAgent {
  public readonly id: AgentId = 'weather';
  public readonly name = 'JARVIS Weather & Atmosphere Agent';
  public readonly description = 'Moteur météorologique temps réel certifié OpenWeather. Fournit température, ressenti, humidité, vent, pluie, prévisions et alertes atmosphériques.';
  public readonly permissionLevel: AgentPermissionLevel = 'public';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'weather_current',
      name: 'Météo en Direct & Conditions Atmosphériques',
      description: 'Acquisition en direct de la température réelle, du ressenti, du vent, de l’humidité et des précipitations.',
      tags: [
        'météo',
        'meteo',
        'quel temps fait-il',
        'temps actuel',
        'temperature',
        'température',
        'dehors',
        'fait-il beau',
        'fait-il froid',
        'fait-il chaud',
        'climat',
      ],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'weather_forecast',
      name: 'Prévisions Météorologiques & Tendance',
      description: 'Prévisions horaires et plurijournalières sur 5 jours avec évolution des températures et probabilité de pluie.',
      tags: [
        'prévisions',
        'prevision meteo',
        'temps demain',
        'météo cette semaine',
        'temps ce week-end',
        'météo demain',
        'tendance météo',
      ],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'weather_rain_alert',
      name: 'Vérification Pluie & Précipitations',
      description: 'Détection des averses, volume de pluie mesuré en millimètres et conseil pour parapluie.',
      tags: [
        'va-t-il pleuvoir',
        'pleuvoir',
        'pluie',
        'parapluie',
        'averse',
        'orage',
        'risque de pluie',
        'neige',
      ],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'weather_clothing_advice',
      name: 'Conseil Vestimentaire & Confort Thermique',
      description: 'Recommandations pratiques d’habillement selon la température ressentie et le vent réel.',
      tags: [
        'comment m’habiller',
        'manteau',
        'faut-il une veste',
        'lunettes de soleil',
        'tenue pour sortir',
      ],
      requiredPermissions: [],
      riskLevel: 'low',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'get_current_weather',
      description: 'Récupère la météo en temps réel (OpenWeather) pour une ville ou des coordonnées GPS.',
      parameters: {
        city: { type: 'string', description: 'Nom de la ville (ex: Paris, Lyon, Tokyo)' },
        lat: { type: 'number', description: 'Latitude décimale GPS' },
        lon: { type: 'number', description: 'Longitude décimale GPS' },
      },
    },
    {
      name: 'get_weather_forecast',
      description: 'Récupère les prévisions météorologiques sur 5 jours avec probabilité de précipitations.',
      parameters: {
        city: { type: 'string', description: 'Nom de la ville' },
        lat: { type: 'number', description: 'Latitude décimale GPS' },
        lon: { type: 'number', description: 'Longitude décimale GPS' },
      },
    },
  ];

  /**
   * Evaluates if this agent can best handle the incoming query
   */
  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query.toLowerCase().trim();

    const weatherKeywords = [
      'météo',
      'meteo',
      'quel temps',
      'température',
      'temperature',
      'pleuvoir',
      'pluie',
      'parapluie',
      'orage',
      'dehors',
      'degrés',
      'degres',
      'fait-il chaud',
      'fait-il froid',
      'vent',
      'prévisions météo',
      'weather',
      'forecast',
    ];

    let matchedCount = 0;
    const matchedCaps: string[] = [];

    weatherKeywords.forEach((kw) => {
      if (q.includes(kw)) matchedCount++;
    });

    if (q.includes('prévision') || q.includes('demain') || q.includes('semaine') || q.includes('week-end')) {
      matchedCaps.push('weather_forecast');
    }
    if (q.includes('pleuvoir') || q.includes('pluie') || q.includes('parapluie') || q.includes('orage')) {
      matchedCaps.push('weather_rain_alert');
    }
    if (matchedCaps.length === 0 && matchedCount > 0) {
      matchedCaps.push('weather_current');
    }

    const score = matchedCount > 0 ? Math.min(1.0, 0.75 + matchedCount * 0.1) : 0.0;

    return {
      agentId: this.id,
      score,
      confidence: score > 0.7 ? 0.95 : 0.5,
      reason: matchedCount > 0
        ? `Requête météorologique explicite détectée (${matchedCount} correspondances).`
        : 'Aucun terme météorologique détecté.',
      matchedCapabilities: matchedCaps,
      requiredPermissions: [],
      isPermissionMet: true,
    };
  }

  /**
   * Helper to extract target city from query string
   */
  private extractCityFromQuery(query: string): string | null {
    const q = query.trim();

    // Match patterns like "météo à Paris", "quel temps fait-il à Lyon ?", "météo sur Marseille", "weather in London"
    const patterns = [
      /(?:météo|meteo|temps|température|temperature|pleuvoir|pluie)\s+(?:à|a|de|sur|pour|in|at)\s+([a-zA-Zà-ÿÀ-Ý\s-]+?)(?:\s+(?:aujourd'hui|demain|ce soir|ce week-end|\?|$))/i,
      /(?:à|a|in)\s+([a-zA-Zà-ÿÀ-Ý\s-]+?)(?:\s+(?:quel temps|météo|meteo|\?|$))/i,
      /(?:donne|donne-moi|affiche)\s+(?:la\s+)?(?:météo|meteo)\s+(?:de\s+|à\s+|pour\s+)?([a-zA-Zà-ÿÀ-Ý\s-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = q.match(pattern);
      if (match && match[1]) {
        const cleaned = match[1].replace(/[?,.!]/g, '').trim();
        // Discard filler words
        if (cleaned.length > 1 && !['aujourd', 'demain', 'ce', 'un', 'le', 'la', 'les', 'mon', 'ma'].includes(cleaned.toLowerCase())) {
          return cleaned;
        }
      }
    }

    return null;
  }

  /**
   * Executes the weather pipeline:
   * Location Resolution -> OpenWeather Real Fetch -> AI Synthesis / Formatting -> Zero Hallucination
   */
  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const query = input.query;

    // 1. Check if city is explicitly requested in query
    let city: string | undefined = this.extractCityFromQuery(query) || undefined;
    let lat: number | undefined;
    let lon: number | undefined;
    let locationSource: 'explicit_city' | 'android_gps' | 'last_known' | 'none' = 'none';

    if (city) {
      locationSource = 'explicit_city';
    } else {
      // 2. Check Android / Browser Location permission
      const hasLocationPermission = permissionManager.hasPermission('supervisor', 'FINE_LOCATION');
      const snapshot = await contextEngine.getSnapshot();

      if (hasLocationPermission && snapshot.location.permissionGranted && snapshot.location.latitude && snapshot.location.longitude) {
        lat = snapshot.location.latitude;
        lon = snapshot.location.longitude;
        city = snapshot.location.city || undefined;
        locationSource = 'android_gps';
      } else {
        // 3. Check for last authorized location
        const lastKnown = weatherService.getLastKnownLocation();
        if (lastKnown) {
          lat = lastKnown.lat;
          lon = lastKnown.lon;
          city = lastKnown.city;
          locationSource = 'last_known';
        }
      }
    }

    // If still no location and no city provided: Ask user for city
    if (!city && (lat === undefined || lon === undefined)) {
      return {
        id: `weather_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: `### 🌦️ Localisation requise pour la météo\n\nLa permission de **Localisation (FINE_LOCATION)** n'est pas active et aucune ville n'a été spécifiée.\n\n*Pour quelle ville souhaitez-vous connaître la météo ? (ex: Paris, Lyon, Bordeaux, Marseille)*`,
        spokenSummary: 'Pour quelle ville souhaitez-vous connaître la météo ?',
        actionTaken: false,
        telemetry: {
          providerUsed: 'weather_service',
          modelUsed: 'openweather-v2.5',
          fallbackOccurred: false,
          providerChainAttempted: ['weather_service'],
          executionTimeMs: Date.now() - startTime,
        },
      };
    }

    // 4. Query OpenWeather API with Real Data
    try {
      const report = await weatherService.getFullWeatherReport({
        city: city || undefined,
        lat,
        lon,
      });

      let locationNotice = '';
      if (locationSource === 'last_known') {
        locationNotice = `*(Basé sur votre dernière localisation enregistrée : ${report.current.location.city})*\n\n`;
      }

      return {
        id: `weather_exec_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: `${locationNotice}${report.summaryMarkdown}`,
        spokenSummary: report.spokenSummary,
        actionTaken: true,
        structuredData: {
          type: 'weather_fetch',
          city: report.current.location.city,
          temp: report.current.temperature,
          feelsLike: report.current.feelsLike,
          humidity: report.current.humidity,
          windKmH: report.current.wind.speedKmH,
          conditions: report.current.conditions.description,
          source: report.current.source,
          lastUpdated: report.lastUpdatedFormatted,
        },
        telemetry: {
          providerUsed: 'openweather_real_api',
          modelUsed: report.isCached ? 'openweather-cache-v3' : 'openweather-live-v3',
          fallbackOccurred: false,
          providerChainAttempted: ['openweather_api'],
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  /**
   * Gracefully handles weather errors with strict zero-hallucination policy
   */
  public handleError(err: any, input: AgentInput, startTime: number): AgentOutput {
    console.error('[WeatherAgent] Real OpenWeather API failure:', err);

    const errorMessage = 'Je ne peux pas récupérer les données météo actuellement.';
    let diagnosticDetail = '';

    const errStr = err?.message || String(err);
    if (errStr.includes('OPENWEATHER_KEY_MISSING')) {
      diagnosticDetail = `\n\n> ⚠️ *La clé \`OPENWEATHER_API_KEY\` n'est pas encore configurée dans le fichier d'environnement ou les paramètres.*`;
    } else if (errStr.includes('CITY_NOT_FOUND')) {
      diagnosticDetail = `\n\n> 🔍 *La ville demandée est introuvable. Veuillez vérifier l'orthographe.*`;
    } else if (errStr.includes('INVALID_API_KEY')) {
      diagnosticDetail = `\n\n> 🔒 *La clé API OpenWeather fournie est invalide.*`;
    } else if (errStr.includes('NETWORK_ERROR')) {
      diagnosticDetail = `\n\n> 📡 *Impossible de joindre les serveurs OpenWeather (problème de connexion internet).*`;
    }

    return {
      id: `weather_err_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: `### 🌦️ Service Météo\n\n${errorMessage}${diagnosticDetail}`,
      spokenSummary: errorMessage,
      error: {
        code: 'WEATHER_FETCH_ERROR',
        message: redactSecrets(errStr),
        recoverable: true,
        suggestedAction: 'Vérifiez la clé OPENWEATHER_API_KEY ou la connexion réseau.',
      },
      actionTaken: false,
      telemetry: {
        providerUsed: 'weather_service',
        modelUsed: 'openweather-error-handler',
        fallbackOccurred: false,
        providerChainAttempted: ['openweather_api'],
        executionTimeMs: Date.now() - startTime,
      },
    };
  }
}

export const weatherAgent = new WeatherAgent();
