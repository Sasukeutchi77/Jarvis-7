/**
 * CONTACT RESOLVER (Phase 10: Phone Agent)
 * 
 * Interacts with Android ContactsContract API to:
 * - Query contacts by name, nickname, or number
 * - Disambiguate homonyms (e.g. multiple "Sarah" contacts)
 * - Handle multi-number contacts (Mobile vs Work vs Home)
 * - Validate and normalize phone numbers (E.164, French formats, emergency numbers)
 * - Handle edge cases: "Contact inexistant", "Numéro invalide", "Homonymes"
 */

import { CallPermissionManager } from './call-permission-manager.js';

export interface PhoneNumberRecord {
  number: string;
  normalizedNumber: string;
  type: 'mobile' | 'work' | 'home' | 'main' | 'other';
  isPrimary?: boolean;
}

export interface ContactRecord {
  id: string;
  displayName: string;
  normalizedName: string;
  givenName: string;
  familyName: string;
  numbers: PhoneNumberRecord[];
  photoUri?: string;
  company?: string;
  jobTitle?: string;
  isStarred?: boolean;
  timesContacted?: number;
  lastTimeContacted?: number;
}

export type ContactResolutionResult =
  | {
      status: 'found';
      contact: ContactRecord;
      selectedNumber: PhoneNumberRecord;
      confidence: number;
      disambiguationNeeded: false;
    }
  | {
      status: 'multiple_matches';
      query: string;
      candidates: Array<{
        contact: ContactRecord;
        number: PhoneNumberRecord;
        label: string;
      }>;
      message: string;
      disambiguationNeeded: true;
    }
  | {
      status: 'not_found';
      query: string;
      message: string;
      suggestions: string[];
      disambiguationNeeded: false;
    }
  | {
      status: 'invalid_number';
      rawInput: string;
      message: string;
      disambiguationNeeded: false;
    }
  | {
      status: 'permission_denied';
      permission: string;
      message: string;
      actionNeeded: string;
      disambiguationNeeded: false;
    };

export class ContactResolver {
  // Built-in Contacts Database matching realistic Android ContactsContract store
  private static contactsDatabase: ContactRecord[] = [
    {
      id: 'c_01',
      displayName: 'Sarah Connor',
      normalizedName: 'sarah connor',
      givenName: 'Sarah',
      familyName: 'Connor',
      numbers: [
        { number: '+33 6 12 34 56 78', normalizedNumber: '+33612345678', type: 'mobile', isPrimary: true },
        { number: '+33 1 42 68 00 11', normalizedNumber: '+33142680011', type: 'work' },
      ],
      photoUri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      company: 'Cyberdyne Systems',
      jobTitle: 'Directrice des Opérations',
      isStarred: true,
      timesContacted: 42,
    },
    {
      id: 'c_02',
      displayName: 'Sarah Davis',
      normalizedName: 'sarah davis',
      givenName: 'Sarah',
      familyName: 'Davis',
      numbers: [
        { number: '+33 6 98 76 54 32', normalizedNumber: '+33698765432', type: 'mobile', isPrimary: true },
      ],
      photoUri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
      company: 'Quantum Lab',
      jobTitle: 'Ingénieure IA',
      isStarred: false,
      timesContacted: 5,
    },
    {
      id: 'c_03',
      displayName: 'Alexandre Dumas',
      normalizedName: 'alexandre dumas',
      givenName: 'Alexandre',
      familyName: 'Dumas',
      numbers: [
        { number: '+33 7 88 99 00 11', normalizedNumber: '+33788990011', type: 'mobile', isPrimary: true },
      ],
      photoUri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      company: 'Éditions Atlas',
      isStarred: true,
      timesContacted: 18,
    },
    {
      id: 'c_04',
      displayName: 'Maman',
      normalizedName: 'maman',
      givenName: 'Maman',
      familyName: '',
      numbers: [
        { number: '+33 6 11 22 33 44', normalizedNumber: '+33611223344', type: 'mobile', isPrimary: true },
        { number: '+33 4 72 00 12 34', normalizedNumber: '+33472001234', type: 'home' },
      ],
      photoUri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
      isStarred: true,
      timesContacted: 95,
    },
    {
      id: 'c_05',
      displayName: 'Dr. Martin (Médecin Traitant)',
      normalizedName: 'dr martin medecin',
      givenName: 'Martin',
      familyName: 'Cabinet',
      numbers: [
        { number: '+33 1 40 50 60 70', normalizedNumber: '+33140506070', type: 'work', isPrimary: true },
      ],
      company: 'Cabinet Médical Haussmann',
      timesContacted: 3,
    },
    {
      id: 'c_06',
      displayName: 'SAMU / Urgences',
      normalizedName: 'samu urgences secours',
      givenName: 'SAMU',
      familyName: '15',
      numbers: [
        { number: '15', normalizedNumber: '15', type: 'main', isPrimary: true },
        { number: '112', normalizedNumber: '112', type: 'other' },
      ],
      isStarred: true,
      timesContacted: 0,
    },
  ];

  /**
   * Get all registered contacts
   */
  public static getAllContacts(): ContactRecord[] {
    return [...this.contactsDatabase];
  }

  /**
   * Add or update a contact in the phone directory
   */
  public static saveContact(contact: ContactRecord): void {
    const idx = this.contactsDatabase.findIndex((c) => c.id === contact.id);
    if (idx >= 0) {
      this.contactsDatabase[idx] = contact;
    } else {
      this.contactsDatabase.push(contact);
    }
  }

  /**
   * Validate and normalize a phone number string
   */
  public static normalizePhoneNumber(raw: string): { isValid: boolean; normalized: string; formatted: string; reason?: string } {
    let clean = raw.trim().replace(/[\s\-\.\(\)]/g, '');

    // Emergency numbers (15, 17, 18, 112, 911)
    if (/^(15|17|18|112|911)$/.test(clean)) {
      return { isValid: true, normalized: clean, formatted: clean };
    }

    // French national format conversion (0612345678 -> +33612345678)
    if (/^0[1-9]\d{8}$/.test(clean)) {
      const international = `+33${clean.substring(1)}`;
      const formatted = `+33 ${clean[1]} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)} ${clean.slice(8, 10)}`;
      return { isValid: true, normalized: international, formatted };
    }

    // Standard International E.164 format (+33612345678)
    if (/^\+[1-9]\d{6,14}$/.test(clean)) {
      return { isValid: true, normalized: clean, formatted: clean };
    }

    // Invalid format checks
    if (/[a-zA-Z]/.test(clean)) {
      return {
        isValid: false,
        normalized: '',
        formatted: '',
        reason: 'Le numéro contient des lettres ou caractères non téléphoniques.',
      };
    }

    if (clean.length < 4) {
      return {
        isValid: false,
        normalized: '',
        formatted: '',
        reason: 'Numéro de téléphone trop court ou incomplet (minimum 4 chiffres).',
      };
    }

    return {
      isValid: false,
      normalized: '',
      formatted: '',
      reason: 'Format de numéro non reconnu. Utilisez le format E.164 (+33...) ou national (06...).',
    };
  }

  /**
   * Main Resolution Logic: Search contacts by name, nickname or direct number
   */
  public static resolve(query: string): ContactResolutionResult {
    // 1. Check READ_CONTACTS permission first
    const permCheck = CallPermissionManager.canReadContacts();
    if (!permCheck.allowed) {
      return {
        status: 'permission_denied',
        permission: 'android.permission.READ_CONTACTS',
        message: permCheck.reason || 'Permission contacts refusée.',
        actionNeeded: permCheck.actionNeeded || 'Autorisez l’accès aux contacts.',
        disambiguationNeeded: false,
      };
    }

    const trimmed = query.trim();
    if (!trimmed) {
      return {
        status: 'not_found',
        query,
        message: 'Aucun nom ou numéro spécifié.',
        suggestions: ['Sarah', 'Maman', 'Alexandre Dumas'],
        disambiguationNeeded: false,
      };
    }

    // 2. Check if the query is a raw phone number
    const isDirectNumber = /^[+\d\s\-\.\(\)]+$/.test(trimmed) && trimmed.replace(/\D/g, '').length >= 2;
    if (isDirectNumber) {
      const norm = this.normalizePhoneNumber(trimmed);
      if (!norm.isValid) {
        return {
          status: 'invalid_number',
          rawInput: trimmed,
          message: norm.reason || 'Numéro invalide.',
          disambiguationNeeded: false,
        };
      }

      // Check if this number belongs to an existing contact
      const matchingContact = this.contactsDatabase.find((c) =>
        c.numbers.some((n) => n.normalizedNumber === norm.normalized)
      );

      if (matchingContact) {
        const selectedNum = matchingContact.numbers.find((n) => n.normalizedNumber === norm.normalized)!;
        return {
          status: 'found',
          contact: matchingContact,
          selectedNumber: selectedNum,
          confidence: 1.0,
          disambiguationNeeded: false,
        };
      }

      // Standalone anonymous valid number
      const anonymousContact: ContactRecord = {
        id: `anon_${norm.normalized}`,
        displayName: norm.formatted,
        normalizedName: norm.normalized,
        givenName: norm.formatted,
        familyName: '',
        numbers: [{ number: norm.formatted, normalizedNumber: norm.normalized, type: 'mobile', isPrimary: true }],
      };

      return {
        status: 'found',
        contact: anonymousContact,
        selectedNumber: anonymousContact.numbers[0],
        confidence: 0.9,
        disambiguationNeeded: false,
      };
    }

    // 3. Search Contacts by Name / Nickname
    const searchTarget = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Exact matches
    const exactMatches = this.contactsDatabase.filter((c) => {
      const norm = c.normalizedName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const given = c.givenName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return norm === searchTarget || given === searchTarget || c.displayName.toLowerCase() === searchTarget;
    });

    // Partial / prefix / contains matches
    const partialMatches = this.contactsDatabase.filter((c) => {
      const norm = c.normalizedName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const given = c.givenName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return norm.includes(searchTarget) || given.includes(searchTarget) || searchTarget.includes(given);
    });

    const candidates = exactMatches.length > 0 ? exactMatches : partialMatches;

    // A. Case: Contact inexistant
    if (candidates.length === 0) {
      return {
        status: 'not_found',
        query: trimmed,
        message: `Aucun contact trouvé pour "${trimmed}" dans votre carnet d'adresses.`,
        suggestions: this.contactsDatabase.slice(0, 3).map((c) => c.displayName),
        disambiguationNeeded: false,
      };
    }

    // B. Case: Exactly ONE contact found with ONE number
    if (candidates.length === 1 && candidates[0].numbers.length === 1) {
      const single = candidates[0];
      return {
        status: 'found',
        contact: single,
        selectedNumber: single.numbers[0],
        confidence: 1.0,
        disambiguationNeeded: false,
      };
    }

    // C. Case: Multiple contacts found OR single contact with multiple numbers -> Disambiguation required!
    const disambiguationList: Array<{ contact: ContactRecord; number: PhoneNumberRecord; label: string }> = [];

    for (const cand of candidates) {
      for (const num of cand.numbers) {
        const typeLabel = num.type === 'mobile' ? 'Mobile' : num.type === 'work' ? 'Bureau' : num.type === 'home' ? 'Domicile' : 'Ligne';
        disambiguationList.push({
          contact: cand,
          number: num,
          label: `${cand.displayName} (${typeLabel}: ${num.number})`,
        });
      }
    }

    // If only one candidate with primary number selected and high confidence
    if (candidates.length === 1 && candidates[0].numbers.length > 1) {
      const primaryNum = candidates[0].numbers.find((n) => n.isPrimary) || candidates[0].numbers[0];
      // We still provide disambiguation options, but can also default to primary if requested
      return {
        status: 'multiple_matches',
        query: trimmed,
        candidates: disambiguationList,
        message: `Plusieurs numéros trouvés pour ${candidates[0].displayName}. Lequel souhaitez-vous appeler ?`,
        disambiguationNeeded: true,
      };
    }

    return {
      status: 'multiple_matches',
      query: trimmed,
      candidates: disambiguationList,
      message: `Plusieurs correspondants correspondent à "${trimmed}" (${candidates.map((c) => c.displayName).join(', ')}). Précisez votre choix.`,
      disambiguationNeeded: true,
    };
  }

  /**
   * Find a contact by phone number
   */
  public static findByNumber(phoneNumber: string): ContactRecord | null {
    const norm = this.normalizePhoneNumber(phoneNumber);
    if (!norm.isValid) return null;
    return (
      this.contactsDatabase.find((c) =>
        c.numbers.some((n) => n.normalizedNumber === norm.normalized)
      ) || null
    );
  }
}
