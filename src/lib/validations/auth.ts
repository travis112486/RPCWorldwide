export const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength) {
    return `Password must be at least ${PASSWORD_RULES.minLength} characters`;
  }
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (PASSWORD_RULES.requireNumber && !/\d/.test(password)) {
    return 'Password must contain at least one number';
  }
  if (PASSWORD_RULES.requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
  return null;
}

export function getAuthErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    'Invalid login credentials': 'Invalid email or password',
    'Email not confirmed': 'Please verify your email before signing in',
    'User already registered': 'An account with this email already exists',
    'Password should be at least 6 characters': 'Password must be at least 8 characters',
    'Email rate limit exceeded': 'Too many attempts. Please try again later',
    'auth_error': 'Authentication failed. Please try again',
  };

  for (const [key, msg] of Object.entries(messages)) {
    if (error.includes(key)) return msg;
  }
  return 'Something went wrong. Please try again.';
}
