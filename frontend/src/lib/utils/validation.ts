export const validation = {
  email:          (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  minLength:      (v: string, n: number) => v.trim().length >= n,
  maxLength:      (v: string, n: number) => v.trim().length <= n,
  strongPassword: (v: string) => v.length >= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v),
  slug:           (v: string) => /^[a-z0-9-]+$/.test(v),
  url:            (v: string) => { try { new URL(v); return true; } catch { return false; } },
};
export const messages = {
  required:     "Campo obrigatório",
  invalidEmail: "E-mail inválido",
  minLength:    (n: number) => `Mínimo ${n} caracteres`,
  maxLength:    (n: number) => `Máximo ${n} caracteres`,
  weakPassword: "Use maiúsculas e números",
  invalidSlug:  "Use apenas letras minúsculas, números e hífens",
};
