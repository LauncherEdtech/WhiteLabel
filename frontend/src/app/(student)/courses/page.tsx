// frontend/src/app/(student)/courses/page.tsx
"use client";

import { useCourses } from "@/lib/hooks/useCourses";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Clock, ChevronRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";
import type { Course } from "@/types/api";

export default function CoursesPage() {
  const { data: courses, isLoading, isFetching } = useCourses();

  // isLoading → true só na primeira carga sem cache
  // isFetching → true em qualquer refetch (inclusive background)
  // Mostra skeleton se está buscando E ainda não tem dados para exibir,
  // evitando o flash de "Nenhum curso encontrado" durante o refetch.
  const showSkeleton = isLoading || (isFetching && !courses?.length);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Meus Cursos
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Continue de onde parou
        </p>
      </div>

      {showSkeleton ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !courses?.length ? (
        <Card>
          <CardContent className="py-20 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">
                Nenhum curso encontrado
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Entre em contato com seu instrutor para obter acesso.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 stagger">
          {courses.map((course: Course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  return (
    <Link href={ROUTES.COURSE(course.id)}>
      <Card className="group hover:shadow-lg hover:border-primary/30 transition-all duration-200 cursor-pointer h-full animate-fade-in">
        {/* Thumbnail */}
        <div className="relative h-36 rounded-t-xl overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20">
          {course.thumbnail_url ? (
            <img
              src={course.thumbnail_url}
              alt={course.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="h-12 w-12 text-primary/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-3 left-3">
            <Badge variant="default" className="bg-white/20 backdrop-blur-sm text-white border-white/30 text-xs">
              Ativo
            </Badge>
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-display font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
              {course.name}
            </h3>
            {course.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {course.description}
              </p>
            )}
          </div>

          <ProgressBar value={0} color="primary" size="sm" />

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Em andamento
            </span>
            <span className="text-xs text-primary font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              Continuar
              <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}