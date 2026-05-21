import { 
  Briefcase, Laptop, RefreshCw, Home, ShoppingCart, Utensils, Car, Plane,
  Tv, Dumbbell, Zap, Globe, Shield, Heart, Baby, ShoppingBag, Gift,
  Film, GraduationCap, TrendingUp, Landmark, Wifi, PawPrint, Coins, HelpCircle
} from 'lucide-react';

const CATEGORY_MAP = {
  // Income categories
  'salary': { color: '#10B981', icon: Briefcase },      // Emerald
  'paycheck': { color: '#10B981', icon: Briefcase },    // Emerald
  'freelance': { color: '#0D9488', icon: Laptop },     // Teal
  'interest': { color: '#06B6D4', icon: Coins },       // Cyan
  'transfer': { color: '#64748B', icon: RefreshCw },   // Slate
  'investment': { color: '#8B5CF6', icon: TrendingUp }, // Violet

  // Expense categories
  'rent': { color: '#6366F1', icon: Home },            // Indigo
  'mortgage': { color: '#3B82F6', icon: Home },        // Blue
  'living': { color: '#6366F1', icon: Home },          // Indigo
  'housing': { color: '#3B82F6', icon: Home },         // Blue
  'groceries': { color: '#10B981', icon: ShoppingCart },// Emerald
  'grocery': { color: '#10B981', icon: ShoppingCart },  // Emerald
  'costco': { color: '#10B981', icon: ShoppingCart },   // Emerald
  'dining': { color: '#F59E0B', icon: Utensils },      // Amber
  'restaurant': { color: '#F59E0B', icon: Utensils },  // Amber
  'food': { color: '#F59E0B', icon: Utensils },        // Amber
  'auto': { color: '#EC4899', icon: Car },             // Pink
  'transportation': { color: '#EC4899', icon: Car },   // Pink
  'car': { color: '#EC4899', icon: Car },              // Pink
  'gas': { color: '#EC4899', icon: Car },              // Pink
  'fuel': { color: '#EC4899', icon: Car },             // Pink
  'travel': { color: '#06B6D4', icon: Plane },         // Cyan
  'trip': { color: '#06B6D4', icon: Plane },           // Cyan
  'flight': { color: '#06B6D4', icon: Plane },         // Cyan
  'sub': { color: '#8B5CF6', icon: Tv },               // Violet
  'netflix': { color: '#8B5CF6', icon: Tv },           // Violet
  'spotify': { color: '#8B5CF6', icon: Tv },           // Violet
  'youtube': { color: '#8B5CF6', icon: Tv },           // Violet
  'fitness': { color: '#0D9488', icon: Dumbbell },     // Teal
  'gym': { color: '#0D9488', icon: Dumbbell },         // Teal
  'utility': { color: '#F59E0B', icon: Zap },          // Amber
  'utilities': { color: '#F59E0B', icon: Zap },        // Amber
  'power': { color: '#F59E0B', icon: Zap },            // Amber
  'electric': { color: '#F59E0B', icon: Zap },          // Amber
  'internet': { color: '#06B6D4', icon: Wifi },        // Cyan
  'cable': { color: '#06B6D4', icon: Wifi },          // Cyan
  'wifi': { color: '#06B6D4', icon: Wifi },            // Cyan
  'phone': { color: '#06B6D4', icon: Globe },          // Cyan
  'insurance': { color: '#EF4444', icon: Shield },     // Crimson
  'medical': { color: '#EF4444', icon: Heart },        // Crimson
  'dental': { color: '#EF4444', icon: Heart },        // Crimson
  'health': { color: '#EF4444', icon: Heart },         // Crimson
  'doctor': { color: '#EF4444', icon: Heart },         // Crimson
  'pet': { color: '#EC4899', icon: PawPrint },         // Pink
  'dog': { color: '#EC4899', icon: PawPrint },         // Pink
  'cat': { color: '#EC4899', icon: PawPrint },         // Pink
  'kid': { color: '#6366F1', icon: Baby },             // Indigo
  'baby': { color: '#6366F1', icon: Baby },            // Indigo
  'daycare': { color: '#6366F1', icon: Baby },         // Indigo
  'sitter': { color: '#6366F1', icon: Baby },          // Indigo
  'babysitter': { color: '#6366F1', icon: Baby },       // Indigo
  'shop': { color: '#EC4899', icon: ShoppingBag },     // Pink
  'shopping': { color: '#EC4899', icon: ShoppingBag }, // Pink
  'amazon': { color: '#EC4899', icon: ShoppingBag },   // Pink
  'target': { color: '#EC4899', icon: ShoppingBag },   // Pink
  'gift': { color: '#8B5CF6', icon: Gift },            // Violet
  'donation': { color: '#8B5CF6', icon: Gift },        // Violet
  'charity': { color: '#8B5CF6', icon: Gift },         // Violet
  'entertain': { color: '#3B82F6', icon: Film },       // Blue
  'movie': { color: '#3B82F6', icon: Film },           // Blue
  'show': { color: '#3B82F6', icon: Film },            // Blue
  'education': { color: '#10B981', icon: GraduationCap },// Emerald
  '529': { color: '#10B981', icon: GraduationCap },    // Emerald
  'wealth': { color: '#8B5CF6', icon: TrendingUp },    // Violet
  'investments': { color: '#8B5CF6', icon: TrendingUp },// Violet
  '401(k)': { color: '#8B5CF6', icon: TrendingUp },     // Violet
  '401k': { color: '#8B5CF6', icon: TrendingUp },      // Violet
  'fee': { color: '#64748B', icon: Landmark },         // Slate
  'bank': { color: '#64748B', icon: Landmark }         // Slate
};

export function getCategoryConfig(categoryName) {
  const name = String(categoryName || '').toLowerCase().trim();
  
  // Find key that is included in categoryName
  const matchingKey = Object.keys(CATEGORY_MAP).find(key => name.includes(key));
  
  if (matchingKey) {
    return CATEGORY_MAP[matchingKey];
  }
  
  // Default fallback config
  return {
    color: '#94A3B8', // Slate
    icon: HelpCircle
  };
}
