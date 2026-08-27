/**
 * ANDROID AGENT (JARVIS ECOSYSTEM — PHASE 3)
 * 
 * Architecture Pipeline:
 * AndroidAgent
 *      ↓
 * ActionResolver
 *      ↓
 * PermissionManager
 *      ↓
 * Android API
 * 
 * Rules:
 * 1. Categorizes all actions into READ, SAFE_ACTION, SENSITIVE_ACTION.
 * 2. Sensitive actions require explicit confirmation (SecurityConfirmationModal flow).
 * 3. Never bypass or hack Android security protections.
 * 4. Gracefully handles missing apps and denied permissions.
 * 5. Supports multi-version Android APIs (Android 5.0 through Android 15).
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
import {
  ActionResolver,
  PermissionManager,
  AndroidApi,
  ResolvedAndroidAction,
  AndroidActionTier,
  permissionManager,
  androidApi,
} from '../../android/index.js';
import { redactSecrets } from '../../services/security-redactor.js';

export class AndroidAgent implements SpecializedAgent {
  public readonly id: AgentId = 'android';
  public readonly name = 'JARVIS Android Agent';
  public readonly description = 'Spécialiste du contrôle système Android officiel, lancements d’applications, réglages, capteurs et actions matérielles sécurisées.';
  public readonly permissionLevel: AgentPermissionLevel = 'sensitive';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'app_and_intents_control',
      name: 'Lancement d’Applications & Gestion des Intents',
      description: 'Lancement d’applications (WhatsApp, YouTube, etc.) avec fallback Play Store et gestion des applications absentes.',
      tags: ['ouvre', 'lance', 'whatsapp', 'youtube', 'maps', 'spotify', 'appli', 'application'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'settings_and_system_toggles',
      name: 'Paramètres Android & Mode Silencieux',
      description: 'Accès aux paramètres Android, gestion du mode silencieux/DND, volume sonore et lampe torche.',
      tags: ['paramètres', 'parametres', 'settings', 'silencieux', 'dnd', 'son', 'volume', 'torche', 'lampe'],
      requiredPermissions: ['notifications'],
      riskLevel: 'low',
    },
    {
      id: 'camera_and_storage_read',
      name: 'Caméra & Consultation des Téléchargements',
      description: 'Ouverture du capteur photo et consultation conforme du répertoire des téléchargements (Scoped Storage).',
      tags: ['caméra', 'camera', 'photo', 'téléchargements', 'telechargements', 'downloads', 'fichiers'],
      requiredPermissions: ['camera', 'storage'],
      riskLevel: 'low',
    },
    {
      id: 'device_admin_security',
      name: 'Administration Matérielle Sécurisée',
      description: 'Verrouillage d’écran et actions sensibles soumises à confirmation explicite (SENSITIVE_ACTION).',
      tags: ['verrouille', 'bloque', 'réinitialise', 'admin', 'mise à jour'],
      requiredPermissions: ['device_admin'],
      riskLevel: 'high',
    },
    {
      id: 'telemetry_and_screen_read',
      name: 'Télémétrie & Lecture de Contexte (READ)',
      description: 'Consultation de la batterie, mémoire, réseau et analyse du contexte d’écran.',
      tags: ['batterie', 'charge', 'état', 'écran', 'télémétrie'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'system_navigation_and_location',
      name: 'Navigation Système & Géolocalisation',
      description: 'Actions retour, écran d’accueil et affichage de la position GPS sur Google Maps.',
      tags: ['retour', 'accueil', 'home', 'localisation', 'position', 'où suis-je', 'gps'],
      requiredPermissions: ['geolocation', 'accessibility'],
      riskLevel: 'low',
    },
    {
      id: 'notifications_and_calls',
      name: 'Notifications & Appels Téléphoniques',
      description: 'Lecture des notifications reçues et émission d’appels sécurisés avec confirmation.',
      tags: ['notifications', 'lis mes notifications', 'appelle', 'téléphone', 'contact'],
      requiredPermissions: ['notification_listener', 'phone', 'contacts'],
      riskLevel: 'medium',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'resolve_and_execute_android_action',
      description: 'Résout et exécute une intention Android avec validation des permissions et confirmation des actions sensibles.',
      parameters: { query: { type: 'string' }, isConfirmed: { type: 'boolean' } },
    },
    {
      name: 'open_application_intent',
      description: 'Ouvre une application Android standard ou propose le lien Play Store si absente.',
      parameters: { appId: { type: 'string' }, packageName: { type: 'string' } },
    },
    {
      name: 'set_ringer_and_dnd_mode',
      description: 'Bascule le mode silencieux / Ne pas déranger via AudioManager & NotificationManager.',
      parameters: { mode: { type: 'string', enum: ['silent', 'vibrate', 'normal'] } },
    },
    {
      name: 'access_camera_sensor',
      description: 'Ouvre le capteur photo Android.',
      parameters: { mode: { type: 'string', enum: ['photo', 'video'] } },
    },
    {
      name: 'view_downloads_storage',
      description: 'Consulte le répertoire des téléchargements via Storage Access Framework.',
      parameters: {},
    },
    {
      name: 'system_navigation',
      description: 'Bouton Retour ou Accueil Android.',
      parameters: { target: { type: 'string', enum: ['back', 'home'] } },
    },
    {
      name: 'show_location',
      description: 'Affiche la position géographique sur Google Maps.',
      parameters: {},
    },
    {
      name: 'read_notifications',
      description: 'Lit les notifications récentes via NotificationListenerService.',
      parameters: {},
    },
    {
      name: 'make_phone_call',
      description: 'Compose un appel téléphonique vers un contact (action sensible avec confirmation).',
      parameters: { recipient: { type: 'string' }, confirmed: { type: 'boolean' } },
    },
    {
      name: 'lock_screen_device_admin',
      description: 'Verrouille immédiatement le terminal (Action sensible avec confirmation).',
      parameters: { confirmed: { type: 'boolean' } },
    },
  ];

  /**
   * Evaluates if this agent should handle the natural language input query
   */
  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query.toLowerCase().trim();
    const androidKeywords = [
      'ouvre ', 'lance ', 'ouvrir ', 'lancer ',
      'whatsapp', 'youtube', 'spotify', 'netflix', 'paramètre', 'parametre', 'settings',
      'caméra', 'camera', 'photo', 'téléchargement', 'telechargement', 'download',
      'silencieux', 'mode silencieux', 'ne pas déranger', 'ne pas deranger',
      'lampe', 'torche', 'flashlight', 'volume', 'luminosité',
      'batterie', 'charge', 'verrouille', 'réinitialise', 'reinitialise',
      'lance l\'app', 'ouvre l\'app', 'ouvre whatsapp', 'ouvre youtube', 'ouvre les paramètres',
      'retour', 'accueil', 'home', 'localisation', 'où suis-je', 'ma position',
      'lis mes notifications', 'notifications', 'appelle', 'téléphone'
    ];

    let score = 0.05;
    const matches: string[] = [];

    // Exact direct navigation match
    if (q === 'retour' || q === 'retour.' || q === 'accueil' || q === 'accueil.' || q === 'home') {
      score = 0.98;
      matches.push('system_navigation_and_location');
    }

    for (const kw of androidKeywords) {
      if (q.includes(kw)) {
        score += 0.35;
        if (kw.includes('whatsapp') || kw.includes('youtube') || kw.includes('app')) {
          matches.push('app_and_intents_control');
        } else if (kw.includes('paramètre') || kw.includes('settings') || kw.includes('silencieux') || kw.includes('torche')) {
          matches.push('settings_and_system_toggles');
        } else if (kw.includes('caméra') || kw.includes('photo') || kw.includes('téléchargement') || kw.includes('download')) {
          matches.push('camera_and_storage_read');
        } else if (kw.includes('verrouille') || kw.includes('réinitialise')) {
          matches.push('device_admin_security');
        } else if (kw.includes('batterie') || kw.includes('charge')) {
          matches.push('telemetry_and_screen_read');
        } else if (kw.includes('retour') || kw.includes('accueil') || kw.includes('localisation') || kw.includes('position')) {
          matches.push('system_navigation_and_location');
        } else if (kw.includes('notification') || kw.includes('appelle') || kw.includes('téléphone')) {
          matches.push('notifications_and_calls');
        }
      }
    }

    score = Math.min(score, 1.0);

    return {
      agentId: this.id,
      score,
      confidence: score > 0.5 ? 0.95 : 0.4,
      reason: matches.length > 0
        ? `Commande système Android formelle identifiée : ${Array.from(new Set(matches)).join(', ')}`
        : 'Pas de commande système Android explicite.',
      matchedCapabilities: Array.from(new Set(matches)),
      requiredPermissions: ['vibration'],
      isPermissionMet: true,
    };
  }

  /**
   * Executes the request through the 4-layer architecture:
   * AndroidAgent -> ActionResolver -> PermissionManager -> Android API
   */
  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();

    try {
      // 1. ACTION RESOLVER: Parse query into structured Android Action & determine Tier (READ / SAFE_ACTION / SENSITIVE_ACTION)
      const isConfirmedByUser = Boolean(
        input.context?.parameters?.isConfirmed ||
        input.context?.parameters?.confirmed ||
        (input.query.toLowerCase().includes('confirme') && input.query.toLowerCase().includes('verrouill'))
      );

      const resolvedAction: ResolvedAndroidAction = ActionResolver.resolve(input.query, input.context);

      console.log(`[AndroidAgent] Action Resolved: ${resolvedAction.intentType} | Tier: ${resolvedAction.tier} | Requires Confirmation: ${resolvedAction.requiresConfirmation}`);

      // 2. PERMISSION MANAGER: Evaluate permission grants & enforce sensitive confirmation requirement
      const permCheck = await permissionManager.authorizeAction(resolvedAction, isConfirmedByUser);

      // Handle Denied or Missing Permissions (Strictly follow Android protections, NO hacks)
      if (!permCheck.isAuthorized) {
        if (permCheck.requiresUserConfirmation) {
          // SENSITIVE_ACTION requiring explicit user confirmation
          return {
            id: `out_android_confirm_${Date.now()}`,
            agentId: this.id,
            agentName: this.name,
            success: true,
            reply: resolvedAction.spokenOutput,
            spokenSummary: resolvedAction.spokenOutput,
            actionTaken: false,
            actionsExecuted: [],
            telemetry: {
              providerUsed: 'android_security_core',
              modelUsed: 'permission_enforcer',
              fallbackOccurred: false,
              providerChainAttempted: ['action_resolver', 'permission_manager'],
              executionTimeMs: Date.now() - startTime,
            },
            nextSuggestions: [
              'Confirmer l\'action de sécurité',
              'Annuler l\'opération',
            ],
            // Special payload passed to UI for SecurityConfirmationModal
            structuredData: {
              pendingConfirmation: permCheck.confirmationDetails,
              tier: 'SENSITIVE_ACTION',
            },
          };
        }

        // Permission denied by user/system
        const deniedReply = `${permCheck.reason}\n\n${permCheck.remediationAdvice}`;
        return {
          id: `out_android_denied_${Date.now()}`,
          agentId: this.id,
          agentName: this.name,
          success: false,
          reply: redactSecrets(deniedReply),
          spokenSummary: `Autorisation Android requise. Veuillez l'activer dans les paramètres.`,
          actionTaken: false,
          actionsExecuted: [],
          telemetry: {
            providerUsed: 'android_security_core',
            modelUsed: 'permission_enforcer',
            fallbackOccurred: false,
            providerChainAttempted: ['action_resolver', 'permission_manager'],
            executionTimeMs: Date.now() - startTime,
          },
          error: {
            code: 'PERMISSION_DENIED',
            message: permCheck.reason || 'Permission denied by Android security model',
            recoverable: true,
            suggestedAction: permCheck.remediationAdvice,
          },
          nextSuggestions: [
            'Ouvrir les paramètres des permissions',
            'Vérifier les autorisations accordées à JARVIS',
          ],
        };
      }

      // 3. ANDROID API: Execute the authorized action via clean official APIs
      const executionResult = await androidApi.executeAction(resolvedAction);

      const actionLog = {
        tool: resolvedAction.intentType.toLowerCase(),
        arguments: resolvedAction.parameters,
        result: executionResult.data || { status: executionResult.actionSummary },
        latencyMs: Date.now() - startTime,
        success: executionResult.success,
      };

      // Handle missing application (e.g. app not installed on device)
      if (!executionResult.success && executionResult.error?.code === 'APP_NOT_INSTALLED') {
        const appFallbackReply = `${executionResult.spokenMessage}\n\nVous pouvez l'installer directement depuis le Google Play Store ou accéder à la version Web.`;

        return {
          id: `out_android_missing_app_${Date.now()}`,
          agentId: this.id,
          agentName: this.name,
          success: false,
          reply: redactSecrets(appFallbackReply),
          spokenSummary: executionResult.spokenMessage,
          actionTaken: false,
          actionsExecuted: [actionLog],
          error: executionResult.error,
          telemetry: {
            providerUsed: 'android_api_bridge',
            modelUsed: 'package_manager_intent',
            fallbackOccurred: true,
            providerChainAttempted: ['android_api_native', 'play_store_fallback'],
            executionTimeMs: Date.now() - startTime,
          },
          nextSuggestions: [
            `Installer ${resolvedAction.targetApp?.name} via Play Store`,
            'Ouvrir les Paramètres',
            'Vérifier le niveau de batterie',
          ],
        };
      }

      // Successful execution
      return {
        id: `out_android_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: executionResult.success,
        reply: redactSecrets(executionResult.spokenMessage),
        spokenSummary: executionResult.spokenMessage,
        actionTaken: true,
        actionsExecuted: [actionLog],
        telemetry: {
          providerUsed: 'android_api_bridge',
          modelUsed: executionResult.methodUsed,
          fallbackOccurred: false,
          providerChainAttempted: ['action_resolver', 'permission_manager', 'android_api'],
          executionTimeMs: Date.now() - startTime,
        },
        nextSuggestions: this.generateFollowUpSuggestions(resolvedAction.intentType),
      };
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  private generateFollowUpSuggestions(intent: string): string[] {
    switch (intent) {
      case 'OPEN_APP':
        return ['Ouvrir les paramètres', 'Activer le mode silencieux', 'Prendre une photo'];
      case 'OPEN_SETTINGS':
        return ['Activer le mode silencieux', 'Allumer la lampe torche', 'Vérifier la batterie'];
      case 'OPEN_CAMERA':
        return ['Afficher mes téléchargements', 'Basculer vers la caméra frontale', 'Retourner à l’accueil'];
      case 'VIEW_DOWNLOADS':
        return ['Ouvrir les paramètres', 'Vérifier l’espace de stockage', 'Lancer WhatsApp'];
      case 'SET_SILENT_MODE':
        return ['Désactiver le mode silencieux', 'Régler le volume à 50%', 'Allumer la torche'];
      default:
        return ['Ouvrir WhatsApp', 'Ouvrir YouTube', 'Ouvrir ma caméra', 'Afficher mes téléchargements'];
    }
  }

  public handleError(error: any, input: AgentInput, startTime: number): AgentOutput {
    console.error('[AndroidAgent] Execution Error:', error);
    return {
      id: `err_android_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: `Une anomalie est survenue lors de l'exécution de la commande Android : ${error?.message || 'Erreur inconnue'}.`,
      spokenSummary: 'Erreur lors du contrôle système Android.',
      telemetry: {
        providerUsed: 'android_api_bridge',
        modelUsed: 'error_handler',
        fallbackOccurred: true,
        providerChainAttempted: ['action_resolver', 'permission_manager', 'android_api'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'ANDROID_AGENT_EXECUTION_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Vérifiez que les permissions Android nécessaires sont accordées et que l’application ciblée est disponible.',
      },
    };
  }
}
