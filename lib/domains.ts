import { createServerClient, createAdminClient } from './supabase';
import { CustomDomainEnterprise, DomainVerification, DomainSettings } from '../types';
import crypto from 'crypto';

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateDNSRecords(domain: string, verificationToken: string) {
  return {
    txt: {
      name: `_aureos-verification.${domain}`,
      value: verificationToken,
      type: 'TXT'
    },
    cname: {
      name: `${domain}`,
      value: `verify.aureos.com`,
      type: 'CNAME'
    }
  };
}

export async function createCustomDomain(
  projectId: string,
  domain: string,
  verificationMethod: 'dns-txt' | 'dns-cname' | 'http' = 'dns-txt'
) {
  const supabase = createAdminClient();
  const verificationToken = generateVerificationToken();

  const { data: customDomain, error } = await supabase
    .from('custom_domains')
    .insert({
      project_id: projectId,
      domain,
      verification_method: verificationMethod,
      verification_token: verificationToken,
      status: 'pending',
      ssl_status: 'none'
    })
    .select()
    .single();

  if (error) throw error;

  // Create default domain settings
  await supabase.from('domain_settings').insert({
    domain_id: customDomain.id
  });

  // Create initial verification records
  const dnsRecords = generateDNSRecords(domain, verificationToken);
  await supabase.from('domain_verifications').insert([
    {
      domain_id: customDomain.id,
      type: 'TXT',
      name: dnsRecords.txt.name,
      value: dnsRecords.txt.value
    },
    {
      domain_id: customDomain.id,
      type: 'CNAME',
      name: dnsRecords.cname.name,
      value: dnsRecords.cname.value
    }
  ]);

  return customDomain;
}

export async function getCustomDomains(projectId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('custom_domains')
    .select('*')
    .eq('project_id', projectId);

  if (error) throw error;
  return data;
}

export async function getCustomDomainById(domainId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('custom_domains')
    .select(`
      *,
      domain_settings(*),
      domain_verifications(*)
    `)
    .eq('id', domainId)
    .single();

  if (error) throw error;
  return data;
}

export async function verifyCustomDomain(domainId: string) {
  const supabase = createAdminClient();
  
  // In a real implementation, we would check actual DNS records here
  // For this task, we'll just simulate verification
  
  const { data: customDomain, error: getError } = await supabase
    .from('custom_domains')
    .select('*')
    .eq('id', domainId)
    .single();

  if (getError) throw getError;

  const { data, error } = await supabase
    .from('custom_domains')
    .update({
      status: 'verified',
      ssl_status: 'active',
      verified_at: new Date().toISOString()
    })
    .eq('id', domainId)
    .select()
    .single();

  if (error) throw error;

  // Mark all verifications as verified
  await supabase
    .from('domain_verifications')
    .update({ is_verified: true, last_checked_at: new Date().toISOString() })
    .eq('domain_id', domainId);

  return data;
}

export async function updateCustomDomainSettings(
  domainId: string,
  updates: {
    branding_settings?: Record<string, any>;
    custom_css?: string;
    custom_js?: string;
  }
) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('domain_settings')
    .update(updates)
    .eq('domain_id', domainId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCustomDomain(domainId: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('custom_domains')
    .delete()
    .eq('id', domainId);

  if (error) throw error;
  return true;
}

export async function addCustomDomain(projectId: string, domain: string) {
  const result = await createCustomDomain(projectId, domain);
  return {
    custom_domain: result.domain,
    domain_verified: result.status === 'verified',
    domain_verification_token: result.verification_token,
    domain_verified_at: result.verified_at
  };
}

export async function removeCustomDomain(projectId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('custom_domains')
    .delete()
    .eq('project_id', projectId);
  if (error) throw error;
  return true;
}

export async function getCustomDomain(projectId: string) {
  const domains = await getCustomDomains(projectId);
  if (!domains || domains.length === 0) return null;
  const domain = domains[0];
  return {
    custom_domain: domain.domain,
    domain_verified: domain.status === 'verified',
    domain_verification_token: domain.verification_token,
    domain_verified_at: domain.verified_at
  };
}

export async function verifyDomain(projectId: string, verificationToken: string) {
  const supabase = createAdminClient();
  const { data: domain } = await supabase
    .from('custom_domains')
    .select('id')
    .eq('project_id', projectId)
    .eq('verification_token', verificationToken)
    .single();
  
  if (!domain) throw new Error('Invalid verification token');
  return verifyCustomDomain(domain.id);
}

export async function getDNSRecords(projectId: string) {
  const domains = await getCustomDomains(projectId);
  if (!domains || domains.length === 0) throw new Error('No custom domain found');
  const domain = domains[0];
  const records = generateDNSRecords(domain.domain, domain.verification_token);
  return {
    domain: domain.domain,
    records,
    verification_instructions: [
      `Add a TXT record: ${records.txt.name} = ${records.txt.value}`,
      `Optionally add a CNAME record: ${records.cname.name} = ${records.cname.value} (for HTTPS)`
    ]
  };
}
export function validateDomain(domain: string): { valid: boolean; error?: string } {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
  
  if (!domain || domain.length === 0) {
    return { valid: false, error: 'Domain is required' };
  }

  if (domain.length > 255) {
    return { valid: false, error: 'Domain is too long' };
  }

  if (!domainRegex.test(domain)) {
    return { valid: false, error: 'Invalid domain format' };
  }

  const reservedDomains = ['localhost', 'aureos.com', 'example.com', 'test.com'];
  if (reservedDomains.includes(domain.toLowerCase())) {
    return { valid: false, error: 'Cannot use reserved domains' };
  }

  return { valid: true };
}
