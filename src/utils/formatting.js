import { safeStorage } from './storage';

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

export const cleanMerchantName = (description) => {
  if (!description) return '';
  
  let cleaned = description;
  const lower = description.toLowerCase();
  
  const customSplitsEnabled = safeStorage.getItem('finflow_enable_custom_splits') === 'true';

  // Specific Payroll/Employer / Tax Refund Mappings
  if (customSplitsEnabled) {
    if (lower.includes('becton dickinson') || lower.includes('becton')) {
      return 'Becton Dickinson';
    }
    if (lower.includes('kaitlyn trevisan') && (lower.includes('payroll') || lower.includes('ayroll') || lower.includes('cerx'))) {
      return 'Kaitlyn Trevisan Payroll';
    }

    const isExcluded = 
      lower.includes('clear spring') || 
      lower.includes('clearspring') || 
      lower.includes('guggenheim') || 
      lower.includes('natl west') || 
      lower.includes('national western') || 
      lower.includes('north american') ||
      lower.includes('hyundai') ||
      lower.includes('auto') ||
      lower.includes('motor') ||
      lower.includes('finance') ||
      lower.includes('payment') ||
      lower.includes('loan');

    if (!isExcluded) {
      if (lower.includes('trevisan,todd') || (lower.includes('todd trevisan') && (lower.includes('zik') || lower.includes('ppd')))) {
        return 'Todd Trevisan Payroll';
      }
      if (lower.includes('todd michael trevisan') && (lower.includes('ppd') || lower.includes('bc'))) {
        return 'Todd Trevisan Payroll';
      }
    }
  }
  if (lower.includes('franchise tax bd') || lower.includes('casttaxrfd')) {
    return 'Franchise Tax Board';
  }
  
  // Strip prefixes like TST*, SQ*, SP*, PAYPAL*, AMZN MKTP, etc.
  cleaned = cleaned.replace(/^(tst\*|sq\s*\*|sp\s*\*|paypal\s*\*|amzn\s*mktp\s*us\*|opos\s*\*|pending\s*-|purchase\s*at\s*|authorized\s*on\s*\d{2}\/\d{2}\s*)/i, '');
  
  // Remove store hashes, locations, phone numbers
  cleaned = cleaned.replace(/#\d+/g, ''); 
  cleaned = cleaned.replace(/\b\d{3}-\d{3}-\d{4}\b/g, ''); 
  cleaned = cleaned.replace(/\s+[A-Z]{2}\b/g, ''); 
  cleaned = cleaned.replace(/\b\d{5}\b/g, ''); 
  cleaned = cleaned.replace(/\bppd\b/i, '');
  cleaned = cleaned.replace(/id:\s*[x\d]+/i, '');
  
  // Clean up double spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned || description;
};

export const getCategoryEmoji = (categoryName) => {
  const name = String(categoryName || '').toLowerCase().trim();
  
  if (name.includes('paycheck') || name.includes('salary') || name.includes('wages') || name.includes('deposit') || name.includes('income')) return '💸';
  if (name.includes('grocery') || name.includes('groceries') || name.includes('costco') || name.includes('whole foods')) return '🛒';
  if (name.includes('dining') || name.includes('restaurant') || name.includes('food') || name.includes('cafe') || name.includes('starbucks') || name.includes('eat') || name.includes('bars')) return '🍔';
  if (name.includes('rent') || name.includes('mortgage') || name.includes('housing') || name.includes('home') || name.includes('residence')) return '🏠';
  if (name.includes('kid') || name.includes('child') || name.includes('daycare') || name.includes('sitter') || name.includes('baby') || name.includes('gear')) return '👶';
  if (name.includes('auto') || name.includes('transportation') || name.includes('fuel') || name.includes('gas') || name.includes('uber') || /\bcar\b/.test(name) || name.includes('car ')) return '🚗';
  if (name.includes('sub') || name.includes('stream') || name.includes('netflix') || name.includes('spotify') || name.includes('youtube')) return '📺';
  if (name.includes('fit') || name.includes('gym') || name.includes('workout') || name.includes('swim') || name.includes('lesson')) return '💪';
  if (name.includes('utility') || name.includes('utilities') || name.includes('electric') || name.includes('water') || name.includes('power')) return '⚡';
  if (name.includes('internet') || name.includes('cable') || name.includes('wifi') || name.includes('phone')) return '🌐';
  if (name.includes('insurance')) return '🛡️';
  if (name.includes('medical') || name.includes('dental') || name.includes('health') || name.includes('doctor') || name.includes('pharmacy')) return '🏥';
  if (name.includes('pet') || name.includes('dog') || /\bcat\b/.test(name) || name.includes('vet')) return '🐶';
  if (name.includes('travel') || name.includes('hotel') || name.includes('flight') || name.includes('trip') || name.includes('vacation')) return '✈️';
  if (name.includes('shop') || name.includes('amazon') || name.includes('target') || name.includes('store') || name.includes('purchase')) return '🛍️';
  if (name.includes('gift') || name.includes('donation') || name.includes('charity')) return '🎁';
  if (name.includes('entertain') || name.includes('movie') || name.includes('show') || name.includes('concert')) return '🎭';
  if (name.includes('golf')) return '⛳';
  if (name.includes('tax') || name.includes('irs')) return '🧾';
  if (name.includes('saving') || name.includes('savings') || name.includes('invest') || name.includes('retirement') || name.includes('401')) return '📈';
  if (name.includes('annuity')) return '💰';
  if (name.includes('interest')) return '💵';
  if (name.includes('fee') || name.includes('bank')) return '🏦';
  
  return '🏷️';
};
