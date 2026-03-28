const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fd/i,
  /^fe80:/i,
  /^::1$/,
  /^localhost$/i,
];

export interface ValidationResult {
  valid: boolean;
  url: string;
  error?: string;
}

export function validateUrl(input: string): ValidationResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { valid: false, url: '', error: 'URL is required' };
  }

  if (trimmed.length > 2048) {
    return { valid: false, url: '', error: 'URL is too long (max 2048 characters)' };
  }

  // Add protocol if missing
  let urlString = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(urlString)) {
    urlString = `https://${urlString}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, url: '', error: 'Invalid URL format' };
  }

  // Only allow http and https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, url: '', error: 'Only HTTP and HTTPS protocols are allowed' };
  }

  // Check for private/reserved IPs and localhost
  const hostname = parsed.hostname;
  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(hostname)) {
      return { valid: false, url: '', error: 'Private/local addresses are not allowed' };
    }
  }

  // Block common internal hostnames
  if (/^(localhost|\.local$|\.internal$)/i.test(hostname)) {
    return { valid: false, url: '', error: 'Internal hostnames are not allowed' };
  }

  // Ensure hostname has at least one dot (is a real domain)
  if (!hostname.includes('.') && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return { valid: false, url: '', error: 'Invalid hostname' };
  }

  return { valid: true, url: parsed.toString() };
}
