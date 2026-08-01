export interface ReviewRecord {
  review_id: string;
  review: string;
  problem: string;
  pain_point?: string;
  product_area?: string;
  shopping_goal?: string;
  user_persona?: string;
  emotion?: string;
  barrier_to_new_category?: string;
  frequency?: string;
  priority?: string;
  recommended_action?: string;
  synced_at?: string;
}

export interface QueryFilters {
  user_persona?: string;
  product_area?: string;
  barrier_to_new_category?: string;
  priority?: string;
  emotion?: string;
}

export interface QueryRequest {
  question: string;
  filters?: QueryFilters;
}

export interface Theme {
  name: string;
  support_count: number;
  description: string;
  citations: string[];
}

export interface BarrierInsight {
  barrier: string;
  count: number;
  citations: string[];
}

export interface PersonaInsight {
  persona: string;
  behavior_summary: string;
  citations: string[];
}

export interface Citation {
  review_id: string;
  review: string;
  user_persona?: string;
  product_area?: string;
  barrier_to_new_category?: string;
}

export interface InsightResponse {
  ok: boolean;
  answer_summary: string;
  key_themes: Theme[];
  barriers: BarrierInsight[];
  persona_insights: PersonaInsight[];
  evidence_quality: 'strong' | 'moderate' | 'weak' | 'insufficient';
  citations: Citation[];
}
