export type InitResponse = {
  type: 'init';
  postId: string;
  username: string;
  subreddit: string;
  currentHealth: number;
  trend: HourlyBucket[];
  recentAlerts: Alert[];
};

export type HourlyBucket = {
  hour: string;
  avgToxicity: number;
  avgSeverity: number;
  commentCount: number;
};

export type Alert = {
  timestamp: number;
  commentId: string;
  author: string;
  toxicityScore: number;
  excerpt: string;
  postId: string;
  subreddit: string;
};

export type DashboardResponse = {
  type: 'dashboard';
  currentHealth: number;
  trend: HourlyBucket[];
  recentAlerts: Alert[];
};

export type WebviewToBlockMessage =
  | { type: 'init' }
  | { type: 'refresh' };

export type BlocksToWebviewMessage =
  | InitResponse
  | DashboardResponse;