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
    ChevronRight, Copy, Check, Upload,
    Plus, Trash2, AlertCircle, CheckCheck,
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
}

interface BulkStudentRow {
    id: string; // local key
    name: string;
    email: string;
    phone: string;
}

interface BulkResult {
    row: number;
    name: string;
    email: string;
    status: "success" | "error";
    error?: string;
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
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Nome *</label>
                        <Input
                            {...register("name", { required: "Nome obrigatório" })}
                            placeholder="Ex: Maria Silva"
                            error={!!errors.name}
                        />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>

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

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Telefone</label>
                        <Input {...register("phone")} placeholder="(61) 99999-9999" />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Senha</label>
                        <Input {...register("password")} placeholder="Deixe em branco para gerar automaticamente" />
                        <p className="text-xs text-muted-foreground">Se não informada, uma senha segura será gerada e exibida após o cadastro.</p>
                    </div>

                    {courses.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Matricular nos cursos</label>
                            {courses.map(course => (
                                <label key={course.id} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedCourses.includes(course.id)}
                                        onChange={() => toggleCourse(course.id)}
                                        className="rounded"
                                    />
                                    <span className="text-sm">{course.name}</span>
                                </label>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" loading={mutation.isPending} className="flex-1">
                            Criar Aluno
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Bulk Import Modal ──────────────────────────────────────────────────────

function BulkImportModal({
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
    const [rows, setRows] = useState<BulkStudentRow[]>([
        { id: crypto.randomUUID(), name: "", email: "", phone: "" },
    ]);
    const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
    const [results, setResults] = useState<BulkResult[] | null>(null);
    const [summary, setSummary] = useState<{ total: number; success: number; errors: number } | null>(null);

    const mutation = useMutation({
        mutationFn: () =>
            apiClient.post("/students/bulk", {
                students: rows
                    .filter(r => r.name.trim() && r.email.trim())
                    .map(r => ({ name: r.name.trim(), email: r.email.trim(), phone: r.phone.trim() || null })),
                course_ids: selectedCourses,
            }).then(r => r.data),
        onSuccess: (data) => {
            setResults(data.results);
            setSummary(data.summary);
            queryClient.invalidateQueries({ queryKey: ["students"] });
        },
        onError: (err: any) => {
            toast.error("Erro na importação", err?.response?.data?.message || "Tente novamente.");
        },
    });

    const handleClose = () => {
        setRows([{ id: crypto.randomUUID(), name: "", email: "", phone: "" }]);
        setSelectedCourses([]);
        setResults(null);
        setSummary(null);
        onClose();
    };

    const addRow = () => {
        setRows(prev => [...prev, { id: crypto.randomUUID(), name: "", email: "", phone: "" }]);
    };

    const removeRow = (id: string) => {
        if (rows.length === 1) return;
        setRows(prev => prev.filter(r => r.id !== id));
    };

    const updateRow = (id: string, field: keyof BulkStudentRow, value: string) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const toggleCourse = (id: string) => {
        setSelectedCourses(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const validRows = rows.filter(r => r.name.trim() && r.email.trim());

    // Tela de resultados
    if (results) {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCheck className="h-5 w-5 text-primary" />
                            Resultado da importação
                        </DialogTitle>
                    </DialogHeader>

                    {summary && (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 rounded-lg bg-muted text-center">
                                <p className="text-2xl font-bold text-foreground">{summary.total}</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                            </div>
                            <div className="p-3 rounded-lg bg-success/10 text-center">
                                <p className="text-2xl font-bold text-success">{summary.success}</p>
                                <p className="text-xs text-muted-foreground">Criados</p>
                            </div>
                            <div className="p-3 rounded-lg bg-destructive/10 text-center">
                                <p className="text-2xl font-bold text-destructive">{summary.errors}</p>
                                <p className="text-xs text-muted-foreground">Erros</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {results.map((result) => (
                            <div
                                key={result.row}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg border",
                                    result.status === "success"
                                        ? "bg-success/5 border-success/20"
                                        : "bg-destructive/5 border-destructive/20"
                                )}
                            >
                                {result.status === "success" ? (
                                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{result.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{result.email}</p>
                                </div>
                                {result.error && (
                                    <p className="text-xs text-destructive text-right shrink-0 max-w-[180px]">{result.error}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    <Button onClick={handleClose} className="w-full">Fechar</Button>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Importar lista de alunos
                    </DialogTitle>
                </DialogHeader>

                <p className="text-sm text-muted-foreground">
                    Adicione os alunos na tabela abaixo. A senha inicial será gerada automaticamente como
                    <strong className="text-foreground"> PrimeiroNome + 4 últimos dígitos do celular</strong>.
                </p>

                {/* Tabela de alunos */}
                <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 px-1">
                        <p className="text-xs font-medium text-muted-foreground">Nome *</p>
                        <p className="text-xs font-medium text-muted-foreground">E-mail *</p>
                        <p className="text-xs font-medium text-muted-foreground">Telefone</p>
                        <div />
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {rows.map((row, idx) => (
                            <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 items-center">
                                <Input
                                    value={row.name}
                                    onChange={e => updateRow(row.id, "name", e.target.value)}
                                    placeholder="Nome completo"
                                    className="h-8 text-sm"
                                />
                                <Input
                                    value={row.email}
                                    onChange={e => updateRow(row.id, "email", e.target.value)}
                                    placeholder="email@exemplo.com"
                                    type="email"
                                    className="h-8 text-sm"
                                />
                                <Input
                                    value={row.phone}
                                    onChange={e => updateRow(row.id, "phone", e.target.value)}
                                    placeholder="(61) 99999-9999"
                                    className="h-8 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeRow(row.id)}
                                    disabled={rows.length === 1}
                                    className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full">
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Adicionar linha
                    </Button>
                </div>

                {/* Cursos */}
                {courses.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Matricular em:</p>
                        <div className="grid grid-cols-2 gap-2">
                            {courses.map(course => (
                                <label
                                    key={course.id}
                                    className={cn(
                                        "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors",
                                        selectedCourses.includes(course.id)
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedCourses.includes(course.id)}
                                        onChange={() => toggleCourse(course.id)}
                                        className="rounded"
                                    />
                                    <span className="text-sm truncate">{course.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => mutation.mutate()}
                        loading={mutation.isPending}
                        disabled={validRows.length === 0}
                        className="flex-1"
                    >
                        Importar {validRows.length > 0 ? `${validRows.length} aluno${validRows.length > 1 ? "s" : ""}` : ""}
                    </Button>
                </div>
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
    const [selected, setSelected] = useState<string[]>(student.enrolled_course_ids || []);

    const mutation = useMutation({
        mutationFn: () =>
            apiClient.put(`/students/${student.id}/enrollments`, { course_ids: selected }).then(r => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["students"] });
            toast.success("Matrículas atualizadas.");
            onClose();
        },
        onError: () => toast.error("Erro ao atualizar matrículas"),
    });

    const toggle = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Matrículas — {student.name}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                    {courses.map(course => (
                        <label key={course.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted">
                            <input
                                type="checkbox"
                                checked={selected.includes(course.id)}
                                onChange={() => toggle(course.id)}
                                className="rounded"
                            />
                            <span className="text-sm">{course.name}</span>
                        </label>
                    ))}
                </div>
                <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
                    <Button onClick={() => mutation.mutate()} loading={mutation.isPending} className="flex-1">
                        Salvar
                    </Button>
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
    const [showBulk, setShowBulk] = useState(false);
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
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowBulk(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar lista
                    </Button>
                    <Button onClick={() => setShowCreate(true)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Novo Aluno
                    </Button>
                </div>
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
                <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
            ) : students.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">
                            {search ? "Nenhum aluno encontrado." : "Nenhum aluno cadastrado ainda."}
                        </p>
                        {!search && (
                            <div className="flex gap-2 justify-center mt-4">
                                <Button variant="outline" size="sm" onClick={() => setShowBulk(true)}>
                                    <Upload className="h-4 w-4 mr-1" /> Importar lista
                                </Button>
                                <Button size="sm" onClick={() => setShowCreate(true)}>
                                    <UserPlus className="h-4 w-4 mr-1" /> Adicionar aluno
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {students.map(student => (
                        <Card key={student.id}>
                            <CardContent className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-semibold text-primary">
                                            {student.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-foreground text-sm truncate">{student.name}</p>
                                            {!student.is_active && (
                                                <Badge variant="secondary" className="text-xs">Inativo</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Mail className="h-3 w-3" />{student.email}
                                            </span>
                                            {student.phone && (
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />{student.phone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setManagingStudent(student)}
                                            title="Gerenciar matrículas"
                                        >
                                            <BookOpen className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleActiveMutation.mutate({ id: student.id, is_active: !student.is_active })}
                                            className={student.is_active ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-success"}
                                        >
                                            {student.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
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

                    {pagination && pagination.pages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                                Anterior
                            </Button>
                            <span className="text-sm text-muted-foreground">{page} de {pagination.pages}</span>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}>
                                Próxima
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            <CreateStudentModal open={showCreate} onClose={() => setShowCreate(false)} courses={courses} />
            <BulkImportModal open={showBulk} onClose={() => setShowBulk(false)} courses={courses} />
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