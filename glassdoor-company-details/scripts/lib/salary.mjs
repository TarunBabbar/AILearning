/**
 * Salary parsing utilities.
 *
 * Handles common Indian salary notations seen on Glassdoor reviews:
 *   - "₹20L", "₹20 LPA", "20 lakhs", "20 lpa"
 *   - "1500000 /yr", "₹1,500,000 per year"
 *   - "1.2 Cr", "₹12 L" (crores / lakhs)
 * All values are normalised to LPA (lakhs per annum).
 */

const LAKH = 100000;
const CRORE = 10000000;

function strip(s) {
  return s.replace(/[₹,]/g, "").trim().toLowerCase();
}

/** Parse a single salary string to LPA, or null if unparseable. */
export function parseSalaryToLpa(text) {
  const t = strip(text);

  // Plain amount with /yr, /year, per annum, per month
  let m = t.match(/^([\d.]+)\s*\/\s*(yr|year|yearly|annum|annually|yearly|pa|month|monthly)$/);
  if (m) {
    const amt = parseFloat(m[1]);
    if (Number.isNaN(amt)) return null;
    if (/(month|monthly)/.test(m[2])) return amt / LAKH * 12; // per month -> per year -> LPA
    return amt / LAKH;
  }

  // Plain number without suffix -> assume full rupees per year
  m = t.match(/^([\d.]+)$/);
  if (m) {
    const amt = parseFloat(m[1]);
    if (Number.isNaN(amt)) return null;
    // If it looks like an actual annual rupee figure (>= 100000), convert.
    return amt >= 100000 ? amt / LAKH : null;
  }

  // Crore notation: 1.2 cr / crores / Cr
  m = t.match(/^([\d.]+)\s*(cr|crore|crores)$/);
  if (m) {
    const v = parseFloat(m[1]);
    if (!Number.isNaN(v)) return (v * CRORE) / LAKH;
  }

  // Lakh notation: 20 l / 20 lakh / 20 lakhs / 20 lpa / 20 lacs
  m = t.match(/^([\d.]+)\s*(l|lpa|lakh|lakhs|lacs|lac)$/);
  if (m) {
    const v = parseFloat(m[1]);
    if (!Number.isNaN(v)) return v;
  }

  return null;
}

/**
 * Reject lines that clearly are not single salary figures (qualifiers,
 * "between", multiple designations, etc.) before attempting a parse.
 */
export function isPlausibleSalaryLine(text) {
  const t = strip(text);
  if (!t) return false;
  // Contains ambiguity markers we cannot trust.
  if (/(between|approx|around|about|upto|up to|plus|varies|-|to\b)/.test(t)) {
    return false;
  }
  // Must contain a number token from our covered notations.
  return /[\d.]/.test(t);
}

/** Simple average helper (returns null for empty lists). */
export function average(values) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Range string like "₹6–14" from a list of LPA values. */
export function range(list) {
  if (list.length === 0) return null;
  const min = Math.min(...list);
  const max = Math.max(...list);
  return min === max ? `${fmtLpa(min)}` : `${fmtLpa(min)}–${fmtLpa(max)}`;
}

/** 9.75 -> "9.8" */
export function fmtLpa(v) {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}