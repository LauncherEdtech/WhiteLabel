import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import type { Course } from "@/types/course";
export function CourseCard({ course }: { course: Course }) {
  return (
    <Link href={ROUTES.COURSE(course.id)}>
      <Card className="group hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer h-full">
        <div className="h-32 rounded-t-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
          {course.thumbnail_url ? <img src={course.thumbnail_url} alt={course.name} className="w-full h-full object-cover rounded-t-xl" /> : <BookOpen className="h-10 w-10 text-primary/40" />}
        </div>
        <CardContent className="p-4 space-y-2">
          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{course.name}</p>
          <ProgressBar value={0} color="primary" size="sm" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Em andamento</span>
            <span className="text-xs text-primary font-medium flex items-center gap-1">Continuar<ChevronRight className="h-3 w-3" /></span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
