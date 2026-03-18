export type ItemType = "lesson"|"questions"|"review"|"simulado";
export type ItemStatus = "pending"|"completed"|"skipped"|"overdue";
export interface StudySchedule { id:string;course_id:string;course_name:string;generated_at:string;days:ScheduleDay[];stats:{total_items:number;completed:number;pending:number;overdue:number}; }
export interface ScheduleDay { date:string;day_label:string;is_today:boolean;total_hours:number;items:ScheduleItem[]; }
export interface ScheduleItem { id:string;type:ItemType;title:string;subject?:string;status:ItemStatus;estimated_minutes:number;lesson_id?:string;notes?:string;scheduled_for:string; }
