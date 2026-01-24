import { createAdminClient } from '@/lib/supabase';
import { randomToken, pkceS256Challenge, decodeJwtPayloadUnsafe } from '@/lib/crypto-utils';
import { createSsoAccessToken } from '@/lib/internal-auth';
import { ensureUserExists } from '@/lib/auth';

export type SsoProviderType = 'oidc' | 'saml';

export interface SsoConfigurationRecord {
  id: string;
  project_id: string;
  provider_type: SsoProviderType;
  name: string;
  enabled: boolean;
  oidc_issuer_url: string | null;
  oidc_client_id: string | null;
  oidc_client_secret: string | null;
  oidc_redirect_url: string | null;
  oidc_scopes: string[];
  saml_entity_id: string | null;
  saml_sso_url: string | null;
  saml_certificate: string | null;
  attribute_mapping: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OidcDiscoveryDocument {
  authorization_endpoint: string;
  token_endpoint: string;
}

async function discoverOidc(issuerUrl: string): Promise<OidcDiscoveryDocument> {
  const wellKnown = issuerUrl.replace(/\/$/, '') + '/.well-known/openid-configuration';
  const res = await fetch(wellKnown);
  if (!res.ok) {
    throw new Error('Failed to discover OIDC configuration');
  }

  const json = (await res.json()) as unknown;
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid OIDC discovery document');
  }

  const doc = json as Record<string, unknown>;

  const authorizationEndpoint = doc.authorization_endpoint;
  const tokenEndpoint = doc.token_endpoint;

  if (typeof authorizationEndpoint !== 'string' || typeof tokenEndpoint !== 'string') {
    throw new Error('Invalid OIDC discovery document');
  }

  return {
    authorization_endpoint: authorizationEndpoint,
    token_endpoint: tokenEndpoint,
  };
}

/**
 * Upserts an SSO configuration for a project.
 */
export async function upsertSsoConfiguration(params: {
  projectId: string;
  userId: string;
  providerType: SsoProviderType;
  name: string;
  enabled: boolean;
  attributeMapping: Record<string, unknown>;
  oidc?: {
    issuerUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUrl: string;
    scopes: string[];
  };
  saml?: {
    entityId: string;
    ssoUrl: string;
    certificate: string;
  };
}): Promise<SsoConfigurationRecord> {
  const adminClient = createAdminClient();

  const record: Record<string, unknown> = {
    project_id: params.projectId,
    provider_type: params.providerType,
    name: params.name,
    enabled: params.enabled,
    attribute_mapping: params.attributeMapping,
    updated_by: params.userId,
    created_by: params.userId,

    oidc_issuer_url: null,
    oidc_client_id: null,
    oidc_client_secret: null,
    oidc_redirect_url: null,
    oidc_scopes: ['openid', 'email', 'profile'],

    saml_entity_id: null,
    saml_sso_url: null,
    saml_certificate: null,
  };

  if (params.providerType === 'oidc' && params.oidc) {
    record.oidc_issuer_url = params.oidc.issuerUrl;
    record.oidc_client_id = params.oidc.clientId;
    record.oidc_client_secret = params.oidc.clientSecret;
    record.oidc_redirect_url = params.oidc.redirectUrl;
    record.oidc_scopes = params.oidc.scopes.length ? params.oidc.scopes : ['openid', 'email', 'profile'];
  }

  if (params.providerType === 'saml' && params.saml) {
    record.saml_entity_id = params.saml.entityId;
    record.saml_sso_url = params.saml.ssoUrl;
    record.saml_certificate = params.saml.certificate;
  }

  const { data, error } = await adminClient
    .from('sso_configurations')
    .upsert(record, { onConflict: 'project_id' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Failed to configure SSO');
  }

  return data as SsoConfigurationRecord;
}

/**
 * Fetches the configured SSO provider for a project.
 */
export async function getSsoConfiguration(projectId: string): Promise<SsoConfigurationRecord> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('sso_configurations')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (error || !data) {
    throw new Error('SSO not configured');
  }

  return data as SsoConfigurationRecord;
}

export interface SsoAuthorizeResult {
  sessionId: string;
  providerType: SsoProviderType;
  url: string;
}

/**
 * Initiates an SSO authorization.
 */
export async function createSsoAuthorization(projectId: string): Promise<SsoAuthorizeResult> {
  const adminClient = createAdminClient();
  const config = await getSsoConfiguration(projectId);

  if (!config.enabled) {
    throw new Error('SSO is disabled');
  }

  const state = randomToken(24);
  const nonce = randomToken(24);
  const codeVerifier = randomToken(32);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: session, error: sessionError } = await adminClient
    .from('sso_sessions')
    .insert({
      project_id: projectId,
      provider_type: config.provider_type,
      status: 'pending',
      state,
      nonce,
      code_verifier: codeVerifier,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (sessionError || !session) {
    throw new Error('Failed to initiate SSO session');
  }

  if (config.provider_type === 'oidc') {
    if (!config.oidc_issuer_url || !config.oidc_client_id || !config.oidc_redirect_url) {
      throw new Error('SSO not configured');
    }

    const discovery = await discoverOidc(config.oidc_issuer_url);
    const codeChallenge = pkceS256Challenge(codeVerifier);

    const scope = (config.oidc_scopes ?? ['openid', 'email', 'profile']).join(' ');

    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.oidc_client_id);
    url.searchParams.set('redirect_uri', config.oidc_redirect_url);
    url.searchParams.set('scope', scope);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return {
      sessionId: session.id as string,
      providerType: 'oidc',
      url: url.toString(),
    };
  }

  if (!config.saml_sso_url) {
    throw new Error('SSO not configured');
  }

  const url = new URL(config.saml_sso_url);
  url.searchParams.set('state', state);

  return {
    sessionId: session.id as string,
    providerType: 'saml',
    url: url.toString(),
  };
}

export interface SsoCallbackResult {
  accessToken: string;
  userId: string;
  sessionId: string;
  email: string;
}

function getMappedClaim(
  claims: Record<string, unknown>,
  mapping: Record<string, unknown>,
  key: string,
  defaultClaim: string
): string | null {
  const mapped = mapping[key];
  const claimName = typeof mapped === 'string' && mapped.length ? mapped : defaultClaim;

  const value = claims[claimName];
  return typeof value === 'string' && value.length ? value : null;
}

async function exchangeOidcCode(params: {
  tokenEndpoint: string;
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ id_token?: string }>
{
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(params.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error('Failed to exchange SSO code');
  }

  return (await res.json()) as { id_token?: string };
}

/**
 * Handles an SSO callback and returns an internal Aureos access token.
 */
export async function handleSsoCallback(params: {
  projectId: string;
  state: string;
  providerType: SsoProviderType;
  code?: string;
  idToken?: string;
  email?: string;
  externalUserId?: string;
}): Promise<SsoCallbackResult> {
  const adminClient = createAdminClient();

  const { data: session, error: sessionError } = await adminClient
    .from('sso_sessions')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('state', params.state)
    .single();

  if (sessionError || !session) {
    throw new Error('Invalid SSO state');
  }

  if (session.status !== 'pending' || session.revoked_at) {
    throw new Error('SSO session is not pending');
  }

  const expiresAt = new Date(session.expires_at as string).getTime();
  if (expiresAt <= Date.now()) {
    throw new Error('SSO session expired');
  }

  const config = await getSsoConfiguration(params.projectId);
  if (!config.enabled) {
    throw new Error('SSO is disabled');
  }

  let idToken = params.idToken;

  if (config.provider_type === 'oidc') {
    if (!params.code) {
      throw new Error('Missing authorization code');
    }

    if (!config.oidc_issuer_url || !config.oidc_client_id || !config.oidc_client_secret || !config.oidc_redirect_url) {
      throw new Error('SSO not configured');
    }

    const discovery = await discoverOidc(config.oidc_issuer_url);

    const tokenRes = await exchangeOidcCode({
      tokenEndpoint: discovery.token_endpoint,
      code: params.code,
      clientId: config.oidc_client_id,
      clientSecret: config.oidc_client_secret,
      redirectUri: config.oidc_redirect_url,
      codeVerifier: session.code_verifier as string,
    });

    idToken = tokenRes.id_token;

    if (!idToken) {
      throw new Error('Missing id_token from OIDC provider');
    }
  }

  const claims: Record<string, unknown> = idToken ? decodeJwtPayloadUnsafe(idToken) : {};

  const email =
    params.email ??
    getMappedClaim(claims, config.attribute_mapping, 'email', 'email') ??
    getMappedClaim(claims, config.attribute_mapping, 'email', 'upn');

  const externalUserId =
    params.externalUserId ?? getMappedClaim(claims, config.attribute_mapping, 'externalUserId', 'sub');

  if (!email) {
    throw new Error('SSO did not provide an email');
  }

  if (!externalUserId) {
    throw new Error('SSO did not provide an external user id');
  }

  // Provision user in Supabase auth (if not present)
  const { data: existingUser, error: existingError } = await adminClient.auth.admin.getUserByEmail(email);

  let authUserId: string;
  if (existingError || !existingUser.user) {
    const password = randomToken(24);
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      throw new Error('Failed to provision user');
    }

    authUserId = created.user.id;
  } else {
    authUserId = existingUser.user.id;
  }

  await ensureUserExists(authUserId, email);

  const nowIso = new Date().toISOString();

  const { error: activateError } = await adminClient
    .from('sso_sessions')
    .update({
      status: 'active',
      external_user_id: externalUserId,
      email,
      user_id: authUserId,
      last_active_at: nowIso,
    })
    .eq('id', session.id);

  if (activateError) {
    throw new Error('Failed to activate SSO session');
  }

  const accessToken = createSsoAccessToken({ userId: authUserId, sessionId: session.id as string });

  return {
    accessToken,
    userId: authUserId,
    sessionId: session.id as string,
    email,
  };
}

/**
 * Revokes an SSO session.
 */
export async function revokeSsoSession(sessionId: string): Promise<void> {
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from('sso_sessions')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    throw new Error('Failed to revoke SSO session');
  }
}
