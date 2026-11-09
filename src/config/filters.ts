// Lead rules. Changing a rule here changes which jobs count as leads.

export const PM_TITLE = /\b((senior|sr\.?|principal|group|staff|lead) pm|product (manager|management|lead|leader)|head of product|chief product officer|cpo|vp,? (of )?product|vice president,? (of )?product|director,? (of )?product|product director)\b/i;

export const EXCLUDED_TITLE = /\b(product marketing|marketing manager|project manager|program manager|product designer|product analyst|product owner|associate product manager|apm)\b/i;

// Senior enough for a senior product leader. Plain "Product Manager" doesn't qualify.
export const SENIOR_TITLE = /\b(senior|sr\.?|staff|principal|group|lead|head|director|vp|vice president|chief|cpo|fractional|interim)\b/i;

export const FRACTIONAL = /\b(fractional|advisor|advisory|interim|contract|consultant|part[- ]time)\b/i;

export const BOSTON_AREA = /\b(boston|cambridge|somerville|waltham|newton|brookline|watertown|burlington|lexington|needham|woburn|quincy|medford|wellesley|framingham|bedford|massachusetts|, ?ma\b)/i;

export const REMOTE = /\bremote\b/i;
export const NON_US_REMOTE = /\b(emea|europe|uk|united kingdom|canada|india|apac|latam|germany|france|spain|poland|australia|singapore)\b/i;
