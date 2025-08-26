export type Topic = {
  name: string;
};

export type SearchInput = {
  topics: string[];             // free text topics/keywords
  prioritizeHealthcare: boolean;
  prioritizeTexas: boolean;
  dateFrom?: string;            // YYYY-MM-DD (event start >=)
  dateTo?: string;              // YYYY-MM-DD (event start <=)
  maxResults?: number;          // per query cap
};

export type EventRecord = {
  event_name: string;
  organizer?: string;
  start_date?: string;
  end_date?: string;
  city?: string;
  state?: string;
  country?: string;
  cfp_deadline?: string;
  url: string;
  contact_url?: string;
  pays_speakers?: "yes"|"no"|"unknown";
  verticals: string[];
  source: string; // serp | manual | eventbrite | meetup | ticketmaster etc.
  score: number;  // 0-100 relevance
};
