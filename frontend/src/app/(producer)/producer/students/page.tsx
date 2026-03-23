// frontend/src/app/(producer)/producer/students/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import {
    Users, UserPlus, Search, BookOpen,
    CheckCircle2, XCircle, Phone, Mail,
    ChevronRight, Copy, Check,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { useDebounce } from "@/lib/hooks/useDebounce";

// ── Types ──────────────────────────────────────────────────────────────────

interface Student {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
    email_verified: boolean;
    created_at: string;
    enrolled_course_ids: string[];
}

interface Course {
    id: string;
    name: string;
    is_active: boolean;
}

interface CreateStudentForm {
    name: string;
    email: string;
    phone: string;
    password: string;
    course_ids: string[];
}

// ── Create Student Modal ───────────────────────────────────────────────────

function CreateStudentModal({
    open,
    onClose,
    courses,
}: {
    open: boolean;
    onClose: () => void;
    courses: Course[];
}) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
    const [tempPassword, setTempPassword] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateStudentForm>();

    const mutation = useMutation({
        mutationFn: (data: CreateStudentForm) =>
            apiClient.post("/students/", {
                ...data,
                phone: data.phone || null,
                password: data.password || null,
                course_ids: selectedCourses,
            }).then(r => r.data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["students"] });
            if (data.temp_password) {
                setTempPassword(data.temp_password);
            } else {
                toast.success("Aluno criado!", "O aluno já pode acessar a plataforma.");
                handleClose();
            }
        },
        onError: (err: any) => {
            toast.error(
                "Erro ao criar aluno",
                err?.response?.data?.message || "Tente novamente."
            );
        },
    });

    const handleClose = () => {
        reset();
        setSelectedCourses([]);
        setTempPassword(null);
        setCopied(false);
        onClose();
    };

    const toggleCourse = (id: string) => {
        setSelectedCourses(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const copyPassword = () => {
        if (tempPassword) {
            navigator.clipboard.writeText(tempPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Tela de senha temporária
    if (tempPassword) {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-success" />
                            Aluno criado com sucesso!
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Uma senha temporária foi gerada. Compartilhe com o aluno para que ele acesse a plataforma.
                        </p>
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
                            <code className="flex-1 font-mono text-sm text-foreground">{tempPassword}</code>
                            <Button variant="ghost" size="sm" onClick={copyPassword}>
                                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            O aluno poderá alterar a senha após o primeiro acesso.
                        </p>
                        <Button onClick={handleClose} className="w-full">Fechar</Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Novo Aluno
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
                    {/* Nome */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Nome *</label>
                        <Input
                            {...register("name", { required: "Nome obrigatório" })}
                            placeholder="Ex: Maria Silva"
                            error={!!errors.name}
                        />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">E-mail *</label>
                        <Input
                            {...register("email", { required: "E-mail obrigatório" })}
                            type="email"
                            placeholder="maria@exemplo.com"
                            error={!!errors.email}
                        />
                        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>

                    {/* Telefone */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Telefone</label>
                        <Input
                            {...register("phone")}
                            placeholder="(61) 99999-9999"
                        />
                    </div>

                    {/* Senha */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Senha</label>
                        <Input
                            {...register("password")}
                            type="password"
                            placeholder="Deixe em branco para gerar automaticamente"
                        />
                        <p className="text-xs text-muted-foreground">
                            Se não informada, uma senha segura será gerada e exibida após o cadastro.
                        </p>
                    </div>

                    {/* Cursos */}
                    {courses.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                                Matricular nos cursos
                            </label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {courses.map(course => (
                                    <label
                                        key={course.id}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                            selectedCourses.includes(course.id)
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:bg-muted/40"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0",
                                            selectedCourses.includes(course.id)
                                                ? "border-primary bg-primary"
                                                : "border-muted-foreground"
                                        )}
                                            onClick={() => toggleCourse(course.id)}
                                        >
                                            {selectedCourses.includes(course.id) && (
                                                <Check className="h-2.5 w-2.5 text-white" />
                                            )}
                                        </div>
                                        <span className="text-sm text-foreground">{course.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={mutation.isPending} className="flex-1">
                            {mutation.isPending ? "Criando..." : "Criar Aluno"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Manage Enrollments Modal ───────────────────────────────────────────────

function ManageEnrollmentsModal({
    student,
    courses,
    open,
    onClose,
}: {
    student: Student;
    courses: Course[];
    open: boolean;
    onClose: () => void;
}) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const [selected, setSelected] = useState<string[]>(student.enrolled_course_ids);

    const mutation = useMutation({
        mutationFn: () =>
            apiClient.put(`/students/${student.id}/enrollments`, {
                course_ids: selected,
            }).then(r => r.data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["students"] });
            toast.success(
                "Matrículas atualizadas!",
                `${data.enrolled_count} matriculado(s), ${data.unenrolled_count} removido(s).`
            );
            onClose();
        },
        onError: () => toast.error("Erro ao atualizar matrículas"),
    });

    const toggle = (id: string) =>
        setSelected(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Matrículas — {student.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Selecione os cursos que este aluno pode acessar:
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {courses.map(course => (
                            <label
                                key={course.id}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                    selected.includes(course.id)
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:bg-muted/40"
                                )}
                            >
                                <div
                                    className={cn(
                                        "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0",
                                        selected.includes(course.id)
                                            ? "border-primary bg-primary"
                                            : "border-muted-foreground"
                                    )}
                                    onClick={() => toggle(course.id)}
                                >
                                    {selected.includes(course.id) && (
                                        <Check className="h-2.5 w-2.5 text-white" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-foreground">{course.name}</p>
                                    {!course.is_active && (
                                        <p className="text-xs text-muted-foreground">Inativo</p>
                                    )}
                                </div>
                                {selected.includes(course.id) && (
                                    <Badge variant="outline" className="text-[10px] text-success border-success/30">
                                        Matriculado
                                    </Badge>
                                )}
                            </label>
                        ))}
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
                        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1">
                            {mutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProducerStudentsPage() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [showCreate, setShowCreate] = useState(false);
    const [managingStudent, setManagingStudent] = useState<Student | null>(null);
    const debouncedSearch = useDebounce(search, 400);
    const toast = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["students", { search: debouncedSearch, page }],
        queryFn: () => apiClient.get("/students/", {
            params: { search: debouncedSearch, page, per_page: 20 },
        }).then(r => r.data),
    });

    const { data: coursesData } = useQuery({
        queryKey: ["courses", "producer"],
        queryFn: () => apiClient.get("/courses/").then(r => r.data),
    });

    const toggleActiveMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
            apiClient.put(`/students/${id}`, { is_active }).then(r => r.data),
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ["students"] });
            toast.success(vars.is_active ? "Aluno ativado." : "Aluno desativado.");
        },
        onError: () => toast.error("Erro ao atualizar aluno"),
    });

    const students: Student[] = data?.students || [];
    const pagination = data?.pagination;
    const courses: Course[] = coursesData?.courses || [];

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Alunos</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {pagination?.total || 0} alunos cadastrados
                    </p>
                </div>
                <Button onClick={() => setShowCreate(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Novo Aluno
                </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Buscar por nome ou e-mail..."
                    className="pl-9"
                />
            </div>

            {/* List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
            ) : students.length === 0 ? (
                <Card>
                    <CardContent className="py-16 flex flex-col items-center gap-3">
                        <Users className="h-12 w-12 text-muted-foreground" />
                        <p className="font-semibold text-foreground">
                            {search ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}
                        </p>
                        <p className="text-sm text-muted-foreground text-center">
                            {search ? "Tente outros termos de busca." : "Clique em \"Novo Aluno\" para começar."}
                        </p>
                        {!search && (
                            <Button onClick={() => setShowCreate(true)} size="sm">
                                <UserPlus className="h-4 w-4 mr-1" /> Novo Aluno
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {students.map(student => (
                        <Card key={student.id} className={cn(!student.is_active && "opacity-60")}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                    {/* Avatar */}
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-bold text-primary">
                                            {student.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold text-foreground">{student.name}</p>
                                            {!student.is_active && (
                                                <Badge variant="destructive" className="text-[10px]">Inativo</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Mail className="h-3 w-3" /> {student.email}
                                            </span>
                                            {student.phone && (
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Phone className="h-3 w-3" /> {student.phone}
                                                </span>
                                            )}
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <BookOpen className="h-3 w-3" />
                                                {student.enrolled_course_ids.length} curso(s)
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setManagingStudent(student)}
                                        >
                                            <BookOpen className="h-3.5 w-3.5 mr-1" />
                                            Cursos
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleActiveMutation.mutate({
                                                id: student.id,
                                                is_active: !student.is_active,
                                            })}
                                            className={student.is_active
                                                ? "text-muted-foreground hover:text-destructive"
                                                : "text-muted-foreground hover:text-success"
                                            }
                                        >
                                            {student.is_active
                                                ? <XCircle className="h-4 w-4" />
                                                : <CheckCircle2 className="h-4 w-4" />
                                            }
                                        </Button>
                                        <Link href={`/producer/students/${student.id}`}>
                                            <Button variant="ghost" size="sm">
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Pagination */}
                    {pagination && pagination.pages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <Button
                                variant="outline" size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                Anterior
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                {page} de {pagination.pages}
                            </span>
                            <Button
                                variant="outline" size="sm"
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                disabled={page >= pagination.pages}
                            >
                                Próxima
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            <CreateStudentModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                courses={courses}
            />

            {managingStudent && (
                <ManageEnrollmentsModal
                    student={managingStudent}
                    courses={courses}
                    open={!!managingStudent}
                    onClose={() => setManagingStudent(null)}
                />
            )}
        </div>
    );
}