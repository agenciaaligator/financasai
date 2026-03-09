import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface CategoryPattern {
  id: string;
  keyword: string;
  category_id: string;
  confidence_score: number;
  usage_count: number;
}

interface CategorySuggestion {
  category_id: string;
  category_name?: string;
  confidence: number;
  source: 'pattern' | 'none';
}

export function useCategoryPatterns() {
  const [patterns, setPatterns] = useState<CategoryPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchPatterns = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_category_patterns')
        .select('*')
        .eq('user_id', user.id)
        .order('usage_count', { ascending: false });

      if (!error && data) {
        setPatterns(data as CategoryPattern[]);
      }
    } catch (err) {
      console.error('Error fetching patterns:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  /**
   * Extract keywords from a transaction title
   */
  const extractKeywords = (title: string): string[] => {
    const stopWords = new Set([
      'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
      'um', 'uma', 'uns', 'umas', 'o', 'a', 'os', 'as', 'e', 'ou',
      'com', 'sem', 'por', 'para', 'the', 'of', 'and', 'in', 'to',
      'at', 'for', 'on', 'is', 'it', 'my', 'that', 'this'
    ]);
    
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w));
  };

  /**
   * Learn a pattern: when user assigns a category to a transaction
   */
  const learnPattern = useCallback(async (title: string, categoryId: string): Promise<boolean> => {
    if (!user) return false;
    
    const keywords = extractKeywords(title);
    if (keywords.length === 0) return false;

    let learned = false;
    
    for (const keyword of keywords) {
      try {
        // Upsert: increment usage_count if exists, create if not
        const { data: existing } = await supabase
          .from('user_category_patterns')
          .select('id, usage_count, confidence_score')
          .eq('user_id', user.id)
          .eq('keyword', keyword)
          .eq('category_id', categoryId)
          .maybeSingle();

        if (existing) {
          const newCount = (existing.usage_count || 1) + 1;
          const newConfidence = Math.min(1, (existing.confidence_score || 1) + 0.1);
          await supabase
            .from('user_category_patterns')
            .update({ usage_count: newCount, confidence_score: newConfidence })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('user_category_patterns')
            .insert({
              user_id: user.id,
              keyword,
              category_id: categoryId,
              confidence_score: 1,
              usage_count: 1
            });
        }
        learned = true;
      } catch (err) {
        console.error('Error learning pattern for keyword:', keyword, err);
      }
    }

    if (learned) {
      await fetchPatterns();
    }
    return learned;
  }, [user, fetchPatterns]);

  /**
   * Suggest a category based on learned patterns
   */
  const suggestCategory = useCallback((title: string, categories: Array<{ id: string; name: string; type: string }>): CategorySuggestion | null => {
    if (patterns.length === 0 || !title.trim()) return null;

    const keywords = extractKeywords(title);
    if (keywords.length === 0) return null;

    // Score each category based on keyword matches
    const categoryScores = new Map<string, { totalScore: number; matches: number }>();

    for (const keyword of keywords) {
      const matchingPatterns = patterns.filter(p => p.keyword === keyword);
      for (const pattern of matchingPatterns) {
        const existing = categoryScores.get(pattern.category_id) || { totalScore: 0, matches: 0 };
        existing.totalScore += pattern.confidence_score * pattern.usage_count;
        existing.matches += 1;
        categoryScores.set(pattern.category_id, existing);
      }
    }

    if (categoryScores.size === 0) return null;

    // Find the best scoring category
    let bestCategoryId = '';
    let bestScore = 0;

    categoryScores.forEach((value, categoryId) => {
      const score = value.totalScore * (value.matches / keywords.length);
      if (score > bestScore) {
        bestScore = score;
        bestCategoryId = categoryId;
      }
    });

    if (!bestCategoryId || bestScore < 0.5) return null;

    const matchedCategory = categories.find(c => c.id === bestCategoryId);
    
    return {
      category_id: bestCategoryId,
      category_name: matchedCategory?.name,
      confidence: Math.min(1, bestScore / 5),
      source: 'pattern'
    };
  }, [patterns]);

  return {
    patterns,
    loading,
    learnPattern,
    suggestCategory,
    extractKeywords,
    refetchPatterns: fetchPatterns
  };
}
