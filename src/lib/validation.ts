import { z } from 'zod';

// Comment validation schema
export const commentSchema = z.object({
  nickname: z.string()
    .trim()
    .min(2, { message: "Nickname en az 2 karakter olmalıdır" })
    .max(50, { message: "Nickname en fazla 50 karakter olabilir" })
    .regex(/^[a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]+$/, { message: "Nickname sadece harf ve rakam içerebilir" }),
  message: z.string()
    .trim()
    .min(10, { message: "Mesaj en az 10 karakter olmalıdır" })
    .max(500, { message: "Mesaj en fazla 500 karakter olabilir" })
});

// Auth validation schemas
export const emailSchema = z.string()
  .trim()
  .email({ message: "Geçerli bir e-posta adresi giriniz" })
  .max(255, { message: "E-posta en fazla 255 karakter olabilir" });

export const passwordSchema = z.string()
  .min(8, { message: "Şifre en az 8 karakter olmalıdır" })
  .max(72, { message: "Şifre en fazla 72 karakter olabilir" })
  .regex(/[A-Z]/, { message: "Şifre en az bir büyük harf içermelidir" })
  .regex(/[a-z]/, { message: "Şifre en az bir küçük harf içermelidir" })
  .regex(/[0-9]/, { message: "Şifre en az bir rakam içermelidir" });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Şifre gereklidir" })
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

// Admin place creation schema
export const placeSchema = z.object({
  name: z.string()
    .trim()
    .min(3, { message: "İsim en az 3 karakter olmalıdır" })
    .max(200, { message: "İsim en fazla 200 karakter olabilir" }),
  slug: z.string().optional(),
  category: z.string()
    .min(1, { message: "Kategori seçilmelidir" }),
  description: z.string()
    .trim()
    .max(5000, { message: "Açıklama en fazla 5000 karakter olabilir" })
    .optional(),
  country_code: z.string()
    .min(2, { message: "Ülke kodu seçilmelidir" })
    .max(2, { message: "Geçersiz ülke kodu" }),
  city: z.string()
    .trim()
    .max(100, { message: "Şehir adı en fazla 100 karakter olabilir" })
    .optional(),
  evidence_score: z.number()
    .min(0, { message: "Skor en az 0 olmalıdır" })
    .max(100, { message: "Skor en fazla 100 olabilir" }),
  status: z.enum(['pending', 'approved', 'rejected'])
});

// Sanitize HTML content to prevent XSS
export const sanitizeHtml = (html: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    "/": '&#x2F;',
  };
  const reg = /[&<>"'/]/gi;
  return html.replace(reg, (match) => map[match]);
};
