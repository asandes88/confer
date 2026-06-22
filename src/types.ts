export interface Note {
  id: string
  text: string
  createdAt: number
}

export interface CompanyInsight {
  summary: string
  keyTopics: string[]
  sentiment: 'Hot' | 'Warm' | 'Cool' | 'Unknown'
  priority: 'High' | 'Medium' | 'Low'
  nextSteps: string[]
  productsDiscussed: string[]
  peopleMentioned: string[]
  followUpEmailDraft: string
}

export interface Company {
  id: string
  name: string
  notes: Note[]
  insight?: CompanyInsight
}

export interface OverviewInsight {
  headline: string
  topOpportunities: string[]
  themes: string[]
  recommendedActions: string[]
}

export interface Conference {
  id: string
  name: string
  createdAt: number
  companies: Company[]
  overview?: OverviewInsight
}

export interface AppState {
  conferences: Conference[]
  activeConferenceId: string | null
}
