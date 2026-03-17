#!/bin/bash
# scripts/create_frontend.sh
# Cria toda a estrutura de pastas e arquivos do frontend.
# Uso: bash scripts/create_frontend.sh
# Executa a partir da raiz do projeto (onde fica o docker-compose.yml)

set -euo pipefail

# ── Cores ──────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${BLUE}[INFO]${NC}  $1"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $1"; }
section() { echo -e "\n${BOLD}${CYAN}══ $1 ══${NC}\n"; }

# ── Contador ──────────────────────────────────────────────────────────────────
FILES_CREATED=0
DIRS_CREATED=0

# ── Helpers ────────────────────────────────────────────────────────────────────
mkd() {
  # Cria diretório se não existir
  if [ ! -d "$1" ]; then
    mkdir -p "$1"
    DIRS_CREATED=$((DIRS_CREATED + 1))
  fi
}

mkf() {
  # Cria arquivo vazio com comentário de caminho se não existir
  local path="$1"
  local comment="${2:-}"
  mkd "$(dirname "$path")"
  if [ ! -f "$path" ]; then
    if [ -n "$comment" ]; then
      echo "$comment" > "$path"
    else
      touch "$path"
    fi
    FILES_CREATED=$((FILES_CREATED + 1))
  fi
}

# ── Início ─────────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   Criando estrutura do Frontend              ║"
echo "  ║   Concurso Platform — Next.js 14             ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

ROOT="frontend"
SRC="$ROOT/src"

# ══════════════════════════════════════════════════════════════════════════════
section "1. Raiz do projeto"
# ══════════════════════════════════════════════════════════════════════════════

mkd "$ROOT"
mkd "$ROOT/public"

mkf "$ROOT/package.json"            "// frontend/package.json"
mkf "$ROOT/next.config.ts"          "// frontend/next.config.ts"
mkf "$ROOT/tailwind.config.ts"      "// frontend/tailwind.config.ts"
mkf "$ROOT/postcss.config.js"       "// frontend/postcss.config.js"
mkf "$ROOT/tsconfig.json"           "// frontend/tsconfig.json"
mkf "$ROOT/.env.local"              "# frontend/.env.local"
mkf "$ROOT/.env.example"            "# frontend/.env.example"
mkf "$ROOT/.eslintrc.json"          "// frontend/.eslintrc.json"
mkf "$ROOT/.gitignore"              "# frontend/.gitignore"
mkf "$ROOT/Dockerfile"              "# frontend/Dockerfile"

ok "Raiz criada"

# ══════════════════════════════════════════════════════════════════════════════
section "2. src/app — App Router"
# ══════════════════════════════════════════════════════════════════════════════

mkd "$SRC/app"

mkf "$SRC/app/layout.tsx"           "// frontend/src/app/layout.tsx"
mkf "$SRC/app/globals.css"          "/* frontend/src/app/globals.css */"
mkf "$SRC/app/providers.tsx"        "// frontend/src/app/providers.tsx"
mkf "$SRC/app/middleware.ts"        "// frontend/src/middleware.ts (raiz do src)"
mkf "$SRC/middleware.ts"            "// frontend/src/middleware.ts"

ok "app/ raiz criada"

# ── Grupo auth ────────────────────────────────────────────────────────────────
log "Criando grupo (auth)..."

mkf "$SRC/app/(auth)/layout.tsx"                              "// frontend/src/app/(auth)/layout.tsx"
mkf "$SRC/app/(auth)/login/page.tsx"                          "// frontend/src/app/(auth)/login/page.tsx"
mkf "$SRC/app/(auth)/register/page.tsx"                       "// frontend/src/app/(auth)/register/page.tsx"
mkf "$SRC/app/(auth)/forgot-password/page.tsx"                "// frontend/src/app/(auth)/forgot-password/page.tsx"
mkf "$SRC/app/(auth)/reset-password/page.tsx"                 "// frontend/src/app/(auth)/reset-password/page.tsx"

ok "(auth) criado"

# ── Grupo student ─────────────────────────────────────────────────────────────
log "Criando grupo (student)..."

mkf "$SRC/app/(student)/layout.tsx"                           "// frontend/src/app/(student)/layout.tsx"

mkf "$SRC/app/(student)/dashboard/page.tsx"                   "// frontend/src/app/(student)/dashboard/page.tsx"

mkf "$SRC/app/(student)/courses/page.tsx"                     "// frontend/src/app/(student)/courses/page.tsx"
mkf "$SRC/app/(student)/courses/[id]/page.tsx"                "// frontend/src/app/(student)/courses/[id]/page.tsx"
mkf "$SRC/app/(student)/courses/[id]/lessons/[lessonId]/page.tsx" \
                                                              "// frontend/src/app/(student)/courses/[id]/lessons/[lessonId]/page.tsx"

mkf "$SRC/app/(student)/questions/page.tsx"                   "// frontend/src/app/(student)/questions/page.tsx"

mkf "$SRC/app/(student)/simulados/page.tsx"                   "// frontend/src/app/(student)/simulados/page.tsx"
mkf "$SRC/app/(student)/simulados/[id]/page.tsx"              "// frontend/src/app/(student)/simulados/[id]/page.tsx"
mkf "$SRC/app/(student)/simulados/[id]/result/page.tsx"       "// frontend/src/app/(student)/simulados/[id]/result/page.tsx"

mkf "$SRC/app/(student)/schedule/page.tsx"                    "// frontend/src/app/(student)/schedule/page.tsx"

mkf "$SRC/app/(student)/analytics/page.tsx"                   "// frontend/src/app/(student)/analytics/page.tsx"

mkf "$SRC/app/(student)/profile/page.tsx"                     "// frontend/src/app/(student)/profile/page.tsx"

ok "(student) criado"

# ── Grupo producer ────────────────────────────────────────────────────────────
log "Criando grupo (producer)..."

mkf "$SRC/app/(producer)/layout.tsx"                          "// frontend/src/app/(producer)/layout.tsx"

mkf "$SRC/app/(producer)/producer/dashboard/page.tsx"         "// frontend/src/app/(producer)/producer/dashboard/page.tsx"

mkf "$SRC/app/(producer)/producer/courses/page.tsx"           "// frontend/src/app/(producer)/producer/courses/page.tsx"
mkf "$SRC/app/(producer)/producer/courses/new/page.tsx"       "// frontend/src/app/(producer)/producer/courses/new/page.tsx"
mkf "$SRC/app/(producer)/producer/courses/[id]/page.tsx"      "// frontend/src/app/(producer)/producer/courses/[id]/page.tsx"
mkf "$SRC/app/(producer)/producer/courses/[id]/edit/page.tsx" "// frontend/src/app/(producer)/producer/courses/[id]/edit/page.tsx"
mkf "$SRC/app/(producer)/producer/courses/[id]/subjects/page.tsx" \
                                                              "// frontend/src/app/(producer)/producer/courses/[id]/subjects/page.tsx"

mkf "$SRC/app/(producer)/producer/questions/page.tsx"         "// frontend/src/app/(producer)/producer/questions/page.tsx"
mkf "$SRC/app/(producer)/producer/questions/new/page.tsx"     "// frontend/src/app/(producer)/producer/questions/new/page.tsx"
mkf "$SRC/app/(producer)/producer/questions/[id]/edit/page.tsx" \
                                                              "// frontend/src/app/(producer)/producer/questions/[id]/edit/page.tsx"
mkf "$SRC/app/(producer)/producer/questions/import/page.tsx"  "// frontend/src/app/(producer)/producer/questions/import/page.tsx"

mkf "$SRC/app/(producer)/producer/simulados/page.tsx"         "// frontend/src/app/(producer)/producer/simulados/page.tsx"
mkf "$SRC/app/(producer)/producer/simulados/new/page.tsx"     "// frontend/src/app/(producer)/producer/simulados/new/page.tsx"
mkf "$SRC/app/(producer)/producer/simulados/[id]/page.tsx"    "// frontend/src/app/(producer)/producer/simulados/[id]/page.tsx"

mkf "$SRC/app/(producer)/producer/students/page.tsx"          "// frontend/src/app/(producer)/producer/students/page.tsx"
mkf "$SRC/app/(producer)/producer/students/[id]/page.tsx"     "// frontend/src/app/(producer)/producer/students/[id]/page.tsx"

mkf "$SRC/app/(producer)/producer/analytics/page.tsx"         "// frontend/src/app/(producer)/producer/analytics/page.tsx"

mkf "$SRC/app/(producer)/producer/settings/page.tsx"          "// frontend/src/app/(producer)/producer/settings/page.tsx"
mkf "$SRC/app/(producer)/producer/settings/branding/page.tsx" "// frontend/src/app/(producer)/producer/settings/branding/page.tsx"
mkf "$SRC/app/(producer)/producer/settings/notifications/page.tsx" \
                                                              "// frontend/src/app/(producer)/producer/settings/notifications/page.tsx"
mkf "$SRC/app/(producer)/producer/settings/domain/page.tsx"   "// frontend/src/app/(producer)/producer/settings/domain/page.tsx"

ok "(producer) criado"

# ── Grupo admin ───────────────────────────────────────────────────────────────
log "Criando grupo (admin)..."

mkf "$SRC/app/(admin)/layout.tsx"                             "// frontend/src/app/(admin)/layout.tsx"
mkf "$SRC/app/(admin)/admin/tenants/page.tsx"                 "// frontend/src/app/(admin)/admin/tenants/page.tsx"
mkf "$SRC/app/(admin)/admin/tenants/new/page.tsx"             "// frontend/src/app/(admin)/admin/tenants/new/page.tsx"
mkf "$SRC/app/(admin)/admin/tenants/[id]/page.tsx"            "// frontend/src/app/(admin)/admin/tenants/[id]/page.tsx"

ok "(admin) criado"

# ── API Routes (Next.js) ──────────────────────────────────────────────────────
log "Criando API routes..."

mkf "$SRC/app/api/tenant/route.ts"                            "// frontend/src/app/api/tenant/route.ts"

ok "API routes criadas"

# ══════════════════════════════════════════════════════════════════════════════
section "3. src/components"
# ══════════════════════════════════════════════════════════════════════════════

# ── UI base (shadcn-like) ─────────────────────────────────────────────────────
log "Criando components/ui..."

for component in \
  button card input label textarea select checkbox \
  dialog dropdown-menu progress separator tabs \
  toast toaster tooltip avatar badge spinner \
  empty-state skeleton; do
  mkf "$SRC/components/ui/${component}.tsx" "// frontend/src/components/ui/${component}.tsx"
done

ok "components/ui criado"

# ── Layout ────────────────────────────────────────────────────────────────────
log "Criando components/layout..."

mkf "$SRC/components/layout/StudentSidebar.tsx"    "// frontend/src/components/layout/StudentSidebar.tsx"
mkf "$SRC/components/layout/ProducerSidebar.tsx"   "// frontend/src/components/layout/ProducerSidebar.tsx"
mkf "$SRC/components/layout/AdminSidebar.tsx"      "// frontend/src/components/layout/AdminSidebar.tsx"
mkf "$SRC/components/layout/TopBar.tsx"            "// frontend/src/components/layout/TopBar.tsx"
mkf "$SRC/components/layout/MobileNav.tsx"         "// frontend/src/components/layout/MobileNav.tsx"
mkf "$SRC/components/layout/PageHeader.tsx"        "// frontend/src/components/layout/PageHeader.tsx"

ok "components/layout criado"

# ── Student ───────────────────────────────────────────────────────────────────
log "Criando components/student..."

mkf "$SRC/components/student/DashboardCard.tsx"        "// frontend/src/components/student/DashboardCard.tsx"
mkf "$SRC/components/student/InsightCard.tsx"          "// frontend/src/components/student/InsightCard.tsx"
mkf "$SRC/components/student/QuestionCard.tsx"         "// frontend/src/components/student/QuestionCard.tsx"
mkf "$SRC/components/student/FeedbackCard.tsx"         "// frontend/src/components/student/FeedbackCard.tsx"
mkf "$SRC/components/student/ScheduleDay.tsx"          "// frontend/src/components/student/ScheduleDay.tsx"
mkf "$SRC/components/student/ScheduleItemRow.tsx"      "// frontend/src/components/student/ScheduleItemRow.tsx"
mkf "$SRC/components/student/SimuladoTimer.tsx"        "// frontend/src/components/student/SimuladoTimer.tsx"
mkf "$SRC/components/student/SimuladoQuestion.tsx"     "// frontend/src/components/student/SimuladoQuestion.tsx"
mkf "$SRC/components/student/SimuladoResult.tsx"       "// frontend/src/components/student/SimuladoResult.tsx"
mkf "$SRC/components/student/LessonPlayer.tsx"         "// frontend/src/components/student/LessonPlayer.tsx"
mkf "$SRC/components/student/DisciplineBar.tsx"        "// frontend/src/components/student/DisciplineBar.tsx"
mkf "$SRC/components/student/WeeklyProgress.tsx"       "// frontend/src/components/student/WeeklyProgress.tsx"
mkf "$SRC/components/student/CourseCard.tsx"           "// frontend/src/components/student/CourseCard.tsx"
mkf "$SRC/components/student/SubjectTree.tsx"          "// frontend/src/components/student/SubjectTree.tsx"
mkf "$SRC/components/student/CheckinButton.tsx"        "// frontend/src/components/student/CheckinButton.tsx"

ok "components/student criado"

# ── Producer ──────────────────────────────────────────────────────────────────
log "Criando components/producer..."

mkf "$SRC/components/producer/StudentRiskBadge.tsx"    "// frontend/src/components/producer/StudentRiskBadge.tsx"
mkf "$SRC/components/producer/StudentTable.tsx"        "// frontend/src/components/producer/StudentTable.tsx"
mkf "$SRC/components/producer/CourseBuilder.tsx"       "// frontend/src/components/producer/CourseBuilder.tsx"
mkf "$SRC/components/producer/SubjectEditor.tsx"       "// frontend/src/components/producer/SubjectEditor.tsx"
mkf "$SRC/components/producer/LessonEditor.tsx"        "// frontend/src/components/producer/LessonEditor.tsx"
mkf "$SRC/components/producer/QuestionEditor.tsx"      "// frontend/src/components/producer/QuestionEditor.tsx"
mkf "$SRC/components/producer/QuestionImporter.tsx"    "// frontend/src/components/producer/QuestionImporter.tsx"
mkf "$SRC/components/producer/SimuladoBuilder.tsx"     "// frontend/src/components/producer/SimuladoBuilder.tsx"
mkf "$SRC/components/producer/AnalyticsChart.tsx"      "// frontend/src/components/producer/AnalyticsChart.tsx"
mkf "$SRC/components/producer/EngagementMetric.tsx"    "// frontend/src/components/producer/EngagementMetric.tsx"
mkf "$SRC/components/producer/BrandingEditor.tsx"      "// frontend/src/components/producer/BrandingEditor.tsx"
mkf "$SRC/components/producer/ColorPicker.tsx"         "// frontend/src/components/producer/ColorPicker.tsx"
mkf "$SRC/components/producer/NotificationForm.tsx"    "// frontend/src/components/producer/NotificationForm.tsx"
mkf "$SRC/components/producer/DomainSettings.tsx"      "// frontend/src/components/producer/DomainSettings.tsx"

ok "components/producer criado"

# ── Shared ────────────────────────────────────────────────────────────────────
log "Criando components/shared..."

mkf "$SRC/components/shared/ProgressBar.tsx"           "// frontend/src/components/shared/ProgressBar.tsx"
mkf "$SRC/components/shared/ProgressRing.tsx"          "// frontend/src/components/shared/ProgressRing.tsx"
mkf "$SRC/components/shared/DifficultyBadge.tsx"       "// frontend/src/components/shared/DifficultyBadge.tsx"
mkf "$SRC/components/shared/RoleBadge.tsx"             "// frontend/src/components/shared/RoleBadge.tsx"
mkf "$SRC/components/shared/EmptyState.tsx"            "// frontend/src/components/shared/EmptyState.tsx"
mkf "$SRC/components/shared/ErrorState.tsx"            "// frontend/src/components/shared/ErrorState.tsx"
mkf "$SRC/components/shared/LoadingSpinner.tsx"        "// frontend/src/components/shared/LoadingSpinner.tsx"
mkf "$SRC/components/shared/PageSkeleton.tsx"          "// frontend/src/components/shared/PageSkeleton.tsx"
mkf "$SRC/components/shared/ConfirmDialog.tsx"         "// frontend/src/components/shared/ConfirmDialog.tsx"
mkf "$SRC/components/shared/SearchInput.tsx"           "// frontend/src/components/shared/SearchInput.tsx"
mkf "$SRC/components/shared/Pagination.tsx"            "// frontend/src/components/shared/Pagination.tsx"
mkf "$SRC/components/shared/FilterChips.tsx"           "// frontend/src/components/shared/FilterChips.tsx"
mkf "$SRC/components/shared/StatCard.tsx"              "// frontend/src/components/shared/StatCard.tsx"

ok "components/shared criado"

# ── Charts ────────────────────────────────────────────────────────────────────
log "Criando components/charts..."

mkf "$SRC/components/charts/AccuracyChart.tsx"         "// frontend/src/components/charts/AccuracyChart.tsx"
mkf "$SRC/components/charts/ProgressChart.tsx"         "// frontend/src/components/charts/ProgressChart.tsx"
mkf "$SRC/components/charts/EngagementChart.tsx"       "// frontend/src/components/charts/EngagementChart.tsx"
mkf "$SRC/components/charts/DisciplineRadar.tsx"       "// frontend/src/components/charts/DisciplineRadar.tsx"
mkf "$SRC/components/charts/SimuladoScoreChart.tsx"    "// frontend/src/components/charts/SimuladoScoreChart.tsx"

ok "components/charts criado"

# ══════════════════════════════════════════════════════════════════════════════
section "4. src/lib — API, Hooks, Stores, Utils"
# ══════════════════════════════════════════════════════════════════════════════

# ── API clients ───────────────────────────────────────────────────────────────
log "Criando lib/api..."

mkf "$SRC/lib/api/client.ts"          "// frontend/src/lib/api/client.ts"
mkf "$SRC/lib/api/auth.ts"            "// frontend/src/lib/api/auth.ts"
mkf "$SRC/lib/api/courses.ts"         "// frontend/src/lib/api/courses.ts"
mkf "$SRC/lib/api/questions.ts"       "// frontend/src/lib/api/questions.ts"
mkf "$SRC/lib/api/analytics.ts"       "// frontend/src/lib/api/analytics.ts"
mkf "$SRC/lib/api/schedule.ts"        "// frontend/src/lib/api/schedule.ts"
mkf "$SRC/lib/api/simulados.ts"       "// frontend/src/lib/api/simulados.ts"
mkf "$SRC/lib/api/tenants.ts"         "// frontend/src/lib/api/tenants.ts"

ok "lib/api criado"

# ── Hooks React Query ─────────────────────────────────────────────────────────
log "Criando lib/hooks..."

mkf "$SRC/lib/hooks/useAuth.ts"       "// frontend/src/lib/hooks/useAuth.ts"
mkf "$SRC/lib/hooks/useCourses.ts"    "// frontend/src/lib/hooks/useCourses.ts"
mkf "$SRC/lib/hooks/useQuestions.ts"  "// frontend/src/lib/hooks/useQuestions.ts"
mkf "$SRC/lib/hooks/useAnalytics.ts"  "// frontend/src/lib/hooks/useAnalytics.ts"
mkf "$SRC/lib/hooks/useSchedule.ts"   "// frontend/src/lib/hooks/useSchedule.ts"
mkf "$SRC/lib/hooks/useSimulados.ts"  "// frontend/src/lib/hooks/useSimulados.ts"
mkf "$SRC/lib/hooks/useTenant.ts"     "// frontend/src/lib/hooks/useTenant.ts"
mkf "$SRC/lib/hooks/useDebounce.ts"   "// frontend/src/lib/hooks/useDebounce.ts"
mkf "$SRC/lib/hooks/useTimer.ts"      "// frontend/src/lib/hooks/useTimer.ts"
mkf "$SRC/lib/hooks/useLocalStorage.ts" "// frontend/src/lib/hooks/useLocalStorage.ts"

ok "lib/hooks criado"

# ── Stores Zustand ────────────────────────────────────────────────────────────
log "Criando lib/stores..."

mkf "$SRC/lib/stores/authStore.ts"    "// frontend/src/lib/stores/authStore.ts"
mkf "$SRC/lib/stores/tenantStore.ts"  "// frontend/src/lib/stores/tenantStore.ts"
mkf "$SRC/lib/stores/uiStore.ts"      "// frontend/src/lib/stores/uiStore.ts"

ok "lib/stores criado"

# ── Theme ─────────────────────────────────────────────────────────────────────
log "Criando lib/theme..."

mkf "$SRC/lib/theme/ThemeProvider.tsx"    "// frontend/src/lib/theme/ThemeProvider.tsx"
mkf "$SRC/lib/theme/defaultTheme.ts"      "// frontend/src/lib/theme/defaultTheme.ts"
mkf "$SRC/lib/theme/colorUtils.ts"        "// frontend/src/lib/theme/colorUtils.ts"

ok "lib/theme criado"

# ── Utils ─────────────────────────────────────────────────────────────────────
log "Criando lib/utils..."

mkf "$SRC/lib/utils/cn.ts"            "// frontend/src/lib/utils/cn.ts"
mkf "$SRC/lib/utils/format.ts"        "// frontend/src/lib/utils/format.ts"
mkf "$SRC/lib/utils/date.ts"          "// frontend/src/lib/utils/date.ts"
mkf "$SRC/lib/utils/time.ts"          "// frontend/src/lib/utils/time.ts"
mkf "$SRC/lib/utils/validation.ts"    "// frontend/src/lib/utils/validation.ts"
mkf "$SRC/lib/utils/cookies.ts"       "// frontend/src/lib/utils/cookies.ts"

ok "lib/utils criado"

# ── Constants ─────────────────────────────────────────────────────────────────
log "Criando lib/constants..."

mkf "$SRC/lib/constants/routes.ts"    "// frontend/src/lib/constants/routes.ts"
mkf "$SRC/lib/constants/queryKeys.ts" "// frontend/src/lib/constants/queryKeys.ts"
mkf "$SRC/lib/constants/config.ts"    "// frontend/src/lib/constants/config.ts"

ok "lib/constants criado"

# ══════════════════════════════════════════════════════════════════════════════
section "5. src/types"
# ══════════════════════════════════════════════════════════════════════════════

mkf "$SRC/types/tenant.ts"            "// frontend/src/types/tenant.ts"
mkf "$SRC/types/user.ts"              "// frontend/src/types/user.ts"
mkf "$SRC/types/api.ts"               "// frontend/src/types/api.ts"
mkf "$SRC/types/course.ts"            "// frontend/src/types/course.ts"
mkf "$SRC/types/question.ts"          "// frontend/src/types/question.ts"
mkf "$SRC/types/schedule.ts"          "// frontend/src/types/schedule.ts"
mkf "$SRC/types/simulado.ts"          "// frontend/src/types/simulado.ts"
mkf "$SRC/types/analytics.ts"         "// frontend/src/types/analytics.ts"

ok "types/ criado"

# ══════════════════════════════════════════════════════════════════════════════
section "6. Verificação final"
# ══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}Estrutura criada:${NC}"
echo ""

# Mostra a árvore se 'tree' estiver disponível, senão usa find
if command -v tree >/dev/null 2>&1; then
  tree "$ROOT/src" -I "node_modules" --dirsfirst -a
else
  find "$ROOT/src" -type f | sort | sed "s|$ROOT/src/||" | \
    awk -F'/' '{
      indent=""
      for(i=1;i<NF;i++) indent=indent"  "
      print indent "├── " $NF
    }'
fi

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║  ✓ Estrutura criada com sucesso!             ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  📁 Diretórios: ${DIRS_CREATED}$(printf ' %.0s' $(seq 1 $((30 - ${#DIRS_CREATED}))))║${NC}"
echo -e "${BOLD}║  📄 Arquivos:   ${FILES_CREATED}$(printf ' %.0s' $(seq 1 $((30 - ${#FILES_CREATED}))))║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║  Próximos passos:                            ║${NC}"
echo -e "${BOLD}║  1. cd frontend                              ║${NC}"
echo -e "${BOLD}║  2. npm install                              ║${NC}"
echo -e "${BOLD}║  3. npm run dev                              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""