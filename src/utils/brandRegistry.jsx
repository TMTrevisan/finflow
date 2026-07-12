import React from 'react';
import { PiggyBank, CreditCard, Landmark, Building2, Wallet } from 'lucide-react';

export const BRAND_REGISTRY = [
  { match: ['ally'], domain: 'ally.com', container: 'bg-[#002B49] border-none' },
  { match: ['american express', 'amex'], domain: 'americanexpress.com', container: 'bg-[#006fcf] border-none' },
  { match: ['bank of america', 'bofa', 'adv tiered', 'advantage savings', 'america'], domain: 'bankofamerica.com', container: 'bg-[#002664] border-none' },
  { match: ['capital one', 'venture'], domain: 'capitalone.com', container: 'bg-[#002855] border-none' },
  { match: ['chase'], domain: 'chase.com', container: 'bg-[#1172be] border-none' },
  { match: ['citibank', 'citi'], domain: 'citi.com', container: 'bg-[#003b70] border-none' },
  { match: ['etrade', 'e*trade'], domain: 'etrade.com', container: 'bg-[#5c2d91] border-none' },
  { match: ['fidelity', 'roth ira', 'traditional ira', 'community property', '401(k)'], domain: 'fidelity.com', container: 'bg-[#007a33] border-none' },
  { match: ['healthequity', 'hsa'], domain: 'healthequity.com', container: 'bg-[#0d4f8b] border-none' },
  { match: ['robinhood'], domain: 'robinhood.com', container: 'bg-[#00c805]/10 border border-[#00c805]/30' },
  { match: ['scholarshare'], domain: 'scholarshare529.com', container: 'bg-[#00573d] border-none' },
  { match: ['sofi'], domain: 'sofi.com', container: 'bg-[#0052ff] border-none' },
  { match: ['wealthfront'], domain: 'wealthfront.com', container: 'bg-[#ff4f00]/10 border border-[#ff4f00]/30' },
  { match: ['wells fargo', 'wells'], domain: 'wellsfargo.com', container: 'bg-[#b31b1b] border-none' },
  { match: ['my529', 'trevisan total us stock'], domain: 'my529.org', container: 'bg-[#0f4c81] border-none' },
  { match: ['marcus'], domain: 'marcus.com', container: 'bg-[#0c2340] border border-[#a28056]/30' },
  { match: ['wise'], domain: 'wise.com', container: 'bg-[#00B9FF] border-none' },
  { match: ['revolut'], domain: 'revolut.com', container: 'bg-black border-none' },
  { match: ['venmo'], domain: 'venmo.com', container: 'bg-[#008CFF] border-none' },
  { match: ['apple card', 'apple'], domain: 'apple.com', container: 'bg-gradient-to-tr from-slate-900 to-slate-700 border-none' }
];

export const getInstitutionDomain = (institution = '', accountName = '') => {
  const inst = String(institution || '').toLowerCase();
  const acc = String(accountName || '').toLowerCase();
  const found = BRAND_REGISTRY.find(b => 
    b.match.some(m => inst.includes(m) || acc.includes(m))
  );
  return found ? found.domain : null;
};

export const getBrandIconContainerClass = (accountName = '', institution = '') => {
  const inst = String(institution || '').toLowerCase();
  const acc = String(accountName || '').toLowerCase();
  const found = BRAND_REGISTRY.find(b => 
    b.match.some(m => inst.includes(m) || acc.includes(m))
  );
  if (found && found.container) {
    return found.container;
  }
  return 'bg-obsidian-900 border border-obsidian-800';
};

export const getBrandIcon = (accountName = '', type = '', institution = '') => {
  const domain = getInstitutionDomain(institution, accountName);
  if (domain) {
    return (
      <img 
        src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`} 
        alt={domain} 
        className="w-3.5 h-3.5 object-contain"
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    );
  }

  const nameLower = (accountName || '').toLowerCase();
  const typeLower = (type || '').toLowerCase();

  if (nameLower.includes('savings') || typeLower.includes('savings')) {
    return <PiggyBank size={14} className="text-emerald-400" />;
  }
  if (nameLower.includes('credit') || nameLower.includes('card') || typeLower.includes('credit')) {
    return <CreditCard size={14} className="text-rose-400" />;
  }
  if (nameLower.includes('checking') || typeLower.includes('checking')) {
    return <Landmark size={14} className="text-neon-indigo" />;
  }
  if (nameLower.includes('investment') || nameLower.includes('brokerage') || typeLower.includes('investment')) {
    return <Building2 size={14} className="text-violet-400" />;
  }
  return <Wallet size={14} className="text-slate-400" />;
};

export const getAccountStatusDot = (accountName = '') => {
  const name = String(accountName || '').toLowerCase();
  if (name.includes('emirates') || name.includes('revolut') || name.includes('apple') || name.includes('amex') || name.includes('adcb')) {
    return <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 absolute -top-0.5 -right-0.5" />;
  }
  return null;
};
