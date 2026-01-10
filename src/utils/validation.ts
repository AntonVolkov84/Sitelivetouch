export const sanitizeInput = (val: string): string => {
  return val.replace(/<[^>]*>?/gm, "").trim();
};

export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.toLowerCase());
};
