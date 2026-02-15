export function validateAge(dateOfBirth: string): string | null {
  if (!dateOfBirth) return 'Date of birth is required';
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  if (age < 18) return 'You must be at least 18 years old';
  if (age > 120) return 'Please enter a valid date of birth';
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone) return null; // optional
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) {
    return 'Please enter a valid phone number';
  }
  return null;
}

export function validateZip(zip: string): string | null {
  if (!zip) return null; // optional
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    return 'Please enter a valid ZIP code (e.g., 12345)';
  }
  return null;
}

export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export function validateUrl(url: string, domain?: string): string | null {
  if (!url) return null; // optional
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'URL must start with https://';
    }
    if (domain && !parsed.hostname.includes(domain)) {
      return `URL must be a ${domain} link`;
    }
    return null;
  } catch {
    return 'Please enter a valid URL';
  }
}

export function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

// Convert height between feet/inches and cm
export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 30.48 + inches * 2.54) * 10) / 10;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches: inches === 12 ? 0 : inches };
}

// Convert weight between lbs and kg
export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462);
}
