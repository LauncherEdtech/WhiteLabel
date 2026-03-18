// frontend/src/components/shared/Pagination.tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
    page: number;
    pages: number;
    onPageChange: (page: number) => void;
}

function Pagination({ page, pages, onPageChange }: PaginationProps) {
    if (pages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2 mt-4">
            <Button
                variant="outline" size="icon-sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="text-sm text-muted-foreground px-2">
                {page} de {pages}
            </span>

            <Button
                variant="outline" size="icon-sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= pages}
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}

export { Pagination };