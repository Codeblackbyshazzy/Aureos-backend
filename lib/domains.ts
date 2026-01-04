import { createServerClient, createAdminClient } from './supabase';
import { CustomDomain } from '../types';
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

export async function addCustomDomain(projectId: string, domain: string): Promise<CustomDomain> {
  const supabase = createAdminClient();

  // Check if domain is already in use
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('custom_domain', domain)
    .single();

  if (existing) {
    throw new Error('Domain is already in use by another project');
  }

  const verificationToken = generateVerificationToken();

  const { data, error } = await supabase
    .from('projects')
    .update({
      custom_domain: domain,
      domain_verified: false,
      domain_verification_token: verificationToken
    })
    .eq('id', projectId)
    .select('custom_domain, domain_verified, domain_verification_token, domain_verified_at')
    .single();

  if (error) throw error;

  return data;
}

export async function removeCustomDomain(projectId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('projects')
    .update({
      custom_domain: null,
      domain_verified: false,
      domain_verification_token: null,
      domain_verified_at: null
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getCustomDomain(projectId: string): Promise<CustomDomain | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('projects')
    .select('custom_domain, domain_verified, domain_verification_token, domain_verified_at')
    .eq('id', projectId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows returned
    throw error;
  }

  return data;
}

export async function verifyDomain(projectId: string, verificationToken: string) {
  const supabase = createServerClient();

  // Get project with verification token
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('domain_verification_token')
    .eq('id', projectId)
    .single();

  if (projectError) throw projectError;

  if (project.domain_verification_token !== verificationToken) {
    throw new Error('Invalid verification token');
  }

  const { data, error } = await supabase
    .from('projects')
    .update({
      domain_verified: true,
      domain_verified_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select('custom_domain, domain_verified, domain_verified_at')
    .single();

  if (error) throw error;

  return data;
}

export async function getDNSRecords(projectId: string) {
  const supabase = createServerClient();

  const { data: domainData, error } = await supabase
    .from('projects')
    .select('custom_domain, domain_verification_token')
    .eq('id', projectId)
    .single();

  if (error) throw error;

  if (!domainData.custom_domain || !domainData.domain_verification_token) {
    throw new Error('No custom domain configured for this project');
  }

  const dnsRecords = generateDNSRecords(domainData.custom_domain, domainData.domain_verification_token);

  return {
    domain: domainData.custom_domain,
    records: dnsRecords,
    verification_instructions: [
      `Add a TXT record: ${dnsRecords.txt.name} = ${dnsRecords.txt.value}`,
      `Optionally add a CNAME record: ${dnsRecords.cname.name} = ${dnsRecords.cname.value} (for HTTPS)`
    ]
  };
}

export async function checkDomainStatus(projectId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('projects')
    .select('custom_domain, domain_verified, domain_verified_at')
    .eq('id', projectId)
    .single();

  if (error) throw error;

  return {
    domain: data.custom_domain,
    verified: data.domain_verified,
    verified_at: data.domain_verified_at,
    status: data.domain_verified ? 'verified' : 'pending_verification'
  };
}

export function validateDomain(domain: string): { valid: boolean; error?: string } {
  // Basic domain validation
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

  // Check for reserved domains
  const reservedDomains = ['localhost', 'aureos.com', 'example.com', 'test.com'];
  if (reservedDomains.includes(domain.toLowerCase())) {
    return { valid: false, error: 'Cannot use reserved domains' };
  }

  return { valid: true };
}