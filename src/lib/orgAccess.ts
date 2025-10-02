export function isOrgEmail(email?: string | null) {
    if (!email) return false;
    const at = email.toLowerCase().split("@")[1] || "";
    const domains = (process.env.ORG_EMAIL_DOMAINS || "")
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    return domains.includes(at);
  }
  
  export function isSuperadminEmail(email?: string | null) {
    if (!email) return false;
    const list = (process.env.SUPERADMIN_EMAILS || "")
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    return list.includes(email.toLowerCase());
  }  