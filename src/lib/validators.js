import { isValidPhoneNumber } from 'react-phone-number-input'

// Returns true when phone is empty (optional) or is a valid international number
export function isValidPhone(phone) {
  if (!phone?.trim()) return true
  return isValidPhoneNumber(phone)
}

// Matches backend: min 8 chars, at least one letter and one number
export function isStrongPassword(password) {
  return (
    password.length >= 8 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  )
}

export const PASSWORD_HINT = 'Min. 8 characters, letters and numbers required.'
