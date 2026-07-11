export type ClientType = 'Individual' | 'Corporate';

export type ClientStatus = 'Active' | 'Dormant' | 'Deceased' | 'Blocked';

export const CLIENT_ADDRESS_KINDS = [
  'Home',
  'Office',
  'Registered',
  'Billing',
  'Communication',
] as const;
export type ClientAddressKind = (typeof CLIENT_ADDRESS_KINDS)[number];

export const CLIENT_RELATIONSHIP_TYPES = [
  'Spouse',
  'Child',
  'Parent',
  'ParentCompany',
  'Subsidiary',
  'Referrer',
  'CoParty',
] as const;
export type ClientRelationshipType = (typeof CLIENT_RELATIONSHIP_TYPES)[number];

export type IdentityDocumentVerifyStatus = 'Pending' | 'Verified' | 'Rejected' | 'Expired';

export interface Client {
  id: string;
  number: string;
  type: ClientType;
  firstName: string | null;
  lastName: string | null;
  legalName: string | null;
  displayName: string | null;
  email: string | null;
  phoneE164: string | null;
  gstin: string | null;
  cin: string | null;
  status: ClientStatus;
  creditLimit: number | null;
  ownerId: string | null;
  branchId: string | null;
  portalEnabled: boolean;
  sourceLeadId: string | null;
  /** Non-null when this client record was the "loser" of a merge — AC-C3: the detail page must redirect to this id. */
  mergedIntoClientId: string | null;
  createdAt: string;
}

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface ClientContactInput {
  name: string;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
}

export interface ClientAddress {
  id: string;
  clientId: string;
  kind: ClientAddressKind;
  line1: string;
  line2: string | null;
  city: string | null;
  stateCode: string | null;
  postal: string | null;
  country: string | null;
  isPrimaryOfKind: boolean;
}

export interface ClientAddressInput {
  kind: ClientAddressKind;
  line1: string;
  line2?: string | null;
  city?: string | null;
  stateCode?: string | null;
  postal?: string | null;
  country?: string | null;
  isPrimaryOfKind: boolean;
}

export interface ClientIdentityDocument {
  id: string;
  clientId: string;
  docKind: string;
  last4: string;
  expiryDate: string | null;
  verifyStatus: IdentityDocumentVerifyStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export interface ClientRelationship {
  id: string;
  clientId: string;
  relatedClientId: string | null;
  /** Set when the related party isn't itself a client record (e.g. a spouse with no client of their own). */
  personName: string | null;
  relationType: ClientRelationshipType;
}

export interface AddClientRelationshipRequest {
  relatedClientId?: string | null;
  personName?: string | null;
  relationType: ClientRelationshipType;
}

export interface ClientCommunication {
  id: string;
  channel: string;
  at: string;
  subject: string | null;
  snippet: string | null;
}

export interface ClientSummary {
  openMatters: number;
  lifetimeBilled: number;
  outstanding: number;
  trustBalance: number;
  nextHearing: string | null;
  documentCount: number;
  invoiceCount: number;
}

export type ClientPortalUserStatus = 'Invited' | 'Active' | 'Deactivated';

export interface ClientPortalUser {
  id: string;
  clientId: string;
  email: string;
  status: ClientPortalUserStatus;
  twoFaEnabled: boolean;
}

export interface ClientFilter {
  type?: ClientType;
  status?: ClientStatus;
  ownerId?: string;
  branchId?: string;
  q?: string;
}

export interface CreateClientRequest {
  type: ClientType;
  firstName?: string | null;
  lastName?: string | null;
  legalName?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  gstin?: string | null;
  cin?: string | null;
  ownerId?: string | null;
  branchId?: string | null;
  sourceLeadId?: string | null;
  contacts?: ClientContactInput[] | null;
}

export interface UpdateClientRequest {
  firstName?: string | null;
  lastName?: string | null;
  legalName?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  gstin?: string | null;
  cin?: string | null;
  creditLimit?: number | null;
  ownerId?: string | null;
  branchId?: string | null;
}

export interface MergeClientsRequest {
  survivorId: string;
  duplicateId: string;
  fieldChoices?: Record<string, string> | null;
}
