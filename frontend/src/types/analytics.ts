export interface StudentDashboard {
  student: {id:string;name:string;email:string};
  questions: {total_answered:number;overall_accuracy:number;today_answered:number;today_accuracy:number};
  time_studied: {today_minutes:number;week_minutes:number;weekly_goal_minutes:number;weekly_progress_percent:number};
  lesson_progress: {total_watched:number;total_available:number;progress_percent:number};
  discipline_performance: DisciplinePerformance[];
  pending_today: PendingItem[];
  insights: Insight[];
}
export interface DisciplinePerformance { discipline:string;total_attempts:number;correct_attempts:number;accuracy_rate:number;performance_label:"forte"|"regular"|"fraco"; }
export interface PendingItem { id:string;type:"lesson"|"questions"|"review"|"simulado";title:string;subject?:string;estimated_minutes:number; }
export interface Insight { type:"motivation"|"weakness"|"warning"|"positive"|"alert";icon:string;title:string;message:string;action?:{label:string;href:string}; }
export interface ProducerOverview { overview:ClassOverview;at_risk_students:AtRiskStudent[];class_discipline_performance:ClassDiscipline[];hardest_questions:HardQuestion[];student_rankings:StudentRankings;insights:Insight[]; }
export interface ClassOverview { total_students:number;active_last_7_days:number;engagement_rate:number;at_risk_count:number;avg_accuracy:number;total_questions_answered:number; }
export interface AtRiskStudent { id:string;name:string;email:string;risk_score:number;risk_level:"alto"|"médio"|"baixo";risk_reasons:string[];last_activity?:string; }
export interface ClassDiscipline { discipline:string;accuracy_rate:number;total_attempts:number; }
export interface HardQuestion { id:string;statement_preview:string;discipline?:string;accuracy_rate:number;total_attempts:number; }
export interface StudentRankings { top_performers:StudentRank[];needs_attention:StudentRank[]; }
export interface StudentRank { id:string;name:string;accuracy_rate:number;total_answered:number;last_activity?:string; }
