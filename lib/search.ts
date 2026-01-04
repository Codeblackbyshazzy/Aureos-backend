import { createServerClient } from './supabase';
import { SearchFilters, SearchResult, SearchResponse } from '../types';

export interface SearchOptions {
  query: string;
  projectId: string;
  userId: string;
  filters?: SearchFilters;
  page?: number;
  limit?: number;
}

export async function performFullTextSearch(options: SearchOptions): Promise<SearchResponse> {
  const { query, projectId, userId, filters = {}, page = 1, limit = 20 } = options;
  const supabase = createServerClient();

  let searchQuery = supabase
    .from('feedback_items')
    .select(`
      *,
      vote_count,
      follower_count,
      comment_count,
      status:feedback_statuses(id, name, color, icon),
      topics:feedback_topics(
        topic:topics(id, name, color, icon)
      ),
      comments:comments(count),
      votes:votes(count)
    `)
    .eq('project_id', projectId)
    .eq('deleted_at', null)
    .order('created_at', { ascending: false });

  // Add full-text search
  if (query && query.trim()) {
    searchQuery = searchQuery.textSearch('search_vector', query, {
      type: 'websearch',
      config: 'english'
    });
  }

  // Apply filters
  if (filters.sentiment && filters.sentiment.length > 0) {
    searchQuery = searchQuery.in('sentiment', filters.sentiment);
  }

  if (filters.sourceType && filters.sourceType.length > 0) {
    searchQuery = searchQuery.in('source_type', filters.sourceType);
  }

  if (filters.dateFrom) {
    searchQuery = searchQuery.gte('created_at', filters.dateFrom);
  }

  if (filters.dateTo) {
    searchQuery = searchQuery.lte('created_at', filters.dateTo);
  }

  if (filters.hasComments !== undefined) {
    if (filters.hasComments) {
      searchQuery = searchQuery.gt('comment_count', 0);
    } else {
      searchQuery = searchQuery.eq('comment_count', 0);
    }
  }

  if (filters.hasVotes !== undefined) {
    if (filters.hasVotes) {
      searchQuery = searchQuery.gt('vote_count', 0);
    } else {
      searchQuery = searchQuery.eq('vote_count', 0);
    }
  }

  if (filters.minVotes !== undefined) {
    searchQuery = searchQuery.gte('vote_count', filters.minVotes);
  }

  // Pagination
  const offset = (page - 1) * limit;
  searchQuery = searchQuery.range(offset, offset + limit - 1);

  const { data, error, count } = await searchQuery;

  if (error) throw error;

  // Process results for highlighting and ranking
  const results: SearchResult[] = (data || []).map(item => ({
    ...item,
    search_rank: calculateSearchRank(item, query),
    highlighted_text: highlightSearchTerms(item.text, query)
  }));

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  // Get facets for filtering
  const facets = await getSearchFacets(projectId, supabase);

  return {
    results,
    total,
    page,
    limit,
    totalPages,
    facets
  };
}

function calculateSearchRank(item: any, query: string): number {
  if (!query || !query.trim()) return 0;

  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
  const text = item.text.toLowerCase();
  
  let rank = 0;
  
  searchTerms.forEach(term => {
    // Exact match in title gets highest rank
    if (text.includes(term)) {
      rank += 10;
      
      // Boost for matches in the beginning
      const position = text.indexOf(term);
      if (position < 50) rank += 5;
      
      // Boost for exact word matches
      const wordMatches = text.match(new RegExp(`\\b${term}\\b`, 'g'));
      if (wordMatches) rank += wordMatches.length * 3;
    }
  });

  // Boost by popularity
  rank += Math.log(item.vote_count + 1) * 2;
  rank += Math.log(item.follower_count + 1) * 1.5;
  rank += item.comment_count * 0.5;

  return Math.round(rank);
}

function highlightSearchTerms(text: string, query: string): string {
  if (!query || !query.trim()) return text;

  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
  let highlightedText = text;

  searchTerms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
  });

  return highlightedText;
}

async function getSearchFacets(projectId: string, supabase: any) {
  // Get sentiment distribution
  const { data: sentimentData } = await supabase
    .from('feedback_items')
    .select('sentiment')
    .eq('project_id', projectId)
    .eq('deleted_at', null);

  const sentimentCounts = new Map<string, number>();
  sentimentData?.forEach(item => {
    if (item.sentiment) {
      sentimentCounts.set(item.sentiment, (sentimentCounts.get(item.sentiment) || 0) + 1);
    }
  });

  // Get source type distribution
  const { data: sourceTypeData } = await supabase
    .from('feedback_items')
    .select('source_type')
    .eq('project_id', projectId)
    .eq('deleted_at', null);

  const sourceTypeCounts = new Map<string, number>();
  sourceTypeData?.forEach(item => {
    sourceTypeCounts.set(item.source_type, (sourceTypeCounts.get(item.source_type) || 0) + 1);
  });

  // Get date range
  const { data: dateRangeData } = await supabase
    .from('feedback_items')
    .select('created_at')
    .eq('project_id', projectId)
    .eq('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  const { data: maxDateData } = await supabase
    .from('feedback_items')
    .select('created_at')
    .eq('project_id', projectId)
    .eq('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  return {
    sentiments: Array.from(sentimentCounts.entries()).map(([value, count]) => ({ value: value as any, count })),
    sourceTypes: Array.from(sourceTypeCounts.entries()).map(([value, count]) => ({ value: value as any, count })),
    dateRange: {
      min: dateRangeData?.[0]?.created_at || new Date().toISOString(),
      max: maxDateData?.[0]?.created_at || new Date().toISOString()
    }
  };
}

export async function getSearchSuggestions(projectId: string, partialQuery: string, userId: string) {
  const supabase = createServerClient();

  if (!partialQuery || partialQuery.length < 2) {
    return [];
  }

  // Search in existing feedback text for autocomplete
  const { data, error } = await supabase
    .from('feedback_items')
    .select('text')
    .eq('project_id', projectId)
    .eq('deleted_at', null)
    .textSearch('search_vector', `${partialQuery}:*`, {
      type: 'websearch',
      config: 'english'
    })
    .limit(10);

  if (error) throw error;

  // Extract suggestions from feedback text
  const suggestions = new Set<string>();
  data?.forEach(item => {
    const words = item.text.toLowerCase().split(' ');
    words.forEach(word => {
      if (word.startsWith(partialQuery.toLowerCase()) && word.length > partialQuery.length) {
        suggestions.add(word);
      }
    });
  });

  return Array.from(suggestions).slice(0, 5);
}

export async function advancedSearch(projectId: string, userId: string, searchParams: {
  query?: string;
  sentiment?: string[];
  sourceType?: string[];
  dateFrom?: string;
  dateTo?: string;
  minVotes?: number;
  hasComments?: boolean;
  hasVotes?: boolean;
  sortBy?: 'relevance' | 'date' | 'votes' | 'comments';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}) {
  const filters: SearchFilters = {
    sentiment: searchParams.sentiment as any[],
    sourceType: searchParams.sourceType as any[],
    dateFrom: searchParams.dateFrom,
    dateTo: searchParams.dateTo,
    minVotes: searchParams.minVotes,
    hasComments: searchParams.hasComments,
    hasVotes: searchParams.hasVotes
  };

  const searchOptions: SearchOptions = {
    query: searchParams.query || '',
    projectId,
    userId,
    filters,
    page: searchParams.page || 1,
    limit: searchParams.limit || 20
  };

  let response = await performFullTextSearch(searchOptions);

  // Apply custom sorting if needed
  if (searchParams.sortBy && searchParams.sortBy !== 'relevance') {
    const sortKey = searchParams.sortBy === 'date' ? 'created_at' : 
                   searchParams.sortBy === 'votes' ? 'vote_count' : 'comment_count';
    
    response.results.sort((a, b) => {
      const aVal = a[sortKey as keyof typeof a] as number;
      const bVal = b[sortKey as keyof typeof b] as number;
      
      return searchParams.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }

  return response;
}