import { isOrgEmail, isSuperadminEmail } from '../orgAccess';

describe('isOrgEmail', () => {
  const originalEnv = process.env.ORG_EMAIL_DOMAINS;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env.ORG_EMAIL_DOMAINS = originalEnv;
  });

  it('should return true for emails matching org domains', () => {
    process.env.ORG_EMAIL_DOMAINS = 'example.com,test.org';
    
    expect(isOrgEmail('user@example.com')).toBe(true);
    expect(isOrgEmail('user@test.org')).toBe(true);
  });

  it('should return false for emails not matching org domains', () => {
    process.env.ORG_EMAIL_DOMAINS = 'example.com,test.org';
    
    expect(isOrgEmail('user@gmail.com')).toBe(false);
    expect(isOrgEmail('user@example.org')).toBe(false);
  });

  it('should be case-insensitive', () => {
    process.env.ORG_EMAIL_DOMAINS = 'example.com';
    
    expect(isOrgEmail('User@EXAMPLE.COM')).toBe(true);
    expect(isOrgEmail('USER@Example.Com')).toBe(true);
  });

  it('should handle comma-separated domains with spaces', () => {
    process.env.ORG_EMAIL_DOMAINS = 'example.com, test.org , another.co.uk';
    
    expect(isOrgEmail('user@test.org')).toBe(true);
    expect(isOrgEmail('user@another.co.uk')).toBe(true);
  });

  it('should return false for null or undefined email', () => {
    process.env.ORG_EMAIL_DOMAINS = 'example.com';
    
    expect(isOrgEmail(null)).toBe(false);
    expect(isOrgEmail(undefined)).toBe(false);
    expect(isOrgEmail('')).toBe(false);
  });

  it('should handle empty ORG_EMAIL_DOMAINS env var', () => {
    process.env.ORG_EMAIL_DOMAINS = '';
    
    expect(isOrgEmail('user@example.com')).toBe(false);
  });
});

describe('isSuperadminEmail', () => {
  const originalEnv = process.env.SUPERADMIN_EMAILS;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env.SUPERADMIN_EMAILS = originalEnv;
  });

  it('should return true for emails in superadmin list', () => {
    process.env.SUPERADMIN_EMAILS = 'admin@example.com,super@test.org';
    
    expect(isSuperadminEmail('admin@example.com')).toBe(true);
    expect(isSuperadminEmail('super@test.org')).toBe(true);
  });

  it('should return false for emails not in superadmin list', () => {
    process.env.SUPERADMIN_EMAILS = 'admin@example.com';
    
    expect(isSuperadminEmail('user@example.com')).toBe(false);
    expect(isSuperadminEmail('admin@test.org')).toBe(false);
  });

  it('should be case-insensitive', () => {
    process.env.SUPERADMIN_EMAILS = 'admin@example.com';
    
    expect(isSuperadminEmail('Admin@Example.Com')).toBe(true);
    expect(isSuperadminEmail('ADMIN@EXAMPLE.COM')).toBe(true);
  });

  it('should handle comma-separated emails with spaces', () => {
    process.env.SUPERADMIN_EMAILS = 'admin@example.com, super@test.org , another@another.com';
    
    expect(isSuperadminEmail('super@test.org')).toBe(true);
    expect(isSuperadminEmail('another@another.com')).toBe(true);
  });

  it('should return false for null or undefined email', () => {
    process.env.SUPERADMIN_EMAILS = 'admin@example.com';
    
    expect(isSuperadminEmail(null)).toBe(false);
    expect(isSuperadminEmail(undefined)).toBe(false);
    expect(isSuperadminEmail('')).toBe(false);
  });

  it('should handle empty SUPERADMIN_EMAILS env var', () => {
    process.env.SUPERADMIN_EMAILS = '';
    
    expect(isSuperadminEmail('admin@example.com')).toBe(false);
  });
});

